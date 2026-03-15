import {Op} from 'sequelize';
import {PlayerLedger} from '../database/models/playerLedger';
import {Tournament} from '../database/models/tournament';
import {TournamentRegistration} from '../database/models/tournamentRegistration';
import {User} from '../database/models/user';
import {sequelize} from '../database/database';
import {AdminWallet} from '../database/models/adminWallet';
import {createAdminAuditLog} from './adminAuditService';

const toNumber = (value: unknown) => Number(value || 0);

export const listAdminUsers = async (search: string, page: number, pageSize: number) => {
  const where = search
    ? {
        [Op.or]: [
          {username: {[Op.iLike]: `%${search}%`}},
          {wallet_address: {[Op.iLike]: `%${search}%`}},
          {email: {[Op.iLike]: `%${search}%`}},
        ],
      }
    : undefined;

  const {count, rows} = await User.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });

  return {
    total: count,
    page,
    pageSize,
    items: rows.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      walletAddress: user.wallet_address,
      loginMethod: user.login_method,
      money: toNumber(user.money),
      allinBalance: toNumber(user.allin_balance),
      xp: user.xp,
      winCount: user.win_count,
      loseCount: user.lose_count,
      playCount: user.play_count,
      lifetimeBurned: toNumber(user.lifetime_burned),
      totalDeposited: toNumber(user.total_deposited),
      totalWithdrawn: toNumber(user.total_withdrawn),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
  };
};

export const getAdminUserDetails = async (userId: number) => {
  const user = await User.findOne({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const [recentLedger, registrations] = await Promise.all([
    PlayerLedger.findAll({
      where: {
        user_id: userId,
      },
      order: [['created_at', 'DESC']],
      limit: 20,
    }),
    TournamentRegistration.findAll({
      where: {
        user_id: userId,
      },
      order: [['created_at', 'DESC']],
    }),
  ]);

  const tournamentIds = registrations.map((item) => item.tournament_id);
  const tournaments = tournamentIds.length
    ? await Tournament.findAll({
        where: {
          id: {
            [Op.in]: tournamentIds,
          },
        },
      })
    : [];
  const tournamentMap = new Map(tournaments.map((item) => [item.id, item]));

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      walletAddress: user.wallet_address,
      loginMethod: user.login_method,
      money: toNumber(user.money),
      allinBalance: toNumber(user.allin_balance),
      xp: user.xp,
      winCount: user.win_count,
      loseCount: user.lose_count,
      playCount: user.play_count,
      lifetimeBurned: toNumber(user.lifetime_burned),
      totalDeposited: toNumber(user.total_deposited),
      totalWithdrawn: toNumber(user.total_withdrawn),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    recentLedger: recentLedger.map((entry) => ({
      id: entry.id,
      entryType: entry.entry_type,
      asset: entry.asset,
      amount: toNumber(entry.amount),
      balanceAfter: toNumber(entry.balance_after),
      referenceId: entry.reference_id,
      metadata: entry.metadata,
      createdAt: entry.created_at,
    })),
    registrations: registrations.map((registration) => ({
      id: registration.id,
      tournamentId: registration.tournament_id,
      tournamentTitle: tournamentMap.get(registration.tournament_id)?.title || `赛事 ${registration.tournament_id}`,
      editionKey: registration.edition_key || 'edition-1',
      status: registration.status,
      finalRank: registration.final_rank,
      payoutBnb: toNumber(registration.payout_bnb),
      holdAmountAtEntry: toNumber(registration.hold_amount_at_entry),
      burnAmount: toNumber(registration.burn_amount),
      metadata: registration.metadata,
      createdAt: registration.created_at,
    })),
  };
};

interface AdjustBalancesInput {
  userId: number;
  moneyDelta: number;
  allinDelta: number;
  reason: string;
  adminWallet: AdminWallet;
  ipAddress?: string;
  path?: string;
  httpMethod?: string;
}

export const adjustAdminUserBalances = async (input: AdjustBalancesInput) => {
  const moneyDelta = Number(input.moneyDelta || 0);
  const allinDelta = Number(input.allinDelta || 0);
  const reason = String(input.reason || '').trim();

  if (!reason) {
    throw new Error('ADJUST_REASON_REQUIRED');
  }

  if (moneyDelta === 0 && allinDelta === 0) {
    throw new Error('ADJUST_AMOUNT_REQUIRED');
  }

  return sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: {
        id: input.userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const currentMoney = toNumber(user.money);
    const currentAllinBalance = toNumber(user.allin_balance);
    const nextMoney = currentMoney + moneyDelta;
    const nextAllinBalance = currentAllinBalance + allinDelta;

    if (nextMoney < 0) {
      throw new Error('INSUFFICIENT_MONEY_BALANCE');
    }

    if (nextAllinBalance < 0) {
      throw new Error('INSUFFICIENT_ALLIN_BALANCE');
    }

    user.money = nextMoney;
    user.allin_balance = nextAllinBalance;

    if (allinDelta > 0) {
      user.total_deposited = toNumber(user.total_deposited) + allinDelta;
    }
    if (allinDelta < 0) {
      user.total_withdrawn = toNumber(user.total_withdrawn) + Math.abs(allinDelta);
    }

    await user.save({transaction});

    if (moneyDelta !== 0) {
      await PlayerLedger.create(
        {
          user_id: user.id,
          entry_type: 'admin_adjustment',
          asset: 'TABLE_CHIPS',
          amount: moneyDelta,
          balance_after: nextMoney,
          reference_id: `admin:user:${user.id}`,
          metadata: {
            reason,
            adminWalletAddress: input.adminWallet.wallet_address,
          },
        },
        {transaction}
      );
    }

    if (allinDelta !== 0) {
      await PlayerLedger.create(
        {
          user_id: user.id,
          entry_type: 'admin_adjustment',
          asset: 'ALLIN',
          amount: allinDelta,
          balance_after: nextAllinBalance,
          reference_id: `admin:user:${user.id}`,
          metadata: {
            reason,
            adminWalletAddress: input.adminWallet.wallet_address,
          },
        },
        {transaction}
      );
    }

    await createAdminAuditLog({
      adminWalletId: input.adminWallet.id,
      adminWalletAddress: input.adminWallet.wallet_address,
      action: 'user.balance_adjust',
      resourceType: 'user',
      resourceId: String(user.id),
      targetUserId: user.id,
      httpMethod: input.httpMethod,
      path: input.path,
      ipAddress: input.ipAddress,
      summary: `调整用户 ${user.id} 余额`,
      payload: {
        reason,
        moneyDelta,
        allinDelta,
        before: {
          money: currentMoney,
          allinBalance: currentAllinBalance,
        },
        after: {
          money: nextMoney,
          allinBalance: nextAllinBalance,
        },
      },
    });

    return {
      userId: user.id,
      username: user.username,
      walletAddress: user.wallet_address,
      money: nextMoney,
      allinBalance: nextAllinBalance,
    };
  });
};
