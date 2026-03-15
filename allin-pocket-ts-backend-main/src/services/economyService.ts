import {Op} from 'sequelize';
import {allinConfig} from '../allinConfig';
import {EconomySnapshot} from '../database/models/economySnapshot';
import {Tournament} from '../database/models/tournament';
import {TournamentRegistration} from '../database/models/tournamentRegistration';
import {User} from '../database/models/user';
import {CashierRequest} from '../database/models/cashierRequest';
import {PlayerLedger} from '../database/models/playerLedger';
import {BurnRecord} from '../database/models/burnRecord';
import {UserTable} from '../database/models/userTables';
import {sequelize} from '../database/database';
import logger from '../logger';
import {payoutTournamentPrize, syncPrizePoolSnapshot} from './prizePoolService';
import {submitPendingWithdrawalRequests} from './onchainEconomyService';
import {
  getOnchainConfig,
  getWalletAllinBalance,
  isAllinTokenConfigured,
  isPrizePoolConfigured,
  isTreasuryConfigured,
} from './onchainConfigService';

const SINGLE_TOURNAMENT_CODE = 'allin-championship';
const SINGLE_TOURNAMENT_TITLE = 'ALLIN 总锦标赛';
const SINGLE_TOURNAMENT_BADGE = 'ALLIN CHAMPIONSHIP';
const SINGLE_TOURNAMENT_TABLE_SIZE = 6;
const SINGLE_TOURNAMENT_REQUIRED_HOLD = 1_000_000;
const SINGLE_TOURNAMENT_BUY_IN = 100_000;
const SINGLE_TOURNAMENT_BURN = 0;
const SINGLE_TOURNAMENT_MIN_PLAYERS = 60;
const SINGLE_TOURNAMENT_MAX_PLAYERS = 60;
const SINGLE_TOURNAMENT_STARTS_IN_MINUTES = 30;
const SINGLE_TOURNAMENT_PRIZE_SHARE = 0.3;
const SINGLE_TOURNAMENT_PRIZE_SPLITS = [0.5, 0.3, 0.2];
const SINGLE_TOURNAMENT_HISTORY_LIMIT = 12;
const SINGLE_TOURNAMENT_STARTING_STACK = 1000;
const TOURNAMENT_BLIND_INTERVAL_MINUTES = 10;
const TOURNAMENT_BLIND_LEVELS = [100, 150, 200, 300, 400, 600, 800];

type TournamentHistoryEntry = {
  editionKey: string;
  settledAt: string;
  prizePoolBnb: number;
  registrationCount: number;
  roundCount: number;
  top3: Array<{
    rank: number;
    userId: number;
    username: string | null;
    walletAddress: string | null;
    payoutBnb: number;
    txHash: string | null;
  }>;
};

type TournamentLeaderboardEntry = {
  userId: number;
  username: string | null;
  walletAddress: string | null;
  titles: number;
  top3Count: number;
  secondPlaceCount: number;
  thirdPlaceCount: number;
  totalPayoutBnb: number;
};

type TournamentRuntimeSyncPayload = {
  tournamentId: number;
  editionKey: string;
  tableNo: number;
  players: Array<{
    userId: number;
    playerId: number;
    playerName: string;
    currentStack: number;
    playerMoney: number;
    totalBet: number;
    isFold: boolean;
    isAllIn: boolean;
    isDisconnected: boolean;
  }>;
  gameStarted: boolean;
  isResultsCall: boolean;
};

type TournamentBlindLevel = {
  level: number;
  smallBlind: number;
  bigBlind: number;
  minBet: number;
};

const toNumber = (value: unknown) => Number(value || 0);
const roundValue = (value: number) => Number(value.toFixed(8));
const normalizeCashierAmount = (amount: number) => {
  const numeric = Number(amount || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('INVALID_EXCHANGE_AMOUNT');
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
const getEditionKey = (registration: TournamentRegistration) => registration.edition_key || 'edition-1';
const getCurrentEditionKey = (tournament: Tournament) =>
  String(tournament.metadata?.currentEditionKey || 'edition-1');
const getNextEditionKey = (editionKey: string) => {
  const match = String(editionKey).match(/(\d+)$/);
  const nextNumber = match ? Number(match[1]) + 1 : 2;
  return `edition-${nextNumber}`;
};
const countActiveRegistrations = (registrations: TournamentRegistration[], editionKey?: string) =>
  registrations.filter((registration) => {
    if (editionKey && getEditionKey(registration) !== editionKey) {
      return false;
    }

    return registration.status !== 'cancelled';
  }).length;
const getPlayableRegistrations = (registrations: TournamentRegistration[], editionKey: string) =>
  registrations.filter((registration) => {
    if (getEditionKey(registration) !== editionKey) {
      return false;
    }

    if (registration.status === 'cancelled') {
      return false;
    }

    return registration.final_rank === null || registration.final_rank === undefined;
  });
const shuffleArray = <T>(items: T[]) => {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
};
const buildPrizePreview = (snapshot?: EconomySnapshot | null) =>
  roundValue(toNumber(snapshot?.bnb_prize_pool) * SINGLE_TOURNAMENT_PRIZE_SHARE);
const buildPrizeDistribution = (prizePoolBnb: number) =>
  SINGLE_TOURNAMENT_PRIZE_SPLITS.map((share, index) => ({
    rank: index + 1,
    label: `第 ${index + 1} 名`,
    percent: share,
    amount: roundValue(prizePoolBnb * share),
  }));
const getFrozenPrizePoolBnb = (editionState?: Record<string, any> | null) =>
  roundValue(toNumber(editionState?.frozenPrizePoolBnb));
const getFrozenPrizeDistribution = (editionState?: Record<string, any> | null) => {
  const distribution = Array.isArray(editionState?.frozenPrizeDistribution)
    ? editionState?.frozenPrizeDistribution
    : null;

  if (!distribution?.length) {
    return null;
  }

  return distribution.map((entry: any, index: number) => ({
    rank: Number(entry?.rank || index + 1),
    label: String(entry?.label || `第 ${index + 1} 名`),
    percent: Number(entry?.percent || SINGLE_TOURNAMENT_PRIZE_SPLITS[index] || 0),
    amount: roundValue(toNumber(entry?.amount)),
  }));
};
const createTournamentBotWallet = (tournamentId: number, index: number) => {
  const hexSeed = (tournamentId * 1000 + index + 1).toString(16).padStart(40, '0');
  return `0x${hexSeed.slice(-40)}`;
};
const getHistoryEntries = (tournament: Tournament) =>
  Array.isArray(tournament.metadata?.historyTop3)
    ? (tournament.metadata?.historyTop3 as TournamentHistoryEntry[])
    : [];
const getCurrentEditionState = (tournament: Tournament) => {
  const state = tournament.metadata?.currentEditionState;

  if (typeof state === 'object' && state) {
    return state as Record<string, any>;
  }

  return null;
};
const buildTournamentBlindSchedule = (): TournamentBlindLevel[] =>
  TOURNAMENT_BLIND_LEVELS.map((bigBlind, index) => ({
    level: index + 1,
    smallBlind: bigBlind / 2,
    bigBlind,
    minBet: bigBlind,
  }));
const getBlindSchedule = (editionState?: Record<string, any> | null): TournamentBlindLevel[] => {
  const schedule = Array.isArray(editionState?.blindSchedule) ? editionState?.blindSchedule : null;

  if (!schedule?.length) {
    return buildTournamentBlindSchedule();
  }

  return schedule.map((entry: any, index: number) => {
    const bigBlind = Math.max(1, Number(entry?.bigBlind || entry?.minBet || TOURNAMENT_BLIND_LEVELS[index] || 100));
    return {
      level: Number(entry?.level || index + 1),
      smallBlind: Math.max(1, Number(entry?.smallBlind || bigBlind / 2)),
      bigBlind,
      minBet: Math.max(1, Number(entry?.minBet || bigBlind)),
    };
  });
};
const getBlindLevelIndex = (editionState?: Record<string, any> | null) => {
  const index = Number(editionState?.blindLevelIndex || 0);
  return Number.isFinite(index) && index >= 0 ? index : 0;
};
const getBlindState = (editionState?: Record<string, any> | null) => {
  const blindSchedule = getBlindSchedule(editionState);
  const maxIndex = Math.max(blindSchedule.length - 1, 0);
  const blindLevelIndex = Math.min(getBlindLevelIndex(editionState), maxIndex);
  const currentBlindLevel = blindSchedule[blindLevelIndex] || blindSchedule[0];
  const blindLevelStartedAt = editionState?.blindLevelStartedAt || null;
  const nextBlindAt = editionState?.nextBlindAt
    || (blindLevelStartedAt
      ? buildNextBlindAt(new Date(blindLevelStartedAt), blindLevelIndex, blindSchedule)
      : null);

  return {
    blindSchedule,
    blindLevelIndex,
    currentBlindLevel,
    currentMinBet: Number(editionState?.currentMinBet || currentBlindLevel.minBet),
    blindLevelStartedAt,
    nextBlindAt,
    blindIntervalMinutes: Number(editionState?.blindIntervalMinutes || TOURNAMENT_BLIND_INTERVAL_MINUTES),
  };
};
const buildNextBlindAt = (startedAt: Date, blindLevelIndex: number, blindSchedule: TournamentBlindLevel[]) =>
  blindLevelIndex >= blindSchedule.length - 1
    ? null
    : new Date(startedAt.getTime() + TOURNAMENT_BLIND_INTERVAL_MINUTES * 60 * 1000).toISOString();
const createInitialBlindState = () => {
  const blindSchedule = buildTournamentBlindSchedule();
  const startedAt = new Date();

  return {
    blindSchedule,
    blindLevelIndex: 0,
    currentMinBet: blindSchedule[0].minBet,
    blindLevelStartedAt: startedAt.toISOString(),
    nextBlindAt: buildNextBlindAt(startedAt, 0, blindSchedule),
    blindIntervalMinutes: TOURNAMENT_BLIND_INTERVAL_MINUTES,
  };
};
const progressBlindState = (editionState?: Record<string, any> | null, now = new Date()) => {
  const blindState = getBlindState(editionState);
  let didAdvance = false;
  let didInitialize = false;
  let blindLevelIndex = blindState.blindLevelIndex;
  let blindLevelStartedAt = blindState.blindLevelStartedAt
    ? new Date(blindState.blindLevelStartedAt)
    : now;
  let nextBlindAt = blindState.nextBlindAt ? new Date(blindState.nextBlindAt) : null;

  if (!blindState.blindLevelStartedAt) {
    didInitialize = true;
    blindLevelStartedAt = now;
    nextBlindAt = blindLevelIndex >= blindState.blindSchedule.length - 1
      ? null
      : new Date(now.getTime() + TOURNAMENT_BLIND_INTERVAL_MINUTES * 60 * 1000);
  }

  while (
    nextBlindAt &&
    blindLevelIndex < blindState.blindSchedule.length - 1 &&
    nextBlindAt.getTime() <= now.getTime()
  ) {
    didAdvance = true;
    blindLevelIndex += 1;
    blindLevelStartedAt = nextBlindAt;
    nextBlindAt =
      blindLevelIndex >= blindState.blindSchedule.length - 1
        ? null
        : new Date(nextBlindAt.getTime() + TOURNAMENT_BLIND_INTERVAL_MINUTES * 60 * 1000);
  }

  const currentBlindLevel = blindState.blindSchedule[blindLevelIndex] || blindState.currentBlindLevel;

  return {
    didAdvance,
    didInitialize,
    blindSchedule: blindState.blindSchedule,
    blindLevelIndex,
    currentBlindLevel,
    currentMinBet: currentBlindLevel.minBet,
    blindLevelStartedAt: blindLevelStartedAt.toISOString(),
    nextBlindAt: nextBlindAt ? nextBlindAt.toISOString() : null,
    blindIntervalMinutes: TOURNAMENT_BLIND_INTERVAL_MINUTES,
  };
};
const getRegistrationCurrentStack = (registration: TournamentRegistration) => {
  const rawCurrentStack = registration.metadata?.currentStack;

  if (rawCurrentStack === null || rawCurrentStack === undefined) {
    return SINGLE_TOURNAMENT_STARTING_STACK;
  }

  const parsedCurrentStack = Number(rawCurrentStack);
  return Number.isFinite(parsedCurrentStack) ? Math.max(0, parsedCurrentStack) : SINGLE_TOURNAMENT_STARTING_STACK;
};
const isRegistrationAlive = (registration: TournamentRegistration) =>
  registration.status !== 'cancelled' &&
  (registration.final_rank === null || registration.final_rank === undefined) &&
  getRegistrationCurrentStack(registration) > 0;
const buildEditionTables = async (
  registrations: TournamentRegistration[],
  usersMap?: Map<number, User>
) => {
  const aliveRegistrations = registrations
    .filter((registration) => isRegistrationAlive(registration) && Number(registration.table_no || 0) > 0)
    .sort((left, right) => {
      if (Number(left.table_no || 0) !== Number(right.table_no || 0)) {
        return Number(left.table_no || 0) - Number(right.table_no || 0);
      }

      return Number(left.seat_no || 0) - Number(right.seat_no || 0);
    });
  const localUsersMap = usersMap || (await getUsersMapFromRegistrations(aliveRegistrations));
  const tableMap = new Map<
    number,
    {
      tableNo: number;
      playerCount: number;
      players: Array<{
        userId: number;
        username: string | null;
        walletAddress: string | null;
        loginMethod: string | null;
        seatNo: number;
        status: string;
        currentStack: number;
      }>;
    }
  >();

  aliveRegistrations.forEach((registration) => {
    const tableNo = Number(registration.table_no || 0);
    if (!tableNo) {
      return;
    }

    const user = localUsersMap.get(registration.user_id);
    const currentTable = tableMap.get(tableNo) || {
      tableNo,
      playerCount: 0,
      players: [],
    };

    currentTable.players.push({
      userId: registration.user_id,
      username: user?.username || null,
      walletAddress: user?.wallet_address || null,
      loginMethod: user?.login_method || null,
      seatNo: Number(registration.seat_no || 0),
      status: registration.status,
      currentStack: getRegistrationCurrentStack(registration),
    });
    currentTable.playerCount = currentTable.players.length;
    tableMap.set(tableNo, currentTable);
  });

  return [...tableMap.values()].sort((left, right) => left.tableNo - right.tableNo);
};

const rebalanceAliveRegistrations = async (registrations: TournamentRegistration[]) => {
  if (registrations.length <= 1) {
    return {
      didRebalance: false,
      didCollapseToFinalTable: false,
    };
  }

  const currentTableNumbers = [
    ...new Set(registrations.map((registration) => Number(registration.table_no || 0)).filter(Boolean)),
  ];
  const orderedRegistrations = [...registrations].sort((left, right) => {
    const tableDiff = Number(left.table_no || 0) - Number(right.table_no || 0);
    if (tableDiff !== 0) {
      return tableDiff;
    }

    const seatDiff = Number(left.seat_no || 0) - Number(right.seat_no || 0);
    if (seatDiff !== 0) {
      return seatDiff;
    }

    return Number(left.user_id || 0) - Number(right.user_id || 0);
  });
  const targetTableCount = Math.max(
    1,
    Math.ceil(orderedRegistrations.length / SINGLE_TOURNAMENT_TABLE_SIZE)
  );
  let remainingPlayers = orderedRegistrations.length;
  let cursor = 0;
  let didRebalance = false;

  for (let tableIndex = 0; tableIndex < targetTableCount; tableIndex++) {
    const remainingTables = targetTableCount - tableIndex;
    const seatsAtTable = Math.ceil(remainingPlayers / remainingTables);

    for (let seatIndex = 0; seatIndex < seatsAtTable; seatIndex++) {
      const registration = orderedRegistrations[cursor];
      const nextTableNo = tableIndex + 1;
      const nextSeatNo = seatIndex + 1;
      const needsUpdate =
        Number(registration.table_no || 0) !== nextTableNo ||
        Number(registration.seat_no || 0) !== nextSeatNo ||
        registration.status !== 'active';

      if (needsUpdate) {
        registration.table_no = nextTableNo;
        registration.seat_no = nextSeatNo;
        registration.status = 'active';
        await registration.save();
        didRebalance = true;
      }

      cursor += 1;
    }

    remainingPlayers -= seatsAtTable;
  }

  return {
    didRebalance,
    didCollapseToFinalTable: targetTableCount === 1 && currentTableNumbers.length > 1,
  };
};

const assignPlayersToTables = async (
  registrations: TournamentRegistration[],
  usersMap?: Map<number, User>
) => {
  const shuffled = shuffleArray(registrations);
  const tables: Array<{
    tableNo: number;
    playerCount: number;
    players: Array<{
      userId: number;
      username: string | null;
      walletAddress: string | null;
      seatNo: number;
      status: string;
    }>;
  }> = [];

  for (let index = 0; index < shuffled.length; index++) {
    const registration = shuffled[index];
    const tableNo = Math.floor(index / SINGLE_TOURNAMENT_TABLE_SIZE) + 1;
    const seatNo = (index % SINGLE_TOURNAMENT_TABLE_SIZE) + 1;
    const user = usersMap?.get(registration.user_id);

    registration.table_no = tableNo;
    registration.seat_no = seatNo;
    registration.status = 'active';
    await registration.save();

    if (!tables[tableNo - 1]) {
      tables[tableNo - 1] = {
        tableNo,
        playerCount: 0,
        players: [],
      };
    }

    tables[tableNo - 1].players.push({
      userId: registration.user_id,
      username: user?.username || null,
      walletAddress: user?.wallet_address || null,
      seatNo,
      status: registration.status,
    });
    tables[tableNo - 1].playerCount = tables[tableNo - 1].players.length;
  }

  return tables.filter(Boolean);
};

const getCurrentEditionRegistrations = async (tournamentId: number, editionKey: string) =>
  TournamentRegistration.findAll({
    where: {
      tournament_id: tournamentId,
      edition_key: editionKey,
    },
    order: [['created_at', 'ASC']],
  });

const getUsersMapFromRegistrations = async (registrations: TournamentRegistration[]) => {
  const userIds = [...new Set(registrations.map((registration) => registration.user_id))];
  const users = userIds.length
    ? await User.findAll({
        where: {
          id: {
            [Op.in]: userIds,
          },
        },
      })
    : [];

  return new Map(users.map((user) => [user.id, user]));
};

export const buildTournamentLeaderboard = async (
  tournamentId: number
): Promise<TournamentLeaderboardEntry[]> => {
  const registrations = await TournamentRegistration.findAll({
    where: {
      tournament_id: tournamentId,
    },
    order: [['created_at', 'ASC']],
  });
  const podiumRegistrations = registrations.filter(
    (registration) =>
      registration.final_rank !== null &&
      registration.final_rank !== undefined &&
      Number(registration.final_rank) > 0 &&
      Number(registration.final_rank) <= 3
  );
  const usersMap = await getUsersMapFromRegistrations(podiumRegistrations);
  const leaderboard = new Map<number, TournamentLeaderboardEntry>();

  podiumRegistrations.forEach((registration) => {
    const user = usersMap.get(registration.user_id);
    const currentEntry = leaderboard.get(registration.user_id) || {
      userId: registration.user_id,
      username: user?.username || null,
      walletAddress: user?.wallet_address || null,
      titles: 0,
      top3Count: 0,
      secondPlaceCount: 0,
      thirdPlaceCount: 0,
      totalPayoutBnb: 0,
    };
    const finalRank = Number(registration.final_rank || 0);

    currentEntry.top3Count += 1;
    currentEntry.totalPayoutBnb = roundValue(
      currentEntry.totalPayoutBnb + toNumber(registration.payout_bnb)
    );

    if (finalRank === 1) {
      currentEntry.titles += 1;
    }
    if (finalRank === 2) {
      currentEntry.secondPlaceCount += 1;
    }
    if (finalRank === 3) {
      currentEntry.thirdPlaceCount += 1;
    }

    leaderboard.set(registration.user_id, currentEntry);
  });

  return [...leaderboard.values()].sort((left, right) => {
    if (right.titles !== left.titles) {
      return right.titles - left.titles;
    }
    if (right.top3Count !== left.top3Count) {
      return right.top3Count - left.top3Count;
    }
    if (right.totalPayoutBnb !== left.totalPayoutBnb) {
      return right.totalPayoutBnb - left.totalPayoutBnb;
    }

    return left.userId - right.userId;
  });
};

export const buildTournamentView = async (tournament: Tournament, userId?: number) => {
  const editionKey = getCurrentEditionKey(tournament);
  const [snapshot, registrations, registration, leaderboard] = await Promise.all([
    EconomySnapshot.findOne({where: {snapshot_key: 'global'}}),
    getCurrentEditionRegistrations(tournament.id, editionKey),
    userId
      ? TournamentRegistration.findOne({
          where: {
            tournament_id: tournament.id,
            user_id: userId,
            edition_key: editionKey,
          },
        })
      : null,
    buildTournamentLeaderboard(tournament.id),
  ]);
  const usersMap = await getUsersMapFromRegistrations(registrations);
  const currentTables = await buildEditionTables(registrations, usersMap);
  const historyTop3 = getHistoryEntries(tournament);
  const prizePoolBnb = buildPrizePreview(snapshot);
  const editionState = getCurrentEditionState(tournament);
  const blindState = getBlindState(editionState);
  const frozenPrizePoolBnb = getFrozenPrizePoolBnb(editionState);
  const frozenPrizeDistribution = getFrozenPrizeDistribution(editionState);
  const displayPrizePoolBnb = frozenPrizePoolBnb > 0 ? frozenPrizePoolBnb : prizePoolBnb;
  const displayPrizeDistribution = frozenPrizeDistribution || buildPrizeDistribution(displayPrizePoolBnb);

  return {
    id: tournament.id,
    slug: tournament.slug,
    tier: tournament.tier,
    title: tournament.title,
    status: tournament.status,
    requiredHoldAmount: toNumber(tournament.required_hold_amount),
    buyInAllin: toNumber(tournament.buy_in_allin),
    burnAmount: toNumber(tournament.burn_amount),
    bnbPrizeAmount: displayPrizePoolBnb,
    minPlayers: tournament.min_players,
    maxPlayers: tournament.max_players,
    registrationCount: countActiveRegistrations(registrations, editionKey),
    startsAt: tournament.starts_at,
    registrationOpensAt: tournament.registration_opens_at,
    finishedAt: tournament.finished_at,
    badge: String(tournament.metadata?.badge || SINGLE_TOURNAMENT_BADGE),
    currentEdition: editionKey,
    registrationStatus: registration?.status || null,
    prizePoolSharePercent: SINGLE_TOURNAMENT_PRIZE_SHARE * 100,
    prizeDistribution: displayPrizeDistribution,
    frozenPrizePoolBnb,
    frozenPrizeDistribution: frozenPrizeDistribution || [],
    tableSize: SINGLE_TOURNAMENT_TABLE_SIZE,
    currentRound: Number(editionState?.currentRound || 0),
    blindLevelIndex: blindState.blindLevelIndex,
    blindLevel: blindState.currentBlindLevel.level,
    blindSchedule: blindState.blindSchedule,
    currentMinBet: blindState.currentMinBet,
    currentSmallBlind: blindState.currentBlindLevel.smallBlind,
    currentBigBlind: blindState.currentBlindLevel.bigBlind,
    blindLevelStartedAt: blindState.blindLevelStartedAt,
    nextBlindAt: blindState.nextBlindAt,
    blindIntervalMinutes: blindState.blindIntervalMinutes,
    currentTableCount: currentTables.length,
    currentTables,
    latestResult: historyTop3[0] || null,
    historyTop3,
    leaderboard,
    metadata: tournament.metadata,
  };
};

export const getMyTournamentTableAssignment = async (userId: number, tournamentId?: number) => {
  const tournament = await Tournament.findOne({
    where: tournamentId
      ? {
          id: tournamentId,
          slug: SINGLE_TOURNAMENT_CODE,
        }
      : {
          slug: SINGLE_TOURNAMENT_CODE,
        },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const editionKey = getCurrentEditionKey(tournament);
  const registration = await TournamentRegistration.findOne({
    where: {
      tournament_id: tournament.id,
      user_id: userId,
      edition_key: editionKey,
    },
  });

  if (!registration || registration.status === 'cancelled') {
    throw new Error('TOURNAMENT_REGISTRATION_NOT_FOUND');
  }

  const user = await User.findOne({
    where: {
      id: userId,
    },
  });
  const editionState = getCurrentEditionState(tournament);
  const blindState = getBlindState(editionState);
  const assignedTable =
    Array.isArray(editionState?.tables) && Number(registration.table_no || 0) > 0
      ? editionState.tables.find((table: any) => Number(table.tableNo || 0) === Number(registration.table_no || 0))
      : null;

  return {
    tournamentId: tournament.id,
    tournamentTitle: tournament.title,
    editionKey,
    status: tournament.status,
    registrationStatus: registration.status,
    tableNo: Number(registration.table_no || 0),
    seatNo: Number(registration.seat_no || 0),
    currentStack: getRegistrationCurrentStack(registration),
    blindLevelIndex: blindState.blindLevelIndex,
    blindLevel: blindState.currentBlindLevel.level,
    currentMinBet: blindState.currentMinBet,
    currentSmallBlind: blindState.currentBlindLevel.smallBlind,
    currentBigBlind: blindState.currentBlindLevel.bigBlind,
    nextBlindAt: blindState.nextBlindAt,
    blindIntervalMinutes: blindState.blindIntervalMinutes,
    tableLabel:
      Number(registration.table_no || 0) > 0 ? `第 ${Number(registration.table_no || 0)} 桌` : null,
    canEnter:
      tournament.status === 'active' &&
      Number(registration.table_no || 0) > 0 &&
      ['registered', 'active'].includes(registration.status),
    player: {
      userId,
      username: user?.username || null,
      walletAddress: user?.wallet_address || null,
    },
    playersAtTable: assignedTable?.players || [],
  };
};

const startTournamentEdition = async (
  tournament: Tournament,
  registrations: TournamentRegistration[],
  triggerSource: string
) => {
  if (tournament.status !== 'scheduled' || registrations.length < tournament.min_players) {
    return;
  }

  const usersMap = await getUsersMapFromRegistrations(registrations);
  const tables = await assignPlayersToTables(registrations, usersMap);
  const editionKey = getCurrentEditionKey(tournament);
  const blindState = createInitialBlindState();
  const livePrizePool = await syncPrizePoolSnapshot();
  const snapshot = livePrizePool
    ? {bnb_prize_pool: livePrizePool.balanceBnb}
    : await EconomySnapshot.findOne({where: {snapshot_key: 'global'}});
  const frozenPrizePoolBnb = buildPrizePreview(snapshot as EconomySnapshot | null);
  const frozenPrizeDistribution = buildPrizeDistribution(frozenPrizePoolBnb);
  const frozenPrizeCapturedAt = new Date().toISOString();

  tournament.status = 'active';
  tournament.starts_at = new Date();
  tournament.metadata = {
    ...(tournament.metadata || {}),
    currentEditionState: {
      editionKey,
      currentRound: 1,
      nextEliminationRank: registrations.length,
      roundLogs: [
        {
          roundNumber: 1,
          action: 'start',
          tableCount: tables.length,
          playerCount: registrations.length,
          at: new Date().toISOString(),
          triggerSource,
        },
      ],
      tables,
      blindSchedule: blindState.blindSchedule,
      blindLevelIndex: blindState.blindLevelIndex,
      currentMinBet: blindState.currentMinBet,
      blindLevelStartedAt: blindState.blindLevelStartedAt,
      nextBlindAt: blindState.nextBlindAt,
      blindIntervalMinutes: blindState.blindIntervalMinutes,
      startTriggeredBy: triggerSource,
      frozenPrizePoolBnb,
      frozenPrizeDistribution,
      frozenPrizeCapturedAt,
    },
  };
  await tournament.save();
  logger.info(
    `Tournament ${tournament.slug} edition ${editionKey} started with ${registrations.length} players`
  );
};

const settleTournamentEdition = async (
  tournament: Tournament,
  registrations: TournamentRegistration[]
) => {
  const editionKey = getCurrentEditionKey(tournament);
  const currentEditionState = getCurrentEditionState(tournament) || {};
  const frozenPrizePoolBnb = getFrozenPrizePoolBnb(currentEditionState);
  const frozenPrizeDistribution = getFrozenPrizeDistribution(currentEditionState);
  const activeRegistrations = registrations.filter(
    (registration) =>
      getEditionKey(registration) === editionKey &&
      registration.status !== 'cancelled' &&
      registration.final_rank !== null &&
      registration.final_rank !== undefined &&
      Number(registration.final_rank) >= 1 &&
      Number(registration.final_rank) <= 3
  );

  if (!activeRegistrations.length) {
    tournament.status = 'scheduled';
    tournament.metadata = {
      ...(tournament.metadata || {}),
      currentEditionState: null,
      currentEditionKey: getNextEditionKey(editionKey),
    };
    tournament.registration_opens_at = new Date();
    tournament.starts_at = new Date(Date.now() + SINGLE_TOURNAMENT_STARTS_IN_MINUTES * 60 * 1000);
    await tournament.save();
    return;
  }

  const usersMap = await getUsersMapFromRegistrations(registrations);
  const snapshot = await EconomySnapshot.findOne({where: {snapshot_key: 'global'}});
  const totalPrizePool = frozenPrizePoolBnb > 0 ? frozenPrizePoolBnb : buildPrizePreview(snapshot);
  const payouts = frozenPrizeDistribution || buildPrizeDistribution(totalPrizePool);
  const orderedTopPlayers = [...activeRegistrations]
    .sort((left, right) => Number(left.final_rank || 99) - Number(right.final_rank || 99))
    .slice(0, Math.min(activeRegistrations.length, 3));
  const settledAt = new Date();
  const historyTop3: TournamentHistoryEntry['top3'] = [];

  for (let index = 0; index < orderedTopPlayers.length; index++) {
    const registration = orderedTopPlayers[index];
    const rank = index + 1;
    const payoutConfig = payouts[index];
    const payoutAmount = payoutConfig ? payoutConfig.amount : 0;
    const user = usersMap.get(registration.user_id);
    const payout = user?.wallet_address
      ? await payoutTournamentPrize(
          `${tournament.slug}:${editionKey}`,
          `${tournament.slug}:${editionKey}:rank:${rank}`,
          user.wallet_address,
          payoutAmount
        )
      : {txHash: null, mode: 'wallet_missing'};

    registration.status = rank === 1 ? 'winner' : 'settled';
    registration.payout_bnb = payoutAmount;
    registration.eliminated_at = settledAt;
    registration.metadata = {
      ...(registration.metadata || {}),
      payoutTxHash: payout.txHash,
      payoutMode: payout.mode,
    };
    await registration.save();

    if (user && payoutAmount > 0) {
      await PlayerLedger.create({
        user_id: user.id,
        entry_type: 'tournament_bnb_payout',
        asset: 'BNB',
        amount: payoutAmount,
        balance_after: 0,
        reference_id: `tournament:${tournament.id}:${editionKey}:rank:${rank}`,
        metadata: {
          txHash: payout.txHash,
          payoutMode: payout.mode,
          rank,
        },
      });
    }

    historyTop3.push({
      rank,
      userId: registration.user_id,
      username: user?.username || null,
      walletAddress: user?.wallet_address || null,
      payoutBnb: payoutAmount,
      txHash: payout.txHash || null,
    });
  }

  if (snapshot) {
    snapshot.bnb_prize_pool = Math.max(0, roundValue(toNumber(snapshot.bnb_prize_pool) - totalPrizePool));
    snapshot.reserved_bnb_prize_pool = 0;
    await snapshot.save();
  }

  const nextEditionKey = getNextEditionKey(editionKey);
  const previousHistory = getHistoryEntries(tournament);

  tournament.status = 'scheduled';
  tournament.finished_at = settledAt;
  tournament.registration_opens_at = settledAt;
  tournament.starts_at = new Date(Date.now() + SINGLE_TOURNAMENT_STARTS_IN_MINUTES * 60 * 1000);
  tournament.bnb_prize_amount = buildPrizePreview(snapshot);
  tournament.metadata = {
    ...(tournament.metadata || {}),
    currentEditionKey: nextEditionKey,
    currentEditionState: null,
    latestSettledEdition: editionKey,
    historyTop3: [
      {
        editionKey,
        settledAt: settledAt.toISOString(),
        prizePoolBnb: totalPrizePool,
        registrationCount: countActiveRegistrations(registrations, editionKey),
        roundCount: Array.isArray(currentEditionState?.roundLogs)
          ? currentEditionState.roundLogs.length
          : 0,
        top3: historyTop3,
      },
      ...previousHistory,
    ].slice(0, SINGLE_TOURNAMENT_HISTORY_LIMIT),
  };
  await tournament.save();
  logger.info(`Tournament ${tournament.slug} edition ${editionKey} settled`);
};

export const syncTournamentRuntimeState = async (payload: TournamentRuntimeSyncPayload) => {
  const tournament = await Tournament.findOne({
    where: {
      id: payload.tournamentId,
      slug: SINGLE_TOURNAMENT_CODE,
    },
  });

  if (!tournament || tournament.status !== 'active' || getCurrentEditionKey(tournament) !== payload.editionKey) {
    return null;
  }

  const registrations = await getCurrentEditionRegistrations(tournament.id, payload.editionKey);
  const currentEditionState = getCurrentEditionState(tournament) || {};
  let nextEliminationRank = Number(
    currentEditionState?.nextEliminationRank || registrations.length || 1
  );
  let eliminationOrderBase =
    registrations.filter(
      (registration) =>
        getEditionKey(registration) === payload.editionKey &&
        registration.elimination_order !== null &&
        registration.elimination_order !== undefined
    ).length || 0;
  const bustUsers: number[] = [];

  for (const snapshot of payload.players) {
    const registration = registrations.find((item) => item.user_id === snapshot.userId);

    if (!registration || registration.status === 'cancelled') {
      continue;
    }

    const currentStack = Math.max(0, Number(snapshot.currentStack || 0));
    registration.metadata = {
      ...(registration.metadata || {}),
      currentStack,
      lastRuntimeSyncAt: new Date().toISOString(),
      lastKnownTableNo: payload.tableNo,
    };

    if (registration.final_rank === null || registration.final_rank === undefined) {
      registration.status = currentStack > 0 ? 'active' : registration.status;
    }

    if (
      currentStack <= 0 &&
      (registration.final_rank === null || registration.final_rank === undefined) &&
      registration.status !== 'cancelled'
    ) {
      registration.final_rank = nextEliminationRank;
      registration.elimination_order = eliminationOrderBase + 1;
      registration.eliminated_at = new Date();
      registration.status = 'eliminated';
      registration.table_no = payload.tableNo;
      bustUsers.push(registration.user_id);
      nextEliminationRank = Math.max(1, nextEliminationRank - 1);
      eliminationOrderBase += 1;
    }

    await registration.save();
  }

  const refreshedRegistrations = await getCurrentEditionRegistrations(tournament.id, payload.editionKey);
  const aliveRegistrations = refreshedRegistrations.filter((registration) => isRegistrationAlive(registration));
  let didCollapseToFinalTable = false;
  let didRebalanceTables = false;
  let didSettle = false;

  if (aliveRegistrations.length === 1) {
    const champion = aliveRegistrations[0];

    champion.final_rank = 1;
    champion.status = 'winner';
    champion.table_no = 1;
    champion.seat_no = 1;
    champion.metadata = {
      ...(champion.metadata || {}),
      currentStack: getRegistrationCurrentStack(champion),
    };
    await champion.save();

    await settleTournamentEdition(tournament, refreshedRegistrations);
    didSettle = true;
  } else if (aliveRegistrations.length > 1) {
    const rebalanceResult = await rebalanceAliveRegistrations(aliveRegistrations);
    didCollapseToFinalTable = rebalanceResult.didCollapseToFinalTable;
    didRebalanceTables = rebalanceResult.didRebalance;
  }

  if (!didSettle) {
    const finalRegistrations = await getCurrentEditionRegistrations(tournament.id, payload.editionKey);
    const finalUsersMap = await getUsersMapFromRegistrations(finalRegistrations);
    const currentTables = await buildEditionTables(finalRegistrations, finalUsersMap);
    const nextRoundNumber = didRebalanceTables
      ? Number(currentEditionState?.currentRound || 1) + 1
      : Number(currentEditionState?.currentRound || 1);
    const nextRoundLogs = Array.isArray(currentEditionState?.roundLogs) ? currentEditionState.roundLogs : [];

    if (bustUsers.length || didRebalanceTables) {
      nextRoundLogs.push({
        roundNumber: nextRoundNumber,
        action: didCollapseToFinalTable ? 'final_table' : didRebalanceTables ? 'table_rebalance' : 'runtime_sync',
        tableCount: currentTables.length,
        playerCount: currentTables.reduce((sum, table) => sum + Number(table.playerCount || 0), 0),
        syncedTableNo: payload.tableNo,
        eliminatedUserIds: bustUsers,
        at: new Date().toISOString(),
      });
    }

    tournament.metadata = {
      ...(tournament.metadata || {}),
      currentEditionState: {
        ...(currentEditionState || {}),
        editionKey: payload.editionKey,
        currentRound: nextRoundNumber,
        nextEliminationRank,
        tables: currentTables,
        roundLogs: nextRoundLogs,
      },
    };
    await tournament.save();
    const nextBlindState = getBlindState(getCurrentEditionState(tournament));

    return {
      tournamentId: tournament.id,
      editionKey: payload.editionKey,
      currentTables,
      blindLevelIndex: nextBlindState.blindLevelIndex,
      blindLevel: nextBlindState.currentBlindLevel.level,
      currentMinBet: nextBlindState.currentMinBet,
      currentSmallBlind: nextBlindState.currentBlindLevel.smallBlind,
      currentBigBlind: nextBlindState.currentBlindLevel.bigBlind,
      nextBlindAt: nextBlindState.nextBlindAt,
      blindIntervalMinutes: nextBlindState.blindIntervalMinutes,
      didCollapseToFinalTable,
      didSettle,
    };
  }

  const finalBlindState = getBlindState(getCurrentEditionState(tournament));
  return {
    tournamentId: tournament.id,
    editionKey: payload.editionKey,
    currentTables: [],
    blindLevelIndex: finalBlindState.blindLevelIndex,
    blindLevel: finalBlindState.currentBlindLevel.level,
    currentMinBet: finalBlindState.currentMinBet,
    currentSmallBlind: finalBlindState.currentBlindLevel.smallBlind,
    currentBigBlind: finalBlindState.currentBlindLevel.bigBlind,
    nextBlindAt: finalBlindState.nextBlindAt,
    blindIntervalMinutes: finalBlindState.blindIntervalMinutes,
    didCollapseToFinalTable,
    didSettle,
  };
};

const ensureTournamentStartedWhenFull = async (
  tournament: Tournament,
  registrationCount: number,
  triggerSource: string
) => {
  if (tournament.status !== 'scheduled' || registrationCount < tournament.max_players) {
    return;
  }

  const editionKey = getCurrentEditionKey(tournament);
  const registrations = await getCurrentEditionRegistrations(tournament.id, editionKey);
  await startTournamentEdition(tournament, registrations, triggerSource);
};

export const seedAllinEconomy = async () => {
  let snapshot = await EconomySnapshot.findOne({where: {snapshot_key: 'global'}});

  if (!snapshot) {
    snapshot = await EconomySnapshot.create({
      snapshot_key: 'global',
      bnb_prize_pool: 12.5,
      reserved_bnb_prize_pool: 0,
      allin_burned_total: 0,
      active_cash_tables: allinConfig.cashTiers.length,
      active_tournaments: 1,
    });
  } else {
    snapshot.active_tournaments = 1;
    snapshot.reserved_bnb_prize_pool = 0;
    await snapshot.save();
  }

  const startsAt = new Date(Date.now() + SINGLE_TOURNAMENT_STARTS_IN_MINUTES * 60 * 1000);
  const exists = await Tournament.findOne({where: {slug: SINGLE_TOURNAMENT_CODE}});

  if (!exists) {
    await Tournament.create({
      slug: SINGLE_TOURNAMENT_CODE,
      tier: SINGLE_TOURNAMENT_CODE,
      title: SINGLE_TOURNAMENT_TITLE,
      status: 'scheduled',
      required_hold_amount: SINGLE_TOURNAMENT_REQUIRED_HOLD,
      buy_in_allin: SINGLE_TOURNAMENT_BUY_IN,
      burn_amount: SINGLE_TOURNAMENT_BURN,
      bnb_prize_amount: buildPrizePreview(snapshot),
      min_players: SINGLE_TOURNAMENT_MIN_PLAYERS,
      max_players: SINGLE_TOURNAMENT_MAX_PLAYERS,
      registration_opens_at: new Date(),
      starts_at: startsAt,
      metadata: {
        badge: SINGLE_TOURNAMENT_BADGE,
        currentEditionKey: 'edition-1',
        prizePoolSharePercent: SINGLE_TOURNAMENT_PRIZE_SHARE * 100,
        prizeDistribution: SINGLE_TOURNAMENT_PRIZE_SPLITS,
        historyTop3: [],
        currentEditionState: null,
      },
    });
    return;
  }

  exists.title = SINGLE_TOURNAMENT_TITLE;
  exists.tier = SINGLE_TOURNAMENT_CODE;
  exists.required_hold_amount = SINGLE_TOURNAMENT_REQUIRED_HOLD;
  exists.buy_in_allin = SINGLE_TOURNAMENT_BUY_IN;
  exists.burn_amount = SINGLE_TOURNAMENT_BURN;
  exists.bnb_prize_amount = buildPrizePreview(snapshot);
  exists.min_players = SINGLE_TOURNAMENT_MIN_PLAYERS;
  exists.max_players = SINGLE_TOURNAMENT_MAX_PLAYERS;
  exists.metadata = {
    ...(exists.metadata || {}),
    badge: SINGLE_TOURNAMENT_BADGE,
    currentEditionKey: String(exists.metadata?.currentEditionKey || 'edition-1'),
    prizePoolSharePercent: SINGLE_TOURNAMENT_PRIZE_SHARE * 100,
    prizeDistribution: SINGLE_TOURNAMENT_PRIZE_SPLITS,
    historyTop3: getHistoryEntries(exists),
    currentEditionState: exists.metadata?.currentEditionState || null,
  };

  if (exists.status === 'scheduled') {
    exists.registration_opens_at = exists.registration_opens_at || new Date();
    exists.starts_at = exists.starts_at || startsAt;
  }

  await exists.save();
};

export const cleanupLegacyCashTables = async () => {
  const baseTierNames = new Set(allinConfig.cashTiers.map((tier) => tier.title));
  const userTables = await UserTable.findAll({
    where: {
      game: 'HOLDEM',
    },
  });

  for (const table of userTables) {
    const tableName = String(table.tableName || '');
    const isLegacyExpandedTier =
      tableName.includes('-') || !baseTierNames.has(tableName);

    if (isLegacyExpandedTier && table.roomType !== 'private_friendly') {
      await table.destroy();
    }
  }
};

const PRIZE_POOL_SYNC_CACHE_MS = 30 * 1000; // 奖池链上同步结果缓存 30 秒，减少 RPC 调用
let lastPrizePoolSyncAt = 0;

export const getEconomyOverview = async (userId?: number) => {
  let snapshot = await EconomySnapshot.findOne({where: {snapshot_key: 'global'}});
  // 奖池从真实合约地址读取：配置了 PRIZE_POOL_VAULT_ADDRESS 时按缓存间隔同步链上余额
  if (snapshot && isPrizePoolConfigured()) {
    const now = Date.now();
    if (now - lastPrizePoolSyncAt >= PRIZE_POOL_SYNC_CACHE_MS) {
      await syncPrizePoolSnapshot();
      lastPrizePoolSyncAt = now;
      snapshot = await EconomySnapshot.findOne({where: {snapshot_key: 'global'}});
    }
  }
  const user = userId ? await User.findOne({where: {id: userId}}) : null;
  const onchainConfig = getOnchainConfig();

  return {
    chainId: allinConfig.wallet.chainId,
    prizePoolBnb: toNumber(snapshot?.bnb_prize_pool),
    reservedPrizePoolBnb: toNumber(snapshot?.reserved_bnb_prize_pool),
    availablePrizePoolBnb: Math.max(
      0,
      roundValue(toNumber(snapshot?.bnb_prize_pool) - toNumber(snapshot?.reserved_bnb_prize_pool))
    ),
    totalBurnedAllin: toNumber(snapshot?.allin_burned_total),
    activeCashTables: toNumber(snapshot?.active_cash_tables) || allinConfig.cashTiers.length,
    activeTournaments: 1,
    onchain: {
      enabled: isAllinTokenConfigured(),
      allinTokenAddress: onchainConfig.allinTokenAddress || null,
      treasuryVaultAddress: onchainConfig.treasuryVaultAddress || null,
      allinGameAddress: onchainConfig.allinGameAddress || null,
    },
    cashTiers: allinConfig.cashTiers,
    tournaments: await getTournamentList(userId),
    userWallet: user ? await buildUserWallet(user) : null,
  };
};

export const exchangeAllinToChips = async (userId: number, amount: number) => {
  const exchangeAmount = normalizeCashierAmount(amount);

  return sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: {
        id: userId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const currentAllinBalance = toNumber(user.allin_balance);
    const currentChipBalance = toNumber(user.money);

    if (currentAllinBalance < exchangeAmount) {
      throw new Error('INSUFFICIENT_ALLIN_BALANCE');
    }

    const nextAllinBalance = roundValue(currentAllinBalance - exchangeAmount);
    const nextChipBalance = roundValue(currentChipBalance + exchangeAmount);
    const referenceId = `cashier:exchange:${user.id}:${Date.now()}`;

    user.allin_balance = nextAllinBalance;
    user.money = nextChipBalance;
    await user.save({transaction});

    await PlayerLedger.create(
      {
        user_id: user.id,
        entry_type: 'allin_to_table_chips',
        asset: 'ALLIN',
        amount: -exchangeAmount,
        balance_after: nextAllinBalance,
        reference_id: referenceId,
        metadata: {
          direction: 'allin_to_table_chips',
          exchangeRate: 1,
        },
      },
      {transaction}
    );

    await PlayerLedger.create(
      {
        user_id: user.id,
        entry_type: 'allin_to_table_chips',
        asset: 'TABLE_CHIPS',
        amount: exchangeAmount,
        balance_after: nextChipBalance,
        reference_id: referenceId,
        metadata: {
          direction: 'allin_to_table_chips',
          exchangeRate: 1,
        },
      },
      {transaction}
    );

    return await buildUserWallet(user);
  });
};

/**
 * 换回：扣减筹码并直接由金库合约转 ALLIN 到用户链上钱包，不经过托管余额。
 */
export const redeemChipsToAllin = async (userId: number, amount: number) => {
  const exchangeAmount = normalizeCashierAmount(amount);

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

    const currentChipBalance = toNumber(user.money);
    if (currentChipBalance < exchangeAmount) {
      throw new Error('INSUFFICIENT_CHIP_BALANCE');
    }

    const nextChipBalance = roundValue(currentChipBalance - exchangeAmount);
    user.money = nextChipBalance;
    await user.save({transaction});

    const requestId = `withdrawal:${user.id}:${Date.now()}`;
    await CashierRequest.create(
      {
        user_id: user.id,
        wallet_address: user.wallet_address,
        direction: 'withdrawal',
        asset: 'ALLIN',
        amount: exchangeAmount,
        request_id: requestId,
        status: 'pending',
        metadata: {source: 'chips_redeem'},
      },
      {transaction}
    );

    const referenceId = `cashier:redeem:${user.id}:${Date.now()}`;
    await PlayerLedger.create(
      {
        user_id: user.id,
        entry_type: 'table_chips_to_allin',
        asset: 'TABLE_CHIPS',
        amount: -exchangeAmount,
        balance_after: nextChipBalance,
        reference_id: referenceId,
        metadata: {direction: 'chips_to_chain', exchangeRate: 1},
      },
      {transaction}
    );

    return await buildUserWallet(user);
  });

  if (isTreasuryConfigured()) {
    try {
      await submitPendingWithdrawalRequests(1);
    } catch (err: any) {
      logger.warn({err: err?.message}, 'redeemChipsToAllin: immediate submit failed, cron will retry');
    }
  }

  return result;
};

export const getTournamentList = async (userId?: number) => {
  const tournament = await Tournament.findOne({
    where: {
      slug: SINGLE_TOURNAMENT_CODE,
    },
    order: [['id', 'DESC']],
  });

  if (!tournament) {
    return [];
  }

  return [await buildTournamentView(tournament, userId)];
};

export const registerForTournament = async (
  userId: number,
  tournamentId: number,
  options?: { txHash?: string | null }
) => {
  const user = await User.findOne({where: {id: userId}});
  const tournament = await Tournament.findOne({
    where: {
      id: tournamentId,
      slug: SINGLE_TOURNAMENT_CODE,
    },
  });

  if (!user || !tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  if (!user.wallet_address) {
    throw new Error('WALLET_REQUIRED');
  }

  const buyInAllin = toNumber(tournament.buy_in_allin);
  const burnAmount = toNumber(tournament.burn_amount);
  const totalBurnFromUser = buyInAllin + burnAmount;
  const paidTxHash = options?.txHash && String(options.txHash).trim() ? String(options.txHash).trim() : null;

  // 前端已等链上确认再调后端时传入 txHash，此时不再做余额校验，避免后端 RPC/钱包不一致导致误拒
  if (!paidTxHash || totalBurnFromUser <= 0) {
    const walletAllinBalance = await getWalletAllinBalance(user.wallet_address);
    const requiredHoldAmount = toNumber(tournament.required_hold_amount);
    const totalNeed = totalBurnFromUser;
    if (walletAllinBalance < requiredHoldAmount) {
      throw new Error('INSUFFICIENT_HOLD_AMOUNT');
    }
    if (walletAllinBalance < totalNeed) {
      throw new Error('INSUFFICIENT_ALLIN_BALANCE');
    }
  }

  const walletAllinBalance = await getWalletAllinBalance(user.wallet_address).catch(() => 0);
  const editionKey = getCurrentEditionKey(tournament);

  const existingRegistration = await TournamentRegistration.findOne({
    where: {
      tournament_id: tournamentId,
      user_id: userId,
      edition_key: editionKey,
    },
  });

  if (existingRegistration && existingRegistration.status !== 'cancelled') {
    return existingRegistration;
  }

  if (tournament.status !== 'scheduled') {
    throw new Error('TOURNAMENT_REGISTRATION_CLOSED');
  }

  if (tournament.registration_opens_at && tournament.registration_opens_at.getTime() > Date.now()) {
    throw new Error('TOURNAMENT_REGISTRATION_NOT_OPEN');
  }

  const registrations = await TournamentRegistration.findAll({
    where: {
      tournament_id: tournamentId,
      edition_key: editionKey,
    },
  });
  const activeRegistrationCount = countActiveRegistrations(registrations, editionKey);

  if (activeRegistrationCount >= tournament.max_players) {
    await ensureTournamentStartedWhenFull(tournament, activeRegistrationCount, 'capacity_guard');
    throw new Error('TOURNAMENT_FULL');
  }

  const burnReferenceId = `tournament:${tournamentId}:${editionKey}:user:${userId}:${Date.now()}`;
  const onchainConfig = getOnchainConfig();
  if (totalBurnFromUser > 0 && !onchainConfig.allinGameAddress) {
    throw new Error('ALLIN_GAME_REQUIRED');
  }
  const burnResult =
    totalBurnFromUser > 0
      ? {
          txHash: paidTxHash ?? null,
          actionId: null as string | null,
          mode: 'allin_game' as const,
        }
      : null;
  // 不扣金库 allin_balance；仅更新累计燃烧统计（报名费+燃烧都算燃烧）
  user.lifetime_burned = toNumber(user.lifetime_burned) + totalBurnFromUser;
  await user.save();
  const vaultBalanceAfter = toNumber(user.allin_balance);

  const registration = existingRegistration
    ? await existingRegistration.update({
        status: 'registered',
        edition_key: editionKey,
        hold_amount_at_entry: walletAllinBalance,
        burn_amount: burnAmount,
        table_no: null,
        seat_no: null,
        elimination_order: null,
        eliminated_at: null,
        final_rank: null,
        payout_bnb: null,
        metadata: {
          ...(existingRegistration.metadata || {}),
          buyInAllin,
          currentStack: Number(existingRegistration.metadata?.currentStack || 0) || SINGLE_TOURNAMENT_STARTING_STACK,
          reRegisteredAt: new Date().toISOString(),
        },
      })
    : await TournamentRegistration.create({
        tournament_id: tournamentId,
        user_id: userId,
        status: 'registered',
        edition_key: editionKey,
        hold_amount_at_entry: walletAllinBalance,
        burn_amount: burnAmount,
        table_no: null,
        seat_no: null,
        elimination_order: null,
        eliminated_at: null,
        metadata: {
          buyInAllin,
          currentStack: SINGLE_TOURNAMENT_STARTING_STACK,
        },
      });

  await PlayerLedger.create({
    user_id: userId,
    entry_type: 'tournament_buy_in',
    asset: 'ALLIN',
    amount: -buyInAllin,
    balance_after: vaultBalanceAfter,
    reference_id: `tournament:${tournamentId}`,
    metadata: {
      tournamentId,
      buyInAllin,
      burnAmount,
      paidFrom: 'user_wallet',
    },
  });

  if (burnAmount > 0) {
    await PlayerLedger.create({
      user_id: userId,
      entry_type: 'tournament_burn',
      asset: 'ALLIN',
      amount: -burnAmount,
      balance_after: vaultBalanceAfter,
      reference_id: burnReferenceId,
      metadata: {
        tournamentId,
        editionKey,
        burnedFrom: 'user_wallet',
      },
    });
  }

  if (totalBurnFromUser > 0) {
    await BurnRecord.create({
      user_id: userId,
      source_type: 'tournament_registration',
      amount: totalBurnFromUser,
      reference_id: burnReferenceId,
      action_id: burnResult?.actionId ?? null,
      tx_hash: burnResult?.txHash ?? null,
      status: 'confirmed',
      confirmed_at: new Date(),
      metadata: {
        tournamentId,
        editionKey,
        buyInAllin,
        burnAmount,
        burnMode: burnResult?.mode ?? 'mock',
      },
    });
  }

  const snapshot = await EconomySnapshot.findOne({where: {snapshot_key: 'global'}});
  if (snapshot && totalBurnFromUser > 0) {
    snapshot.allin_burned_total = toNumber(snapshot.allin_burned_total) + totalBurnFromUser;
    await snapshot.save();
  }

  await ensureTournamentStartedWhenFull(tournament, activeRegistrationCount + 1, `user:${userId}`);

  return registration;
};

export const fillTournamentWithBots = async (tournamentId: number, requestedCount?: number) => {
  const tournament = await Tournament.findOne({
    where: {
      id: tournamentId,
      slug: SINGLE_TOURNAMENT_CODE,
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  if (tournament.status !== 'scheduled') {
    throw new Error('TOURNAMENT_REGISTRATION_CLOSED');
  }

  const registrations = await TournamentRegistration.findAll({
    where: {
      tournament_id: tournamentId,
      edition_key: getCurrentEditionKey(tournament),
    },
  });
  const currentEditionKey = getCurrentEditionKey(tournament);
  const activeRegistrationCount = countActiveRegistrations(registrations, currentEditionKey);
  const availableSeats = Math.max(0, tournament.max_players - activeRegistrationCount);

  if (availableSeats <= 0) {
    await ensureTournamentStartedWhenFull(tournament, activeRegistrationCount, 'bot_fill_capacity_guard');
    return {
      addedBotUserIds: [],
      registrationCount: activeRegistrationCount,
      maxPlayers: tournament.max_players,
      status: tournament.status,
    };
  }

  const fillCount =
    requestedCount && requestedCount > 0 ? Math.min(requestedCount, availableSeats) : availableSeats;
  const addedBotUserIds: number[] = [];
  const requiredHoldAmount = toNumber(tournament.required_hold_amount);
  const buyInAllin = toNumber(tournament.buy_in_allin);
  const targetBalance = Math.max(requiredHoldAmount + buyInAllin + 1, buyInAllin * 3, 1_100_001);

  for (let index = 0; index < fillCount; index++) {
    const suffix = `${tournamentId}_${activeRegistrationCount + index + 1}`;
    const username = `tourbot_${suffix}`;
    const walletAddress = createTournamentBotWallet(tournamentId, activeRegistrationCount + index);
    let botUser = await User.findOne({
      where: {
        username,
      },
    });

    if (!botUser) {
      botUser = await User.create({
        username,
        avatar_icon: '♣',
        email: `${username}@allin.bot`,
        password: null,
        wallet_address: walletAddress,
        login_method: 'bot',
        money: 1000,
        allin_balance: targetBalance,
      });
    } else {
      botUser.wallet_address = botUser.wallet_address || walletAddress;
      botUser.login_method = 'bot';
      botUser.allin_balance = Math.max(toNumber(botUser.allin_balance), targetBalance);
      await botUser.save();
    }

    const existingRegistration = await TournamentRegistration.findOne({
      where: {
        tournament_id: tournamentId,
        user_id: botUser.id,
        edition_key: currentEditionKey,
      },
    });
    if (existingRegistration && existingRegistration.status !== 'cancelled') {
      continue;
    }

    await registerForTournament(botUser.id, tournamentId);
    addedBotUserIds.push(botUser.id);
  }

  const updatedTournament = await Tournament.findOne({
    where: {
      id: tournamentId,
    },
  });
  const updatedRegistrations = await TournamentRegistration.findAll({
    where: {
      tournament_id: tournamentId,
      edition_key: currentEditionKey,
    },
  });
  const finalRegistrationCount = countActiveRegistrations(updatedRegistrations, currentEditionKey);

  return {
    addedBotUserIds,
    registrationCount: finalRegistrationCount,
    maxPlayers: updatedTournament?.max_players || tournament.max_players,
    status: updatedTournament?.status || tournament.status,
  };
};

export const createCashTierTableForUser = async (userId: number, tierCode: string) => {
  const user = await User.findOne({where: {id: userId}});
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const tier = allinConfig.cashTiers.find((item) => item.code === tierCode);
  if (!tier) {
    throw new Error('CASH_TIER_NOT_FOUND');
  }

  const holdAmount = await getWalletAllinBalance(user.wallet_address);
  if (holdAmount < tier.minHoldAmount) {
    throw new Error('INSUFFICIENT_HOLD_AMOUNT');
  }

  return {
    id: -1,
    game: 'HOLDEM' as const,
    tableName: `${tier.title}`,
    password: '',
    maxSeats: tier.maxSeats,
    botCount: ['bronze', 'silver'].includes(tier.code) ? tier.botCount : 0,
    turnCountdown: tier.turnCountdown,
    minBet: tier.minBet,
    afterRoundCountdown: tier.afterRoundCountdown,
    discardAndDrawTimeout: 0,
  };
};

export const progressTournamentLifecycle = async () => {
  const now = new Date();
  const tournament = await Tournament.findOne({
    where: {
      slug: SINGLE_TOURNAMENT_CODE,
    },
  });

  if (!tournament) {
    return;
  }

  const editionKey = getCurrentEditionKey(tournament);
  const registrations = await getCurrentEditionRegistrations(tournament.id, editionKey);
  const activeRegistrationCount = countActiveRegistrations(registrations, editionKey);

  if (tournament.status === 'scheduled' && tournament.starts_at && tournament.starts_at <= now) {
    if (activeRegistrationCount >= tournament.max_players) {
      await startTournamentEdition(tournament, registrations, 'schedule');
    } else {
      tournament.starts_at = new Date(Date.now() + 15 * 60 * 1000);
      tournament.metadata = {
        ...(tournament.metadata || {}),
        delayedReason: 'not_full',
        delayedAt: new Date().toISOString(),
      };
      await tournament.save();
    }
    return;
  }

  if (tournament.status !== 'active') {
    return;
  }

  const editionState = getCurrentEditionState(tournament);
  const blindProgress = progressBlindState(editionState, now);

  if (blindProgress.didAdvance || blindProgress.didInitialize) {
    const nextRoundLogs = Array.isArray(editionState?.roundLogs) ? [...editionState.roundLogs] : [];
    if (blindProgress.didAdvance) {
      nextRoundLogs.push({
        roundNumber: Number(editionState?.currentRound || 1),
        action: 'blind_level_up',
        blindLevel: blindProgress.currentBlindLevel.level,
        minBet: blindProgress.currentMinBet,
        at: now.toISOString(),
      });
    }

    tournament.metadata = {
      ...(tournament.metadata || {}),
      currentEditionState: {
        ...(editionState || {}),
        blindSchedule: blindProgress.blindSchedule,
        blindLevelIndex: blindProgress.blindLevelIndex,
        currentMinBet: blindProgress.currentMinBet,
        blindLevelStartedAt: blindProgress.blindLevelStartedAt,
        nextBlindAt: blindProgress.nextBlindAt,
        blindIntervalMinutes: blindProgress.blindIntervalMinutes,
        roundLogs: nextRoundLogs,
      },
    };
    await tournament.save();
  }
};
