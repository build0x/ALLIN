import {Op} from 'sequelize';
import {ethers} from 'ethers';
import {CashierRequest} from '../database/models/cashierRequest';
import {ChainEventCursor} from '../database/models/chainEventCursor';
import {PlayerLedger} from '../database/models/playerLedger';
import {User} from '../database/models/user';
import {sequelize} from '../database/database';
import logger from '../logger';
import {
  createActionHash,
  fromAllinUnits,
  getAllinTokenContract,
  getOnchainConfig,
  getOperatorWallet,
  getRpcProvider,
  getWalletAllinBalance,
  isTreasuryConfigured,
  toAllinUnits,
} from './onchainConfigService';
import {syncPrizePoolSnapshot} from './prizePoolService';

const treasuryVaultAbi = [
  'event Deposited(address indexed depositor, uint256 amount, bytes32 indexed depositId, uint256 vaultBalanceAfter)',
  'function withdraw(address recipient, uint256 amount, bytes32 withdrawalId) external',
];

const toNumber = (value: unknown) => Number(value || 0);
const roundValue = (value: number) => Number(value.toFixed(8));
const normalizeAmount = (amount: number) => {
  const numeric = Number(amount || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  if (!Number.isInteger(numeric)) {
    throw new Error('AMOUNT_MUST_BE_INTEGER');
  }

  return numeric;
};

const buildUserWallet = async (user: User) => {
  const walletAllinBalance = await getWalletAllinBalance(user.wallet_address);

  return {
    walletAddress: user.wallet_address,
    chipBalance: toNumber(user.money),
    allinBalance: walletAllinBalance,
    walletAllinBalance,
    vaultAllinBalance: toNumber(user.allin_balance),
    holdAmount: walletAllinBalance,
    lifetimeBurned: toNumber(user.lifetime_burned),
    totalDeposited: toNumber(user.total_deposited),
    totalWithdrawn: toNumber(user.total_withdrawn),
    lockedInTables: toNumber(user.locked_table_balance),
    lockedInTournament: toNumber(user.locked_tournament_balance),
    pendingWithdrawal: toNumber(user.pending_withdrawal),
  };
};

const getTreasuryContract = () => {
  const config = getOnchainConfig();
  const wallet = getOperatorWallet();
  return new ethers.Contract(config.treasuryVaultAddress, treasuryVaultAbi, wallet);
};

const normalizeFailureReason = (error: any) =>
  String(error?.shortMessage || error?.reason || error?.message || 'UNKNOWN_ERROR').slice(0, 255);

export const requestAllinWithdrawal = async (userId: number, amount: number) => {
  const withdrawalAmount = normalizeAmount(amount);

  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: {id: userId},
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (!user.wallet_address) {
      throw new Error('WALLET_REQUIRED');
    }

    const currentAllinBalance = toNumber(user.allin_balance);
    const currentPendingWithdrawal = toNumber(user.pending_withdrawal);

    if (currentAllinBalance < withdrawalAmount) {
      throw new Error('INSUFFICIENT_ALLIN_BALANCE');
    }

    user.allin_balance = roundValue(currentAllinBalance - withdrawalAmount);
    user.pending_withdrawal = roundValue(currentPendingWithdrawal + withdrawalAmount);
    await user.save({transaction});

    const requestId = `withdrawal:${user.id}:${Date.now()}`;

    await CashierRequest.create({
      user_id: user.id,
      wallet_address: user.wallet_address,
      direction: 'withdrawal',
      asset: 'ALLIN',
      amount: withdrawalAmount,
      request_id: requestId,
      status: 'pending',
      metadata: {
        source: 'wallet_withdrawal',
      },
    }, {transaction});

    return {
      requestId,
      status: 'pending',
      wallet: await buildUserWallet(user),
    };
  });

  // 用户提现后立即发链上交易，不等定时任务（原为每 2 分钟跑一次），约一个区块（~3 秒）即可到账
  try {
    await submitPendingWithdrawalRequests(1);
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'requestAllinWithdrawal: immediate submit failed, will be picked up by cron');
  }

  return result;
};

export const submitPendingWithdrawalRequests = async (limit = 20) => {
  if (!isTreasuryConfigured()) {
    return 0;
  }

  const pendingRequests = await CashierRequest.findAll({
    where: {
      direction: 'withdrawal',
      status: 'pending',
    },
    order: [['id', 'ASC']],
    limit,
  });

  let submittedCount = 0;

  for (const request of pendingRequests) {
    try {
      await sequelize.transaction(async (transaction) => {
        const lockedRequest = await CashierRequest.findByPk(request.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!lockedRequest || lockedRequest.status !== 'pending') {
          return;
        }

        lockedRequest.status = 'processing';
        lockedRequest.failure_reason = null;
        await lockedRequest.save({transaction});
      });

      const contract = getTreasuryContract();
      const tx = await contract.withdraw(
        request.wallet_address,
        toAllinUnits(toNumber(request.amount)),
        createActionHash(request.request_id)
      );

      await CashierRequest.update(
        {
          status: 'submitted',
          tx_hash: tx.hash,
          submitted_at: new Date(),
          failure_reason: null,
        },
        {
          where: {
            id: request.id,
          },
        }
      );

      submittedCount += 1;
    } catch (error: any) {
      logger.error({error}, 'Failed to submit treasury withdrawal');
      await CashierRequest.update(
        {
          status: 'pending',
          failure_reason: normalizeFailureReason(error),
        },
        {
          where: {
            id: request.id,
          },
        }
      );
    }
  }

  return submittedCount;
};

export const confirmSubmittedWithdrawalRequests = async (limit = 20) => {
  if (!isTreasuryConfigured()) {
    return 0;
  }

  const provider = getRpcProvider();
  const config = getOnchainConfig();
  const submittedRequests = await CashierRequest.findAll({
    where: {
      direction: 'withdrawal',
      status: 'submitted',
      tx_hash: {
        [Op.ne]: null,
      },
    },
    order: [['id', 'ASC']],
    limit,
  });

  let confirmedCount = 0;

  for (const request of submittedRequests) {
    try {
      const receipt = await provider.getTransactionReceipt(String(request.tx_hash));

      if (!receipt) {
        continue;
      }

      const currentBlock = await provider.getBlockNumber();
      if (currentBlock - receipt.blockNumber + 1 < config.confirmations) {
        continue;
      }

      if (receipt.status === 1) {
        await sequelize.transaction(async (transaction) => {
          const lockedRequest = await CashierRequest.findByPk(request.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          const user = lockedRequest?.user_id
            ? await User.findByPk(lockedRequest.user_id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
              })
            : null;

          if (!lockedRequest || lockedRequest.status !== 'submitted' || !user) {
            return;
          }

          user.pending_withdrawal = roundValue(
            Math.max(0, toNumber(user.pending_withdrawal) - toNumber(lockedRequest.amount))
          );
          user.total_withdrawn = roundValue(toNumber(user.total_withdrawn) + toNumber(lockedRequest.amount));
          await user.save({transaction});

          lockedRequest.status = 'confirmed';
          lockedRequest.confirmed_at = new Date();
          lockedRequest.failure_reason = null;
          await lockedRequest.save({transaction});

          await PlayerLedger.create({
            user_id: user.id,
            entry_type: 'wallet_withdrawal',
            asset: 'ALLIN',
            amount: -toNumber(lockedRequest.amount),
            balance_after: toNumber(user.allin_balance),
            reference_id: lockedRequest.request_id,
            metadata: {
              txHash: lockedRequest.tx_hash,
              direction: 'withdrawal',
            },
          }, {transaction});
        });

        confirmedCount += 1;
        continue;
      }

      await sequelize.transaction(async (transaction) => {
        const lockedRequest = await CashierRequest.findByPk(request.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const user = lockedRequest?.user_id
          ? await User.findByPk(lockedRequest.user_id, {
              transaction,
              lock: transaction.LOCK.UPDATE,
            })
          : null;

        if (!lockedRequest || lockedRequest.status !== 'submitted') {
          return;
        }

        if (user) {
          user.pending_withdrawal = roundValue(
            Math.max(0, toNumber(user.pending_withdrawal) - toNumber(lockedRequest.amount))
          );
          user.allin_balance = roundValue(toNumber(user.allin_balance) + toNumber(lockedRequest.amount));
          await user.save({transaction});
        }

        lockedRequest.status = 'failed';
        lockedRequest.failure_reason = 'WITHDRAWAL_TRANSACTION_REVERTED';
        await lockedRequest.save({transaction});
      });
    } catch (error: any) {
      logger.error({error, requestId: request.request_id}, 'Failed to confirm treasury withdrawal');
    }
  }

  return confirmedCount;
};

/** 单次 eth_getLogs 最大区块范围，避免公共 RPC 限流 */
const MAX_DEPOSIT_SCAN_BLOCKS = 2000;

/**
 * 交互成功就加余额：根据 txHash 查链上该笔交易的 Deposited 事件，校验 depositor 为当前用户后入账。
 * 不扫区块，只查单笔交易，即时到账。
 */
export const confirmDepositByTxHash = async (
  txHash: string,
  userId: number
): Promise<ReturnType<typeof buildUserWallet>> => {
  if (!isTreasuryConfigured()) {
    throw new Error('ONCHAIN_NOT_CONFIGURED');
  }

  const user = await User.findByPk(userId);
  if (!user?.wallet_address) {
    throw new Error('WALLET_REQUIRED');
  }

  const provider = getRpcProvider();
  const config = getOnchainConfig();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    throw new Error('TX_NOT_FOUND_OR_FAILED');
  }

  const vaultAddress = config.treasuryVaultAddress.toLowerCase();
  const contract = new ethers.Contract(config.treasuryVaultAddress, treasuryVaultAbi, provider);
  let depositor = '';
  let depositId = '';
  let amount = 0;
  let blockNumber = 0;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== vaultAddress) continue;
    try {
      const parsed = contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'Deposited') {
        depositor = String(parsed.args.depositor ?? '').toLowerCase();
        depositId = String(parsed.args.depositId ?? '');
        amount = roundValue(fromAllinUnits(BigInt(parsed.args.amount ?? 0)));
        blockNumber = Number(log.blockNumber ?? 0);
        break;
      }
    } catch {
      // ignore parse errors
    }
  }

  if (!depositor || !depositId) {
    throw new Error('NOT_DEPOSIT_TX');
  }
  if (depositor !== user.wallet_address.toLowerCase()) {
    throw new Error('DEPOSITOR_MISMATCH');
  }

  const existingRequest = await CashierRequest.findOne({
    where: { request_id: depositId },
  });
  if (existingRequest?.status === 'confirmed') {
    return buildUserWallet(user);
  }

  await sequelize.transaction(async (transaction) => {
    const lockedRequest = existingRequest
      ? await CashierRequest.findByPk(existingRequest.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : null;

    if (lockedRequest?.status === 'confirmed') return;

    const lockedUser = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!lockedUser) return;

    lockedUser.total_deposited = roundValue(toNumber(lockedUser.total_deposited) + amount);
    lockedUser.money = roundValue(toNumber(lockedUser.money) + amount);
    await lockedUser.save({ transaction });

    if (lockedRequest) {
      lockedRequest.user_id = lockedUser.id;
      lockedRequest.wallet_address = lockedUser.wallet_address;
      lockedRequest.direction = 'deposit';
      lockedRequest.status = 'confirmed';
      lockedRequest.tx_hash = txHash;
      lockedRequest.confirmed_at = new Date();
      lockedRequest.failure_reason = null;
      lockedRequest.metadata = { ...(lockedRequest.metadata || {}), blockNumber };
      await lockedRequest.save({ transaction });
    } else {
      await CashierRequest.create(
        {
          user_id: lockedUser.id,
          wallet_address: lockedUser.wallet_address,
          direction: 'deposit',
          asset: 'ALLIN',
          amount,
          request_id: depositId,
          status: 'confirmed',
          tx_hash: txHash,
          confirmed_at: new Date(),
          metadata: { blockNumber },
        },
        { transaction }
      );
    }

    await PlayerLedger.create(
      {
        user_id: lockedUser.id,
        entry_type: 'wallet_deposit',
        asset: 'ALLIN',
        amount,
        balance_after: toNumber(lockedUser.total_deposited),
        reference_id: depositId,
        metadata: { txHash, direction: 'deposit' },
      },
      { transaction }
    );
    await PlayerLedger.create(
      {
        user_id: lockedUser.id,
        entry_type: 'auto_convert_to_chips',
        asset: 'TABLE_CHIPS',
        amount,
        balance_after: toNumber(lockedUser.money),
        reference_id: depositId,
        metadata: { txHash, direction: 'wallet_deposit_to_chips', exchangeRate: 1 },
      },
      { transaction }
    );
  });

  const updatedUser = await User.findByPk(userId);
  return buildUserWallet(updatedUser!);
};

export const syncTreasuryDeposits = async () => {
  if (!isTreasuryConfigured()) {
    return 0;
  }

  const config = getOnchainConfig();
  const provider = getRpcProvider();
  const contract = new ethers.Contract(config.treasuryVaultAddress, treasuryVaultAbi, provider);
  const currentBlock = await provider.getBlockNumber();
  const safeBlock = Math.max(0, currentBlock - config.confirmations + 1);
  const [cursor] = await ChainEventCursor.findOrCreate({
    where: {cursor_key: 'treasury_deposits'},
    defaults: {
      cursor_key: 'treasury_deposits',
      last_scanned_block: Math.max(0, config.startBlock - 1),
    },
  });

  let fromBlock = Number(cursor.last_scanned_block || 0) + 1;

  // 未配置 startBlock 且尚未扫过有效区块时，从近期块开始，避免从创世块触发 RPC 限流
  if (config.startBlock === 0 && fromBlock === 1 && safeBlock > MAX_DEPOSIT_SCAN_BLOCKS) {
    cursor.last_scanned_block = Math.max(0, safeBlock - MAX_DEPOSIT_SCAN_BLOCKS - 1);
    await cursor.save();
    fromBlock = cursor.last_scanned_block + 1;
  }

  if (safeBlock < fromBlock) {
    return 0;
  }

  const toBlock = Math.min(fromBlock + MAX_DEPOSIT_SCAN_BLOCKS - 1, safeBlock);
  let events: Awaited<ReturnType<typeof contract.queryFilter>> = [];
  try {
    events = await contract.queryFilter(contract.filters.Deposited(), fromBlock, toBlock);
  } catch (err: any) {
    logger.warn(
      { err: err?.message, fromBlock, toBlock },
      'syncTreasuryDeposits: eth_getLogs failed, will retry next sync'
    );
    return 0;
  }

  let processedCount = 0;

  for (const event of events) {
    const eventArgs = (event as any).args || {};
    const depositor = String(eventArgs.depositor || '').toLowerCase();
    const depositId = String(eventArgs.depositId || '');
    const amount = roundValue(fromAllinUnits(BigInt(eventArgs.amount || 0)));
    const txHash = event.transactionHash;

    const existingRequest = await CashierRequest.findOne({
      where: {
        request_id: depositId,
      },
    });

    if (existingRequest?.status === 'confirmed') {
      processedCount += 1;
      continue;
    }

    await sequelize.transaction(async (transaction) => {
      const lockedRequest = existingRequest
        ? await CashierRequest.findByPk(existingRequest.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;

      if (lockedRequest?.status === 'confirmed') {
        return;
      }

      const user = await User.findOne({
        where: {
          wallet_address: {
            [Op.iLike]: depositor,
          },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        if (lockedRequest) {
          lockedRequest.status = 'unmatched';
          lockedRequest.tx_hash = txHash;
          lockedRequest.metadata = {
            ...(lockedRequest.metadata || {}),
            blockNumber: event.blockNumber,
          };
          await lockedRequest.save({transaction});
          return;
        }

        await CashierRequest.create({
          user_id: null,
          wallet_address: depositor,
          direction: 'deposit',
          asset: 'ALLIN',
          amount,
          request_id: depositId,
          status: 'unmatched',
          tx_hash: txHash,
          confirmed_at: new Date(),
          metadata: {
            blockNumber: event.blockNumber,
          },
        }, {transaction});
        return;
      }

      user.total_deposited = roundValue(toNumber(user.total_deposited) + amount);
      user.money = roundValue(toNumber(user.money) + amount);
      await user.save({transaction});

      if (lockedRequest) {
        lockedRequest.user_id = user.id;
        lockedRequest.wallet_address = user.wallet_address;
        lockedRequest.direction = 'deposit';
        lockedRequest.status = 'confirmed';
        lockedRequest.tx_hash = txHash;
        lockedRequest.confirmed_at = new Date();
        lockedRequest.failure_reason = null;
        lockedRequest.metadata = {
          ...(lockedRequest.metadata || {}),
          blockNumber: event.blockNumber,
        };
        await lockedRequest.save({transaction});
      } else {
        await CashierRequest.create({
          user_id: user.id,
          wallet_address: user.wallet_address,
          direction: 'deposit',
          asset: 'ALLIN',
          amount,
          request_id: depositId,
          status: 'confirmed',
          tx_hash: txHash,
          confirmed_at: new Date(),
          metadata: {
            blockNumber: event.blockNumber,
          },
        }, {transaction});
      }

      await PlayerLedger.create({
        user_id: user.id,
        entry_type: 'wallet_deposit',
        asset: 'ALLIN',
        amount,
        balance_after: toNumber(user.total_deposited),
        reference_id: depositId,
        metadata: {
          txHash,
          direction: 'deposit',
        },
      }, {transaction});

      await PlayerLedger.create({
        user_id: user.id,
        entry_type: 'auto_convert_to_chips',
        asset: 'TABLE_CHIPS',
        amount,
        balance_after: toNumber(user.money),
        reference_id: depositId,
        metadata: {
          txHash,
          direction: 'wallet_deposit_to_chips',
          exchangeRate: 1,
        },
      }, {transaction});
    });

    processedCount += 1;
  }

  cursor.last_scanned_block = toBlock;
  cursor.last_tx_hash = events.length ? events[events.length - 1].transactionHash : cursor.last_tx_hash;
  cursor.metadata = {
    ...(cursor.metadata || {}),
    processedCount,
  };
  await cursor.save();

  return processedCount;
};

export const getTreasuryVaultBalance = async () => {
  if (!isTreasuryConfigured()) {
    return 0;
  }

  const contract = getAllinTokenContract();
  const balance = await contract.balanceOf(getOnchainConfig().treasuryVaultAddress);
  return roundValue(fromAllinUnits(balance));
};

export const runOnchainReconciliationCycle = async () => {
  let depositCount = await syncTreasuryDeposits();
  // 再跑一轮，确保刚确认的充值区块被扫到
  depositCount += await syncTreasuryDeposits();
  const submittedWithdrawals = await submitPendingWithdrawalRequests();
  const confirmedWithdrawals = await confirmSubmittedWithdrawalRequests();
  await syncPrizePoolSnapshot();

  return {
    depositCount,
    submittedWithdrawals,
    confirmedWithdrawals,
  };
};
