import {ethers} from 'ethers';
import {EconomySnapshot} from '../database/models/economySnapshot';
import logger from '../logger';
import {
  createActionHash,
  fromBnbWei,
  getOnchainConfig,
  getOperatorWallet,
  getRpcProvider,
  isPrizePoolConfigured,
  toBnbWei,
} from './onchainConfigService';

const prizePoolVaultAbi = [
  'function payTournamentPrize(bytes32 tournamentId, bytes32 payoutId, address winner, uint256 amount) external',
];

const roundValue = (value: number) => Number(value.toFixed(8));

const getPrizePoolContract = () => {
  const config = getOnchainConfig();
  const wallet = getOperatorWallet();
  return new ethers.Contract(config.prizePoolVaultAddress, prizePoolVaultAbi, wallet);
};

export const payoutTournamentPrize = async (
  tournamentUniqueId: string,
  payoutUniqueId: string,
  winnerWallet: string,
  bnbAmount: number
) => {
  if (!isPrizePoolConfigured()) {
    logger.warn('Prize payout skipped because on-chain config is missing; using mock payout mode.');
    return {
      txHash: null,
      payoutId: createActionHash(payoutUniqueId),
      mode: 'mock',
    };
  }

  const contract = getPrizePoolContract();
  const tournamentId = ethers.id(tournamentUniqueId);
  const payoutId = createActionHash(payoutUniqueId);
  const amountWei = toBnbWei(bnbAmount);
  const tx = await contract.payTournamentPrize(tournamentId, payoutId, winnerWallet, amountWei);
  const receipt = await tx.wait();

  return {
    txHash: receipt?.hash || tx.hash,
    payoutId,
    mode: 'onchain',
  };
};

export const syncPrizePoolSnapshot = async () => {
  if (!isPrizePoolConfigured()) {
    return null;
  }

  const config = getOnchainConfig();
  const provider = getRpcProvider();
  const balanceWei = await provider.getBalance(config.prizePoolVaultAddress);

  const snapshot = await EconomySnapshot.findOne({where: {snapshot_key: 'global'}});
  if (!snapshot) {
    return null;
  }

  snapshot.bnb_prize_pool = roundValue(fromBnbWei(balanceWei));
  snapshot.reserved_bnb_prize_pool = 0;
  snapshot.metadata = {
    ...(snapshot.metadata || {}),
    availablePrizePoolBnb: roundValue(fromBnbWei(balanceWei)),
  };
  await snapshot.save();

  return {
    balanceBnb: roundValue(fromBnbWei(balanceWei)),
    reservedBnb: 0,
    availableBnb: roundValue(fromBnbWei(balanceWei)),
  };
};
