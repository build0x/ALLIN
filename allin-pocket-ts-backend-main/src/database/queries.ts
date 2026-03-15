import {col, fn, Op} from 'sequelize';
import {Statistic} from './models/statistic';
import {User} from './models/user';
import {RanksInterface, UserTableInterface} from '../interfaces';
import {UserTable} from './models/userTables';
import {RefreshToken} from './models/refreshToken';
import {sequelize} from './database';
import {PlayerLedger} from './models/playerLedger';
import {BurnRecord} from './models/burnRecord';
import {EconomySnapshot} from './models/economySnapshot';
import {getWalletAllinBalance} from '../services/onchainConfigService';

const PRIVATE_FRIEND_ROOM_HOURLY_BURN = 10000;
const PRIVATE_FRIEND_ROOM_MIN_DURATION_HOURS = 1;
const PRIVATE_FRIEND_ROOM_MAX_DURATION_HOURS = 24;

export async function getDailyAverageStats(userId: number) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const results = await Statistic.findAll({
    attributes: [
      [fn('DATE_TRUNC', 'day', col('createdAt')), 'date'],
      [fn('AVG', col('money')), 'avgMoney'],
      [fn('AVG', col('winCount')), 'avgWinCount'],
      [fn('AVG', col('loseCount')), 'avgLoseCount'],
    ],
    where: {
      userId: userId,
      createdAt: {
        [Op.gte]: oneMonthAgo,
      },
    },
    group: [fn('DATE_TRUNC', 'day', col('createdAt'))],
    order: [fn('DATE_TRUNC', 'day', col('createdAt'))],
    raw: true,
  });

  const labels: string[] = [];
  const averageMoney: number[] = [];
  const averageWinCount: number[] = [];
  const averageLoseCount: number[] = [];

  results.forEach((row: any) => {
    const date = new Date(row.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }); // Format date as 'Jan 1', 'Jan 2', etc.
    labels.push(date);
    averageMoney.push(parseFloat(parseFloat(row.avgMoney).toFixed(2)));
    averageWinCount.push(parseFloat(parseFloat(row.avgWinCount).toFixed(2)));
    averageLoseCount.push(parseFloat(parseFloat(row.avgLoseCount).toFixed(2)));
  });

  return {labels, averageMoney, averageWinCount, averageLoseCount};
}


export async function getRankings(): Promise<RanksInterface[]> {
  const users = await User.findAll({
    attributes: ['username', 'xp', 'money', 'win_count', 'lose_count'],
    order: [
      ['xp', 'DESC'],
    ],
    raw: true
  });

  return users
    .filter((user: any) => Boolean(user.username))
    .map((user: any) => ({
      username: user.username,
      xp: user.xp,
      money: user.money,
      win_count: user.win_count,
      lose_count: user.lose_count,
    }));
}

export async function createUpdateUserTable(
  userId: number, tableData: UserTableInterface
): Promise<UserTableInterface> {
  const normalizedTableName = String(tableData.tableName || '').trim();
  const normalizedPassword = String(tableData.password || '').trim();
  const normalizedMaxSeats = Math.min(6, Math.max(2, Number(tableData.maxSeats || 6)));
  const normalizedBotCount = Math.min(
    Math.max(0, Number(tableData.botCount || 0)),
    Math.max(0, normalizedMaxSeats - 1)
  );
  const normalizedTurnCountdown = Math.max(10, Number(tableData.turnCountdown || 20));
  const normalizedMinBet = Math.max(1, Number(tableData.minBet || 10));
  const normalizedAfterRoundCountdown = Math.max(5, Number(tableData.afterRoundCountdown || 10));
  const normalizedDiscardAndDrawTimeout = Math.max(10, Number(tableData.discardAndDrawTimeout || 20));
  const normalizedDurationHours = Math.max(
    PRIVATE_FRIEND_ROOM_MIN_DURATION_HOURS,
    Math.min(
      PRIVATE_FRIEND_ROOM_MAX_DURATION_HOURS,
      Number(tableData.durationHours || PRIVATE_FRIEND_ROOM_MIN_DURATION_HOURS)
    )
  );

  if (!normalizedTableName) {
    throw new Error('TABLE_NAME_REQUIRED');
  }

  if (normalizedPassword.length > 20) {
    throw new Error('TABLE_PASSWORD_TOO_LONG');
  }

  if (!Number.isInteger(normalizedDurationHours)) {
    throw new Error('INVALID_ROOM_DURATION');
  }

  if (tableData.id && tableData.id > 0) {
    const existingTable = await UserTable.findOne({
      where: {id: tableData.id, userId},
    });
    if (existingTable) {
      const updatedTable = await existingTable.update({
        game: tableData.game,
        tableName: normalizedTableName,
        maxSeats: normalizedMaxSeats,
        botCount: normalizedBotCount,
        password: normalizedPassword,
        turnCountdown: normalizedTurnCountdown,
        minBet: normalizedMinBet,
        afterRoundCountdown: normalizedAfterRoundCountdown,
        discardAndDrawTimeout: normalizedDiscardAndDrawTimeout,
      });
      return updatedTable.get({plain: true}) as UserTableInterface;
    } else {
      throw new Error(`UserTable with ID ${tableData.id} not found for user ${userId}`);
    }
  } else {
    return sequelize.transaction(async (transaction) => {
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

      const paidViaAllinGame = Boolean((tableData as { paidViaAllinGame?: boolean }).paidViaAllinGame);
      if (!paidViaAllinGame) {
        throw new Error('ALLIN_GAME_REQUIRED');
      }
      const burnAmount = 10000;
      const payload = tableData as UserTableInterface & { txHash?: string };
      const burnTxHash =
        typeof payload.txHash === 'string' && payload.txHash.trim() !== ''
          ? payload.txHash.trim()
          : null;

      const expiresAt = new Date(Date.now() + normalizedDurationHours * 60 * 60 * 1000);
      user.lifetime_burned = Number(user.lifetime_burned || 0) + burnAmount;
      await user.save({transaction});
      const currentAllinBalance = Number(user.allin_balance || 0);

      const createdTable = await UserTable.create(
        {
          userId,
          game: tableData.game,
          tableName: normalizedTableName,
          maxSeats: normalizedMaxSeats,
          botCount: normalizedBotCount,
          password: normalizedPassword,
          turnCountdown: normalizedTurnCountdown,
          minBet: normalizedMinBet,
          afterRoundCountdown: normalizedAfterRoundCountdown,
          discardAndDrawTimeout: normalizedDiscardAndDrawTimeout,
          roomType: 'private_friendly',
          expiresAt,
          burnAmount,
        },
        {transaction}
      );
      const burnReferenceId = `friend-room:${createdTable.id}`;

      const burnResult = { txHash: burnTxHash, actionId: null as string | null, mode: 'allin_game' as const };

      await PlayerLedger.create(
        {
          user_id: user.id,
          entry_type: 'private_room_create',
          asset: 'ALLIN',
          amount: -burnAmount,
          balance_after: currentAllinBalance,
          reference_id: burnReferenceId,
          metadata: {
            roomType: 'private_friendly',
            durationHours: normalizedDurationHours,
            burnAmount,
            expiresAt: expiresAt.toISOString(),
            txHash: burnResult.txHash,
            burnMode: burnResult.mode,
            burnedFrom: 'allin_game',
          },
        },
        {transaction}
      );

      await BurnRecord.create(
        {
          user_id: user.id,
          source_type: 'private_room_create',
          amount: burnAmount,
          reference_id: burnReferenceId,
          action_id: burnResult.actionId,
          tx_hash: burnResult.txHash,
          status: 'confirmed',
          confirmed_at: new Date(),
          metadata: {
            roomType: 'private_friendly',
            durationHours: normalizedDurationHours,
            expiresAt: expiresAt.toISOString(),
            burnMode: burnResult.mode,
          },
        },
        {transaction}
      );

      const snapshot = await EconomySnapshot.findOne({
        where: {snapshot_key: 'global'},
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (snapshot) {
        snapshot.allin_burned_total = Number(snapshot.allin_burned_total || 0) + burnAmount;
        await snapshot.save({transaction});
      }

      return createdTable.get({plain: true}) as UserTableInterface;
    });
  }
}

export async function getUserTables(
  userId: number
): Promise<UserTableInterface[]> {
  return UserTable.findAll({
    where: {
      userId: userId
    },
    raw: true,
    order: [['id', 'ASC']],
  });
}

export async function getUserTable(
  userId: number, tableId: number
): Promise<UserTableInterface | null> {
  return UserTable.findOne({
    where: {
      id: tableId,
      userId: userId,
    },
    raw: true,
  });
}

export async function getAllUsersTables(): Promise<UserTableInterface[]> {
  return UserTable.findAll({
    raw: true,
    order: [['id', 'ASC']],
  });
}

export const saveRefreshToken = async (userId: number, token: string, expiresInDays = 7) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  await RefreshToken.create({
    token,
    userId,
    expiresAt,
  });
};

export const findRefreshToken = async (token: string) => {
  return await RefreshToken.findOne({
    where: {token},
  });
};

export const deleteRefreshToken = async (token: string) => {
  return await RefreshToken.destroy({
    where: {token},
  });
};

export const cleanUpExpiredTokens = async () => {
  await RefreshToken.destroy({
    where: {
      expiresAt: {lt: new Date()},
    },
  });
};
