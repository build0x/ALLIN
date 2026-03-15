import {Op} from 'sequelize';
import {BurnRecord} from '../database/models/burnRecord';
import {EconomySnapshot} from '../database/models/economySnapshot';
import {PlayerLedger} from '../database/models/playerLedger';
import {Tournament} from '../database/models/tournament';
import {TournamentRegistration} from '../database/models/tournamentRegistration';
import {User} from '../database/models/user';
import {sequelize} from '../database/database';
import {AdminWallet} from '../database/models/adminWallet';
import {createAdminAuditLog} from './adminAuditService';
import {
  buildTournamentView,
  fillTournamentWithBots,
  progressTournamentLifecycle,
  registerForTournament,
} from '../services/economyService';
import {
  applyTournamentRewardRecommendation,
  generateTournamentRewardRecommendation,
  getTournamentStrategyRecommendation,
  rejectTournamentRewardRecommendation,
  TOURNAMENT_REWARD_TEMPLATES,
} from '../services/oracleStrategyService';

const toNumber = (value: unknown) => Number(value || 0);

export const listAdminTournaments = async () => {
  const tournaments = await Tournament.findAll({
    where: {
      slug: 'allin-championship',
    },
    order: [['id', 'ASC']],
  });

  return Promise.all(
    tournaments.map(async (tournament) => {
      const tournamentView = await buildTournamentView(tournament);

      return {
        ...tournamentView,
        strategyRecommendation: getTournamentStrategyRecommendation(tournament.metadata),
        updatedAt: tournament.updated_at,
      };
    })
  );
};

export const getAdminTournamentDetails = async (tournamentId: number) => {
  const tournament = await Tournament.findOne({
    where: {
      id: tournamentId,
      slug: 'allin-championship',
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const tournamentView = await buildTournamentView(tournament);
  const registrations = await TournamentRegistration.findAll({
    where: {
      tournament_id: tournament.id,
      edition_key: String(tournamentView.currentEdition || 'edition-1'),
    },
    order: [['created_at', 'ASC']],
  });

  const userIds = registrations.map((item) => item.user_id);
  const users = userIds.length
    ? await User.findAll({
        where: {
          id: {
            [Op.in]: userIds,
          },
        },
      })
    : [];
  const userMap = new Map(users.map((item) => [item.id, item]));

  return {
    tournament: {
      ...tournamentView,
      strategyRecommendation: getTournamentStrategyRecommendation(tournament.metadata),
      rewardTemplates: TOURNAMENT_REWARD_TEMPLATES,
      updatedAt: tournament.updated_at,
    },
    registrations: registrations.map((registration) => {
      const user = userMap.get(registration.user_id);
      return {
        id: registration.id,
        userId: registration.user_id,
        editionKey: registration.edition_key || String(tournamentView.currentEdition || 'edition-1'),
        username: user?.username || null,
        walletAddress: user?.wallet_address || null,
        status: registration.status,
        holdAmountAtEntry: toNumber(registration.hold_amount_at_entry),
        burnAmount: toNumber(registration.burn_amount),
        tableNo: registration.table_no,
        seatNo: registration.seat_no,
        finalRank: registration.final_rank,
        payoutBnb: toNumber(registration.payout_bnb),
        metadata: registration.metadata,
        createdAt: registration.created_at,
      };
    }),
  };
};

interface UpdateTournamentInput {
  tournamentId: number;
  patch: Record<string, unknown>;
  adminWallet: AdminWallet;
  ipAddress?: string;
  path?: string;
  httpMethod?: string;
}

export const updateAdminTournament = async (input: UpdateTournamentInput) => {
  const tournament = await Tournament.findOne({
    where: {
      id: input.tournamentId,
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const allowedPatch = {
    title: typeof input.patch.title === 'string' ? input.patch.title.trim() : tournament.title,
    status: typeof input.patch.status === 'string' ? input.patch.status.trim() : tournament.status,
    required_hold_amount:
      input.patch.requiredHoldAmount !== undefined
        ? Number(input.patch.requiredHoldAmount)
        : toNumber(tournament.required_hold_amount),
    buy_in_allin:
      input.patch.buyInAllin !== undefined
        ? Number(input.patch.buyInAllin)
        : toNumber(tournament.buy_in_allin),
    burn_amount:
      input.patch.burnAmount !== undefined
        ? Number(input.patch.burnAmount)
        : toNumber(tournament.burn_amount),
    bnb_prize_amount:
      input.patch.bnbPrizeAmount !== undefined
        ? Number(input.patch.bnbPrizeAmount)
        : toNumber(tournament.bnb_prize_amount),
    min_players:
      input.patch.minPlayers !== undefined ? Number(input.patch.minPlayers) : tournament.min_players,
    max_players:
      input.patch.maxPlayers !== undefined ? Number(input.patch.maxPlayers) : tournament.max_players,
    registration_opens_at:
      input.patch.registrationOpensAt !== undefined
        ? (input.patch.registrationOpensAt ? new Date(String(input.patch.registrationOpensAt)) : null)
        : tournament.registration_opens_at,
    starts_at:
      input.patch.startsAt !== undefined
        ? (input.patch.startsAt ? new Date(String(input.patch.startsAt)) : null)
        : tournament.starts_at,
    finished_at:
      input.patch.finishedAt !== undefined
        ? (input.patch.finishedAt ? new Date(String(input.patch.finishedAt)) : null)
        : tournament.finished_at,
  };

  if (allowedPatch.min_players < 0 || allowedPatch.max_players < 1) {
    throw new Error('INVALID_TOURNAMENT_PLAYER_LIMITS');
  }

  Object.assign(tournament, allowedPatch);
  tournament.metadata = {
    ...(tournament.metadata || {}),
    ...(typeof input.patch.metadata === 'object' && input.patch.metadata ? input.patch.metadata : {}),
  };
  await tournament.save();

  await createAdminAuditLog({
    adminWalletId: input.adminWallet.id,
    adminWalletAddress: input.adminWallet.wallet_address,
    action: 'tournament.update',
    resourceType: 'tournament',
    resourceId: String(tournament.id),
    httpMethod: input.httpMethod,
    path: input.path,
    ipAddress: input.ipAddress,
    summary: `更新赛事 ${tournament.id}`,
    payload: {
      patch: input.patch,
    },
  });

  return getAdminTournamentDetails(tournament.id);
};

interface TournamentAdminActionInput {
  tournamentId: number;
  userId?: number;
  adminWallet: AdminWallet;
  ipAddress?: string;
  path?: string;
  httpMethod?: string;
}

export const adminRegisterTournamentUser = async (input: TournamentAdminActionInput) => {
  if (!input.userId) {
    throw new Error('USER_NOT_FOUND');
  }

  await registerForTournament(input.userId, input.tournamentId);

  await createAdminAuditLog({
    adminWalletId: input.adminWallet.id,
    adminWalletAddress: input.adminWallet.wallet_address,
    action: 'tournament.register_user',
    resourceType: 'tournament',
    resourceId: String(input.tournamentId),
    targetUserId: input.userId,
    httpMethod: input.httpMethod,
    path: input.path,
    ipAddress: input.ipAddress,
    summary: `管理员为用户 ${input.userId} 报名赛事 ${input.tournamentId}`,
    payload: {
      tournamentId: input.tournamentId,
      userId: input.userId,
    },
  });

  return getAdminTournamentDetails(input.tournamentId);
};

export const adminCancelTournamentRegistration = async (input: TournamentAdminActionInput) =>
  sequelize.transaction(async (transaction) => {
    if (!input.userId) {
      throw new Error('USER_NOT_FOUND');
    }

    const tournament = await Tournament.findOne({
      where: {
        id: input.tournamentId,
      },
      transaction,
    });

    if (!tournament) {
      throw new Error('TOURNAMENT_NOT_FOUND');
    }

    const currentEditionKey = String(tournament.metadata?.currentEditionKey || 'edition-1');
    const [user, registration, snapshot] = await Promise.all([
      User.findOne({
        where: {
          id: input.userId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
      TournamentRegistration.findOne({
        where: {
          tournament_id: input.tournamentId,
          user_id: input.userId,
          edition_key: currentEditionKey,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
      EconomySnapshot.findOne({
        where: {
          snapshot_key: 'global',
        },
        transaction,
      }),
    ]);

    if (!user || !registration) {
      throw new Error('TOURNAMENT_REGISTRATION_NOT_FOUND');
    }

    if (registration.status === 'cancelled') {
      throw new Error('TOURNAMENT_REGISTRATION_ALREADY_CANCELLED');
    }

    const refundAmount =
      Number(registration.metadata?.buyInAllin || 0) || toNumber(tournament.buy_in_allin);
    const burnAmount = toNumber(registration.burn_amount);
    const currentAllinBalance = toNumber(user.allin_balance);

    user.allin_balance = currentAllinBalance + refundAmount;
    user.lifetime_burned = Math.max(0, toNumber(user.lifetime_burned) - burnAmount);
    await user.save({transaction});

    registration.status = 'cancelled';
    registration.metadata = {
      ...(registration.metadata || {}),
      cancelledByAdminWallet: input.adminWallet.wallet_address,
      cancelledAt: new Date().toISOString(),
    };
    await registration.save({transaction});

    await PlayerLedger.create(
      {
        user_id: user.id,
        entry_type: 'admin_tournament_refund',
        asset: 'ALLIN',
        amount: refundAmount,
        balance_after: toNumber(user.allin_balance),
        reference_id: `tournament:${tournament.id}`,
        metadata: {
          adminWalletAddress: input.adminWallet.wallet_address,
          burnAmount,
        },
      },
      {transaction}
    );

    if (snapshot) {
      snapshot.allin_burned_total = Math.max(0, toNumber(snapshot.allin_burned_total) - burnAmount);
      await snapshot.save({transaction});
    }

    await createAdminAuditLog({
      adminWalletId: input.adminWallet.id,
      adminWalletAddress: input.adminWallet.wallet_address,
      action: 'tournament.cancel_registration',
      resourceType: 'tournament',
      resourceId: String(input.tournamentId),
      targetUserId: user.id,
      httpMethod: input.httpMethod,
      path: input.path,
      ipAddress: input.ipAddress,
      summary: `取消用户 ${user.id} 的赛事报名`,
      payload: {
        tournamentId: input.tournamentId,
        userId: user.id,
        refundAmount,
        burnAmount,
      },
    });

    return getAdminTournamentDetails(input.tournamentId);
  });

export const adminAdvanceTournament = async (input: TournamentAdminActionInput) => {
  await progressTournamentLifecycle();

  await createAdminAuditLog({
    adminWalletId: input.adminWallet.id,
    adminWalletAddress: input.adminWallet.wallet_address,
    action: 'tournament.advance',
    resourceType: 'tournament',
    resourceId: String(input.tournamentId),
    httpMethod: input.httpMethod,
    path: input.path,
    ipAddress: input.ipAddress,
    summary: `推进赛事 ${input.tournamentId} 生命周期`,
    payload: {
      tournamentId: input.tournamentId,
    },
  });

  return getAdminTournamentDetails(input.tournamentId);
};

export const adminGenerateTournamentStrategy = async (input: TournamentAdminActionInput) => {
  const recommendation = await generateTournamentRewardRecommendation(input.tournamentId);

  await createAdminAuditLog({
    adminWalletId: input.adminWallet.id,
    adminWalletAddress: input.adminWallet.wallet_address,
    action: 'tournament.strategy.generate',
    resourceType: 'tournament',
    resourceId: String(input.tournamentId),
    httpMethod: input.httpMethod,
    path: input.path,
    ipAddress: input.ipAddress,
    summary: `生成赛事 ${input.tournamentId} 的 AI 奖励建议`,
    payload: {
      recommendation,
    },
  });

  return getAdminTournamentDetails(input.tournamentId);
};

export const adminApplyTournamentStrategy = async (input: TournamentAdminActionInput) => {
  const recommendation = await applyTournamentRewardRecommendation(input.tournamentId);

  await createAdminAuditLog({
    adminWalletId: input.adminWallet.id,
    adminWalletAddress: input.adminWallet.wallet_address,
    action: 'tournament.strategy.apply',
    resourceType: 'tournament',
    resourceId: String(input.tournamentId),
    httpMethod: input.httpMethod,
    path: input.path,
    ipAddress: input.ipAddress,
    summary: `采用赛事 ${input.tournamentId} 的 AI 奖励建议`,
    payload: {
      recommendation,
    },
  });

  return getAdminTournamentDetails(input.tournamentId);
};

export const adminRejectTournamentStrategy = async (input: TournamentAdminActionInput) => {
  const recommendation = await rejectTournamentRewardRecommendation(input.tournamentId);

  await createAdminAuditLog({
    adminWalletId: input.adminWallet.id,
    adminWalletAddress: input.adminWallet.wallet_address,
    action: 'tournament.strategy.reject',
    resourceType: 'tournament',
    resourceId: String(input.tournamentId),
    httpMethod: input.httpMethod,
    path: input.path,
    ipAddress: input.ipAddress,
    summary: `忽略赛事 ${input.tournamentId} 的 AI 奖励建议`,
    payload: {
      recommendation,
    },
  });

  return getAdminTournamentDetails(input.tournamentId);
};

export const adminFillTournamentBots = async (input: TournamentAdminActionInput & {count?: number}) => {
  const data = await fillTournamentWithBots(input.tournamentId, input.count);

  await createAdminAuditLog({
    adminWalletId: input.adminWallet.id,
    adminWalletAddress: input.adminWallet.wallet_address,
    action: 'tournament.fill_bots',
    resourceType: 'tournament',
    resourceId: String(input.tournamentId),
    httpMethod: input.httpMethod,
    path: input.path,
    ipAddress: input.ipAddress,
    summary: `为赛事 ${input.tournamentId} 填充测试机器人`,
    payload: {
      count: input.count,
      result: data,
    },
  });

  return getAdminTournamentDetails(input.tournamentId);
};

const NEXT_EDITION_START_DELAY_MS = 30 * 60 * 1000;

/** 赛事重置：清空当前届报名、退款、清除燃烧记录，并开启新一届（scheduled，30 分钟后开始） */
export const adminResetTournament = async (input: TournamentAdminActionInput) =>
  sequelize.transaction(async (transaction) => {
    const tournament = await Tournament.findOne({
      where: {
        id: input.tournamentId,
        slug: 'allin-championship',
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!tournament) {
      throw new Error('TOURNAMENT_NOT_FOUND');
    }

    const currentEditionKey = String(tournament.metadata?.currentEditionKey || 'edition-1');

    const registrations = await TournamentRegistration.findAll({
      where: {
        tournament_id: tournament.id,
        edition_key: currentEditionKey,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (const registration of registrations) {
      const refundAmount = Number(
        registration.metadata?.buyInAllin || tournament.buy_in_allin || 0
      );
      const user = await User.findByPk(registration.user_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user || refundAmount <= 0) {
        continue;
      }

      user.allin_balance = Number(user.allin_balance || 0) + refundAmount;
      await user.save({transaction});

      await PlayerLedger.create(
        {
          user_id: user.id,
          entry_type: 'tournament_reset_refund',
          asset: 'ALLIN',
          amount: refundAmount,
          balance_after: Number(user.allin_balance || 0),
          reference_id: `tournament-reset:${tournament.id}:${currentEditionKey}`,
          metadata: {
            tournamentId: tournament.id,
            editionKey: currentEditionKey,
            reason: 'admin_reset',
            adminWalletAddress: input.adminWallet.wallet_address,
          },
        },
        {transaction}
      );
    }

    await BurnRecord.destroy({
      where: {
        source_type: 'tournament_registration',
        reference_id: `tournament:${tournament.id}:${currentEditionKey}`,
      },
      transaction,
    });

    await TournamentRegistration.destroy({
      where: {
        tournament_id: tournament.id,
        edition_key: currentEditionKey,
      },
      transaction,
    });

    const nextEditionKey = `edition-${Date.now()}`;
    tournament.status = 'scheduled';
    tournament.finished_at = null;
    tournament.registration_opens_at = new Date();
    tournament.starts_at = new Date(Date.now() + NEXT_EDITION_START_DELAY_MS);
    tournament.metadata = {
      ...(tournament.metadata || {}),
      currentEditionKey: nextEditionKey,
      currentEditionState: null,
      delayedReason: null,
      delayedAt: null,
    };
    await tournament.save({transaction});

    await createAdminAuditLog({
      adminWalletId: input.adminWallet.id,
      adminWalletAddress: input.adminWallet.wallet_address,
      action: 'tournament.reset',
      resourceType: 'tournament',
      resourceId: String(tournament.id),
      httpMethod: input.httpMethod,
      path: input.path,
      ipAddress: input.ipAddress,
      summary: `赛事重置：${currentEditionKey} -> ${nextEditionKey}，已退款 ${registrations.length} 人`,
      payload: {
        tournamentId: tournament.id,
        previousEdition: currentEditionKey,
        nextEdition: nextEditionKey,
        clearedRegistrations: registrations.length,
      },
    });

    return getAdminTournamentDetails(input.tournamentId);
  });
