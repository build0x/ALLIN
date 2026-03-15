import {initializeDatabase} from './database/database';
import {Tournament} from './database/models/tournament';
import {TournamentRegistration} from './database/models/tournamentRegistration';
import {User} from './database/models/user';
import {
  buildTournamentView,
  fillTournamentWithBots,
  registerForTournament,
  seedAllinEconomy,
  syncTournamentRuntimeState,
} from './services/economyService';

const SINGLE_TOURNAMENT_SLUG = 'allin-championship';
const REQUIRED_PLAYERS = 60;

const pickHumanUser = async () => {
  const users = await User.findAll({
    where: {
      login_method: 'wallet',
    },
    order: [['id', 'ASC']],
  });

  const human = users.find((user) => Boolean(user.wallet_address));
  if (!human) {
    throw new Error('NO_WALLET_USER_FOR_PRESSURE_TEST');
  }

  return human;
};

const resetTournamentForPressureRun = async (tournament: Tournament) => {
  const editionKey = `pressure-${Date.now()}`;
  const now = new Date();

  tournament.status = 'scheduled';
  tournament.min_players = REQUIRED_PLAYERS;
  tournament.max_players = REQUIRED_PLAYERS;
  tournament.registration_opens_at = new Date(now.getTime() - 60 * 1000);
  tournament.starts_at = new Date(now.getTime() + 30 * 60 * 1000);
  tournament.finished_at = null;
  tournament.metadata = {
    ...(tournament.metadata || {}),
    currentEditionKey: editionKey,
    currentEditionState: null,
  };
  await tournament.save();

  return editionKey;
};

const normalizePlayerName = (entry: {
  username?: string | null;
  walletAddress?: string | null;
  userId: number;
}) => entry.username || entry.walletAddress || `用户${entry.userId}`;

const makePayloadPlayers = (
  tablePlayers: Array<{
    userId: number;
    username?: string | null;
    walletAddress?: string | null;
    seatNo?: number;
  }>,
  aliveUserIds: Set<number>,
  stackAmount: number
) =>
  tablePlayers.map((player, index) => {
    const isAlive = aliveUserIds.has(player.userId);
    return {
      userId: player.userId,
      playerId: Number(player.seatNo || index + 1),
      playerName: normalizePlayerName(player),
      currentStack: isAlive ? stackAmount : 0,
      playerMoney: isAlive ? stackAmount : 0,
      totalBet: 0,
      isFold: !isAlive,
      isAllIn: !isAlive,
      isDisconnected: false,
    };
  });

const assertCondition = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  await initializeDatabase();
  await seedAllinEconomy();

  const tournament = await Tournament.findOne({
    where: {
      slug: SINGLE_TOURNAMENT_SLUG,
    },
  });

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const editionKey = await resetTournamentForPressureRun(tournament);
  const humanUser = await pickHumanUser();

  humanUser.allin_balance = Math.max(Number(humanUser.allin_balance || 0), 2_000_000);
  await humanUser.save();

  await registerForTournament(humanUser.id, tournament.id);
  const fillResult = await fillTournamentWithBots(tournament.id, REQUIRED_PLAYERS - 1);
  assertCondition(fillResult.registrationCount === REQUIRED_PLAYERS, 'REGISTRATION_COUNT_NOT_60');

  const startedTournament = await Tournament.findByPk(tournament.id);
  const startedView = await buildTournamentView(startedTournament as Tournament, humanUser.id);

  assertCondition(startedView.status === 'active', 'TOURNAMENT_NOT_STARTED_AT_60');
  assertCondition(startedView.currentTableCount === 10, 'TOURNAMENT_TABLE_COUNT_NOT_10');
  assertCondition(
    startedView.currentTables.every((table) => Number(table.playerCount) === 6),
    'TABLES_NOT_FULLY_SEATED'
  );

  const firstStageSurvivors: Array<{tableNo: number; userId: number}> = [];
  for (const table of startedView.currentTables) {
    const survivor = table.players[0];
    firstStageSurvivors.push({tableNo: table.tableNo, userId: survivor.userId});
    await syncTournamentRuntimeState({
      tournamentId: tournament.id,
      editionKey,
      tableNo: table.tableNo,
      players: makePayloadPlayers(table.players, new Set([survivor.userId]), 1000),
      gameStarted: true,
      isResultsCall: true,
    });
  }

  const postKnockoutView = await buildTournamentView(startedTournament as Tournament, humanUser.id);
  assertCondition(postKnockoutView.currentTableCount === 10, 'POST_KNOCKOUT_TABLE_COUNT_INVALID');

  const eliminatedTables = firstStageSurvivors.slice(6);
  for (const entry of eliminatedTables) {
    await syncTournamentRuntimeState({
      tournamentId: tournament.id,
      editionKey,
      tableNo: entry.tableNo,
      players: [
        {
          userId: entry.userId,
          playerId: 1,
          playerName: `淘汰${entry.userId}`,
          currentStack: 0,
          playerMoney: 0,
          totalBet: 0,
          isFold: true,
          isAllIn: true,
          isDisconnected: false,
        },
      ],
      gameStarted: true,
      isResultsCall: true,
    });
  }

  const finalTableView = await buildTournamentView(startedTournament as Tournament, humanUser.id);
  assertCondition(finalTableView.currentTableCount === 1, 'FINAL_TABLE_NOT_COLLAPSED');
  assertCondition(finalTableView.currentTables[0]?.playerCount === 6, 'FINAL_TABLE_PLAYER_COUNT_INVALID');

  const championUserId = finalTableView.currentTables[0].players[0].userId;
  await syncTournamentRuntimeState({
    tournamentId: tournament.id,
    editionKey,
    tableNo: 1,
    players: makePayloadPlayers(finalTableView.currentTables[0].players, new Set([championUserId]), 1200),
    gameStarted: true,
    isResultsCall: true,
  });

  const settledTournament = await Tournament.findByPk(tournament.id);
  const settledView = await buildTournamentView(settledTournament as Tournament, humanUser.id);
  const settledRegistrations = await TournamentRegistration.findAll({
    where: {
      tournament_id: tournament.id,
      edition_key: editionKey,
    },
  });

  const top3 = [...settledRegistrations]
    .filter((item) => Number(item.final_rank || 0) >= 1 && Number(item.final_rank || 0) <= 3)
    .sort((left, right) => Number(left.final_rank || 99) - Number(right.final_rank || 99));

  assertCondition(settledView.status === 'scheduled', 'TOURNAMENT_NOT_RESET_AFTER_SETTLEMENT');
  assertCondition(
    String(settledView.currentEdition || '') !== editionKey,
    'CURRENT_EDITION_NOT_INCREMENTED'
  );
  assertCondition((settledView.historyTop3 || []).length > 0, 'HISTORY_TOP3_NOT_WRITTEN');
  assertCondition((settledView.leaderboard || []).length > 0, 'LEADERBOARD_NOT_WRITTEN');
  assertCondition(top3.length === 3, 'TOP3_NOT_PERSISTED');
  assertCondition(Number(top3[0].final_rank) === 1, 'CHAMPION_RANK_INVALID');

  console.log(
    JSON.stringify(
      {
        ok: true,
        tournamentId: tournament.id,
        testedEdition: editionKey,
        registrationCount: fillResult.registrationCount,
        startedStatus: startedView.status,
        startedTableCount: startedView.currentTableCount,
        collapsedTableCount: finalTableView.currentTableCount,
        nextEdition: settledView.currentEdition,
        historyCount: settledView.historyTop3?.length || 0,
        leaderboardCount: settledView.leaderboard?.length || 0,
        top3: top3.map((item) => ({
          userId: item.user_id,
          rank: item.final_rank,
          payoutBnb: item.payout_bnb,
          status: item.status,
        })),
      },
      null,
      2
    )
  );
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[tournamentPressureTest] failed:', error);
    process.exit(1);
  });
