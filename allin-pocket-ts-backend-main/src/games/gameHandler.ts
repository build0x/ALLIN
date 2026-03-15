import {
  AchievementDefinition,
  AuthInterface,
  ClientResponse,
  GameHandlerInterface,
  PlayerInterface,
  RanksInterface,
  UserTableInterface
} from '../interfaces';
import WebSocket from 'ws';
import {HoldemTable} from './holdem/holdemTable';
import {FiveCardDrawTable} from './fiveCardDraw/fiveCardDrawTable';
import {BottleSpinTable} from './bottleSpin/bottleSpinTable';
import {Player} from '../player';
import {ClientMessageKey} from '../types';
import logger from '../logger';
import {gameConfig} from '../gameConfig';
import {
  authenticate,
  createMockWebSocket,
  findTableByDatabaseId,
  generatePlayerName, generateRefreshToken,
  generateToken,
  getPlayerCount,
  getRandomInt,
  getRandomBotName,
  isPlayerInTable,
  sendClientNotification, verifyRefreshToken,
} from '../utils';
import {User} from '../database/models/user';
import bcrypt from 'bcrypt';
import EventEmitter from 'events';
import {MAX_MESSAGE_LENGTH, MESSAGE_COOLDOWN_MS, NEW_BOT_EVENT_KEY, NEW_PLAYER_STARTING_FUNDS} from '../constants';
import {Achievement} from '../database/models/achievement';
import {HoldemBot} from './holdem/holdemBot';
import {FiveCardDrawBot} from './fiveCardDraw/fiveCardDrawBot';
import {BottleSpinBot} from './bottleSpin/bottleSpinBot';
import {
  cleanUpExpiredTokens,
  createUpdateUserTable,
  findRefreshToken,
  getDailyAverageStats,
  getRankings,
  getUserTable,
  getUserTables,
  saveRefreshToken
} from '../database/queries';
import {getPublicChatMessages, handlePublicChatMessage} from '../publicChat';
import {getAchievementDefinitionById} from '../achievementDefinitions';
import leoProfanity from 'leo-profanity';
import {schedule} from 'node-cron';
import {createWalletNonce, verifyWalletLogin} from '../services/walletAuthService';
import {
  createCashTierTableForUser,
  cleanupLegacyCashTables,
  exchangeAllinToChips,
  getEconomyOverview,
  getMyTournamentTableAssignment,
  getTournamentList,
  redeemChipsToAllin,
  registerForTournament,
  syncTournamentRuntimeState,
} from '../services/economyService';
import {allinConfig} from '../allinConfig';
import {UserTable} from '../database/models/userTables';
import {Op} from 'sequelize';
import {
  confirmDepositByTxHash,
  requestAllinWithdrawal,
  runOnchainReconciliationCycle,
} from '../services/onchainEconomyService';
import {getWalletAllinBalance} from '../services/onchainConfigService';

leoProfanity.loadDictionary('en');

let playerIdIncrement = 0;
const players = new Map<WebSocket, Player>();
const tables = new Map<number, FiveCardDrawTable | HoldemTable | BottleSpinTable>();
const ALLOWED_AVATAR_ICONS = [
  'joker',
  'emoji-heart',
  'emoji-diamond',
  'emoji-club',
  'emoji-ace',
  'emoji-crown',
  'emoji-shark',
  'emoji-dragon',
  'emoji-spade',
  'emoji-star',
  'emoji-fire',
  'emoji-rocket',
  'emoji-gem',
  'emoji-clover',
  'emoji-coin',
  'emoji-bull',
  'emoji-tiger',
  'emoji-fox',
  'emoji-wolf',
  'emoji-robot',
  '♠',
  '♥',
  '♦',
  '♣',
  '🂡',
  '👑',
  '🦈',
  '🐉',
  '⭐',
  '🔥',
  '🚀',
  '💎',
  '🍀',
  '🪙',
  '🐂',
  '🐯',
  '🦊',
  '🐺',
  '🤖',
];
const ALLOWED_AVATAR_THEMES = [
  'gold',
  'sunset',
  'ocean',
  'jade',
  'violet',
  'rose',
  'obsidian',
  'mint',
];
const AVATAR_VALUE_SEPARATOR = '::';
const TOURNAMENT_RUNTIME_TABLES = new Map<string, number>();
const TOURNAMENT_STARTING_STACK = 1000;
const TOURNAMENT_SYNC_IN_PROGRESS = new Set<string>();
const isValidRequestedAvatar = (requestedAvatar: string): boolean => {
  if (!requestedAvatar) {
    return false;
  }

  const [avatarId, themeId] = requestedAvatar.split(AVATAR_VALUE_SEPARATOR);
  if (!ALLOWED_AVATAR_ICONS.includes(avatarId)) {
    return false;
  }

  if (!requestedAvatar.includes(AVATAR_VALUE_SEPARATOR)) {
    return true;
  }

  return ALLOWED_AVATAR_THEMES.includes(themeId);
};

const getRealtimeChipBalance = (user: User, player?: Player) => {
  if (
    player &&
    !player.isBot &&
    player.playerDatabaseId > 0 &&
    Number(player.playerDatabaseId) === Number(user.id)
  ) {
    return Number(player.playerMoney || 0);
  }

  return Number(user.money || 0);
};
const buildUserStatsPayload = async (user: User, player?: Player) => {
  const walletAllinBalance = await getWalletAllinBalance(user.wallet_address);

  return {
    username: user.username || user.wallet_address || '',
    avatarIcon: user.avatar_icon || 'joker',
    money: getRealtimeChipBalance(user, player),
    winCount: user.win_count,
    loseCount: user.lose_count,
    xp: user.xp,
    walletAddress: user.wallet_address,
    allinBalance: walletAllinBalance,
    walletAllinBalance,
    vaultAllinBalance: Number(user.allin_balance || 0),
    holdAmount: walletAllinBalance,
    lifetimeBurned: Number(user.lifetime_burned || 0),
  };
};
const getCashierErrorMessage = (message: string) => {
  switch (message) {
    case 'USER_NOT_FOUND':
      return '用户不存在';
    case 'INVALID_EXCHANGE_AMOUNT':
      return '请输入大于 0 的数量';
    case 'AMOUNT_MUST_BE_INTEGER':
      return '当前仅支持整数数量';
    case 'INSUFFICIENT_ALLIN_BALANCE':
      return '代币余额不足';
    case 'INSUFFICIENT_HOLD_AMOUNT':
      return '钱包链上持仓不足';
    case 'INSUFFICIENT_CHIP_BALANCE':
      return '筹码余额不足';
    case 'LEAVE_TABLE_BEFORE_CASHIER':
      return '请先离开当前牌桌再操作';
    default:
      return message || '兑换失败';
  }
};
const getUserTableErrorMessage = (message: string) => {
  switch (message) {
    case 'USER_NOT_FOUND':
      return '用户不存在';
    case 'TABLE_NOT_FOUND':
      return '房间不存在';
    case 'INVALID_TABLE_NAME':
      return '房间名称长度需在 2 到 20 个字符之间';
    case 'INVALID_MIN_BET':
      return '最低下注金额必须大于 0';
    case 'INVALID_ROOM_DURATION':
      return '房间时长仅支持 1 到 24 小时的整数';
    case 'INSUFFICIENT_ALLIN_BALANCE':
      return '钱包 ALLIN 不足，无法支付所选房间时长的燃烧费用';
    case 'ALLOWANCE_REQUIRED':
      return '请先在钱包中授权 ALLIN 后再创建房间；若刚更新过合约，请刷新页面后重新点击创建';
    default:
      return message || '创建房间失败';
  }
};

export const removeRuntimeUserTableByDatabaseId = (
  targetDatabaseId: number,
  closeMessage = '该亲友房已被后台删除'
) => {
  const runtimeTable = findTableByDatabaseId(tables, Number(targetDatabaseId));
  if (!runtimeTable) {
    return false;
  }

  const runtimePlayers = [
    ...((runtimeTable as HoldemTable).players || []),
    ...((runtimeTable as HoldemTable).playersToAppend || []),
    ...((runtimeTable as HoldemTable).spectators || []),
  ].filter((tablePlayer) => tablePlayer && !tablePlayer.isBot);

  runtimePlayers.forEach((tablePlayer) => {
    tablePlayer.selectedTableId = -1;
    sendClientNotification(
      tablePlayer.socket,
      'clientMessage',
      closeMessage,
      'PRIVATE_ROOM_CLOSED'
    );
  });

  if (typeof (runtimeTable as HoldemTable).clearTimers === 'function') {
    (runtimeTable as HoldemTable).clearTimers();
  }

  tables.delete(runtimeTable.tableId);
  return true;
};

class GameHandler implements GameHandlerInterface {
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.on(NEW_BOT_EVENT_KEY, this.onAppendBot.bind(this));

    schedule('0 * * * *', () => {
      const botsToDelete: WebSocket[] = [];
      for (const [ws, player] of players) {
        if (player.isBot && player.selectedTableId === -1) {
          botsToDelete.push(ws);
        }
      }
      botsToDelete.forEach((ws: any) => players.delete(ws));
    });

    setInterval(() => {
      void this.cleanupExpiredPrivateRooms();
    }, 15000);

    setInterval(() => {
      void this.refreshActiveTournamentRuntimeTables();
    }, 30000);
  }

  async createStartingTables(): Promise<void> {
    try {
      const holdEmCount = gameConfig.games.holdEm.startingTables;
      Array.from({length: holdEmCount}).forEach((_, index: number) => {
        const botCount = gameConfig.games.holdEm.bot.botCounts[index];
        const startMoney = gameConfig.games.holdEm.startMoney;
        this.createGameTable(index, HoldemTable, botCount, startMoney, index);
      });
      const fiveCardDrawCount = gameConfig.games.fiveCardDraw.startingTables;
      Array.from({length: fiveCardDrawCount}).forEach((_, index: number) => {
        const roomNumber = holdEmCount + index;
        const botCount = gameConfig.games.holdEm.bot.botCounts[index];
        const startMoney = gameConfig.games.holdEm.startMoney;
        this.createGameTable(roomNumber, FiveCardDrawTable, botCount, startMoney);
      });
      const bottleSpinCount = gameConfig.games.bottleSpin.startingTables;
      Array.from({length: bottleSpinCount}).forEach((_, index: number) => {
        const roomNumber = holdEmCount + fiveCardDrawCount + index;
        const botCount = gameConfig.games.bottleSpin.bot.botCounts[index];
        const startMoney = gameConfig.games.bottleSpin.startMoney;
        this.createGameTable(roomNumber, BottleSpinTable, botCount, startMoney);
      });
      await cleanupLegacyCashTables();
    } catch (error: any) {
      logger.fatal(`Create starting tables failed: ${error}`);
      throw new Error(error);
    }
  }

  onConnection(socket: WebSocket): void {
    const playerId = playerIdIncrement;
    const player = new Player(socket, playerId, gameConfig.games.holdEm.startMoney, false, generatePlayerName(playerId));
    playerIdIncrement++;
    players.set(socket, player);
    socket.send(JSON.stringify({
      key: 'connected',
      data: {playerId: playerId, playerName: player.playerName}
    } as ClientResponse));
    logger.info(`New client connection player id ${playerId} and name ${player.playerName}`);
  }

  onMessage(socket: WebSocket, msg: string): void {
    try {
      const message = JSON.parse(msg.toString());
      // noinspection JSIgnoredPromiseFromCall
      this.messageHandler(socket, message);
    } catch (error) {
      logger.fatal(`☣️  Someone sent something unexpected: ${msg.toString()}`);
    }
  }

  onClientDisconnected(socket: WebSocket) {
    const player = players.get(socket);
    if (player) {
      const currentTable = tables.get(player.selectedTableId);
      if (currentTable instanceof HoldemTable && currentTable.tournamentContext) {
        player.socket = null;
        currentTable.sendStatusUpdate();
      }
    }
    players.delete(socket);
    logger.info('Client disconnected');
  }

  onError(): void {
    throw new Error('Method not implemented.');
  }

  onClose(): void {
    throw new Error('Method not implemented.');
  }

  private async messageHandler(socket: WebSocket, message: {
    key: ClientMessageKey;
    tableId: number;
    tableSortParam: string;
    cardsToDiscard: string[];
    username: string;
    email: string;
    password: string;
    token: string;
    walletAddress: string;
    signature: string;
    tournamentId: number;
    tierCode: string;
  } | any): Promise<void> {
    let tableId: number = -1;
    let table: FiveCardDrawTable | HoldemTable | BottleSpinTable | undefined = undefined;
    let player: Player | undefined = undefined;
    let cardsToDiscard: string[] = [];
    switch (message.key as ClientMessageKey) {
      case 'getPublicLobbyStats': {
        try {
          const economy = await getEconomyOverview(undefined);
          socket.send(
            JSON.stringify({
              key: 'publicLobbyStats',
              data: {
                prizePoolBnb: economy?.prizePoolBnb ?? 0,
                totalPlayers: getPlayerCount(players),
                totalGames: tables.size,
              },
            } as ClientResponse)
          );
        } catch (err: any) {
          socket.send(
            JSON.stringify({
              key: 'publicLobbyStats',
              data: {
                prizePoolBnb: 0,
                totalPlayers: getPlayerCount(players),
                totalGames: tables.size,
              },
            } as ClientResponse)
          );
        }
        break;
      }
      case 'getTables':
        const tableSortParam: string = message.tableSortParam || 'all';
        const tableParams: ClientResponse = {key: 'getTables', data: {tables: []}}
        tables.forEach((table: HoldemTable | FiveCardDrawTable | BottleSpinTable) => {
          tableParams.data.tables?.push(table.getTableInfo());
        });
        tableParams.data.stats = {
          totalGames: tables.size,
          totalBots: getPlayerCount(players, true),
          totalPlayers: getPlayerCount(players),
        }
        socket.send(JSON.stringify(tableParams));
        break;
      case 'selectTable':
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        if (table) {
          if (table.tablePassword.length > 0 && message.password !== table.tablePassword) {
            const response: ClientResponse = {
              key: 'invalidTablePassword',
              data: {
                translationKey: 'INVALID_TABLE_PASSWORD',
                success: false,
              }
            };
            socket.send(JSON.stringify(response));
          } else {
            const player: Player | undefined = players.get(socket);
            if (player && (table.players.length + table.playersToAppend.length) < table.maxSeats) {
              this.joinPlayerToTable(socket, player, table, 'selectTable');
            } else {
              logger.warn(`Table ${tableId} is already full!`);
            }
          }
        }
        break;
      case 'selectSpectateTable':
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        player = players.get(socket);
        if (table && player) {
          if (table.tablePassword.length > 0 && message.password !== table.tablePassword) {
            const response: ClientResponse = {
              key: 'invalidTablePassword',
              data: {
                translationKey: 'INVALID_TABLE_PASSWORD',
                success: false,
              }
            };
            socket.send(JSON.stringify(response));
          } else {
            if (table instanceof HoldemTable && table.tournamentContext) {
              const auth: AuthInterface = authenticate(socket, message);
              if (!auth.success) {
                socket.send(JSON.stringify({
                  key: 'selectSpectateTable',
                  data: {
                    success: false,
                    message: 'TOURNAMENT_SPECTATE_NOT_ALLOWED',
                    translationKey: 'TOURNAMENT_SPECTATE_NOT_ALLOWED',
                  }
                } as ClientResponse));
                break;
              }

              const tournaments = await getTournamentList(auth.userId);
              const tournament = tournaments.find(
                (item) =>
                  table instanceof HoldemTable &&
                  Number(item.id) === Number(table.tournamentContext?.tournamentId)
              );
              const registrationStatus = tournament?.registrationStatus || null;

              if (registrationStatus && registrationStatus !== 'eliminated') {
                socket.send(JSON.stringify({
                  key: 'selectSpectateTable',
                  data: {
                    success: false,
                    message: 'TOURNAMENT_SPECTATE_NOT_ALLOWED',
                    translationKey: 'TOURNAMENT_SPECTATE_NOT_ALLOWED',
                  }
                } as ClientResponse));
                break;
              }
            }

            if (player.selectedTableId > -1) {
              const previousTable = tables.get(player.selectedTableId);
              if (previousTable) {
                previousTable.spectators = previousTable.spectators.filter(
                  spectator => spectator !== player
                );
                logger.info(`Spectating player id ${player.playerId} is removed from table ${previousTable.tableName}`);
              }
            }
            player.selectedTableId = tableId;
            table.spectators.push(player);
            logger.info(`Player id ${player.playerId} is spectating on table ${table.tableName}`);
            const response: ClientResponse = {
              key: 'selectSpectateTable',
              data: {
                success: true,
                tableId: table.tableId,
                game: table.game
              }
            };
            socket.send(JSON.stringify(response));
          }
        }
        break;
      case 'getTableParams':
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        if (table) {
          socket.send(JSON.stringify(table.getTableParams()));
        }
        break;
      case 'setFold':
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        player = players.get(socket);
        if (table && player) {
          if (table instanceof HoldemTable) {
            table.playerFold(player.playerId);
            table.sendStatusUpdate();
          } else if (table instanceof FiveCardDrawTable) {
            table.playerFold(player.playerId);
            table.sendStatusUpdate();
          } else if (table instanceof BottleSpinTable) {
            table.playerFold(player.playerId);
            table.sendStatusUpdate();
          } else {
            logger.error(`Player ${player.playerId} called ${message.key} for table instance which do not exist`);
          }
        }
        break;
      case 'setCheck':
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        player = players.get(socket);
        if (table && player) {
          if (table instanceof HoldemTable) {
            table.playerCheck(player.playerId);
            table.sendStatusUpdate();
          } else if (table instanceof FiveCardDrawTable) {
            table.playerCheck(player.playerId);
            table.sendStatusUpdate();
          } else if (table instanceof BottleSpinTable) {
            table.playerCheck(player.playerId);
            table.sendStatusUpdate();
          } else {
            logger.error(`Player ${player.playerId} called ${message.key} for table instance which do not exist`);
          }
        }
        break;
      case 'setRaise':
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        player = players.get(socket);
        if (table && player) {
          if (table instanceof HoldemTable) {
            table.playerRaise(player.playerId, Number(message.amount));
            table.sendStatusUpdate();
          } else if (table instanceof FiveCardDrawTable) {
            table.playerRaise(player.playerId, Number(message.amount));
            table.sendStatusUpdate();
          } else if (table instanceof BottleSpinTable) {
            table.playerRaise(player.playerId, Number(message.amount));
            table.sendStatusUpdate();
          } else {
            logger.error(`Player ${player.playerId} called ${message.key} for table instance which do not exist`);
          }
        }
        break;
      case 'autoPlayAction':
        player = players.get(socket);
        if (player) {
          this.autoPlayAction(player);
        }
        break;
      case 'discardAndDraw':
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        player = players.get(socket);
        cardsToDiscard = message.cardsToDiscard;
        if (player) {
          if (table && table instanceof FiveCardDrawTable) {
            logger.info(`Player ${player.playerId} discarded fcd cards ${message.cardsToDiscard}`);
            table.playerDiscardAndDraw(player.playerId, cardsToDiscard);
            table.sendStatusUpdate();
          } else {
            logger.error(`Player ${player.playerId} called ${message.key} for table instance which do not exist`);
          }
        }
        break;
      case 'bottleSpin': {
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        player = players.get(socket);
        if (player) {
          if (table && table instanceof BottleSpinTable) {
            table.spinBottle(player.playerId);
          } else {
            logger.error(`Player ${player.playerId} called ${message.key} for table instance which do not exist`);
          }
        }
        break;
      }
      case 'leaveTable': {
        tableId = Number(message.tableId);
        table = tables.get(tableId);
        player = players.get(socket);
        if (table && player) {
          if (table instanceof HoldemTable || table instanceof BottleSpinTable) {
            table.spectators = table.spectators.filter((spectator) => spectator !== player);
            table.playersToAppend = table.playersToAppend.filter((waitingPlayer) => waitingPlayer !== player);

            const seatedPlayerIndex = table.players.indexOf(player);
            if (seatedPlayerIndex !== -1) {
              if (table.gameStarted) {
                table.playerFold(player.playerId);
              } else {
                table.players.splice(seatedPlayerIndex, 1);
              }
            }
            player.selectedTableId = -1;
            table.sendStatusUpdate();
          } else if (table instanceof FiveCardDrawTable) {
            table.spectators = table.spectators.filter((spectator) => spectator !== player);
            table.playersToAppend = table.playersToAppend.filter((waitingPlayer) => waitingPlayer !== player);

            const seatedPlayerIndex = table.players.indexOf(player);
            if (seatedPlayerIndex !== -1) {
              if (table.gameStarted) {
                table.playerFold(player.playerId);
              } else {
                table.players.splice(seatedPlayerIndex, 1);
              }
            }
            player.selectedTableId = -1;
            table.sendStatusUpdate();
          } else {
            logger.error(`Player ${player.playerId} called ${message.key} for table instance which do not exist`);
          }
        }
        break;
      }
      case 'chatMessage': {
        player = players.get(socket);
        const chatMsg = message.message;
        if (player) {
          if (chatMsg.length > MAX_MESSAGE_LENGTH) {
            const response: ClientResponse = {
              key: 'chatMessage',
              data: {
                message: `Message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`,
                translationKey: 'MESSAGE_TOO_LONG',
                success: false,
              }
            };
            socket.send(JSON.stringify(response));
            break;
          }
          const now = Date.now();
          if (now - player.lastChatMessageTime < MESSAGE_COOLDOWN_MS) {
            const response: ClientResponse = {
              key: 'chatMessage',
              data: {
                message: `You are sending messages too quickly. Please wait a moment.`,
                translationKey: 'MESSAGES_TOO_QUICKLY',
                success: false,
              }
            };
            socket.send(JSON.stringify(response));
            break;
          }
          const containsProfanity = leoProfanity.check(chatMsg);
          const filteredChatMsg = containsProfanity ? leoProfanity.clean(chatMsg) : chatMsg;
          player.lastChatMessageTime = now;
          tableId = Number(player.selectedTableId);
          table = tables.get(tableId);
          if (table && table instanceof HoldemTable) {
            logger.info(`Player ${player.playerId} send chat message ${filteredChatMsg} into table ${table.tableName}`);
            table.handleChatMessage(player.playerId, filteredChatMsg)
          } else if (table && table instanceof FiveCardDrawTable) {
            logger.info(`Player ${player.playerId} send chat message ${filteredChatMsg} into table ${table.tableName}`);
            table.handleChatMessage(player.playerId, filteredChatMsg)
          } else if (table && table instanceof BottleSpinTable) {
            logger.info(`Player ${player.playerId} send chat message ${filteredChatMsg} into table ${table.tableName}`);
            table.handleChatMessage(player.playerId, filteredChatMsg)
          } else if (tableId === -1) {
            handlePublicChatMessage(players, player, filteredChatMsg);
            logger.info(`Player ${player.playerId} send public chat message ${filteredChatMsg}`);
          }
        }
        break;
      }
      case 'getChatMessages': {
        player = players.get(socket);
        if (player) {
          tableId = Number(player.selectedTableId);
          table = tables.get(tableId);
          if (table && table instanceof HoldemTable) {
            table.getChatMessages(player.playerId);
          } else if (table && table instanceof FiveCardDrawTable) {
            table.getChatMessages(player.playerId);
          } else if (table && table instanceof BottleSpinTable) {
            table.getChatMessages(player.playerId);
          } else if (tableId === -1) {
            getPublicChatMessages(player);
          }
        }
        break;
      }
      case 'createAccount': {
        socket.send(JSON.stringify({
          key: 'createAccount',
          data: {
            message: 'Password registration has been retired, please use wallet login',
            translationKey: 'WALLET_LOGIN_REQUIRED',
            success: false,
          }
        } as ClientResponse));
        break;
      }
      case 'login': {
        socket.send(JSON.stringify({
          key: 'login',
          data: {
            message: 'Password login has been retired, please use wallet login',
            translationKey: 'WALLET_LOGIN_REQUIRED',
            success: false,
          }
        } as ClientResponse));
        break;
      }
      case 'walletNonce': {
        try {
          if (!message.walletAddress) {
            throw new Error('WALLET_ADDRESS_REQUIRED');
          }
          const nonceData = await createWalletNonce(message.walletAddress);
          socket.send(JSON.stringify({
            key: 'walletNonce',
            data: {
              success: true,
              nonce: nonceData.nonce,
              walletAddress: nonceData.walletAddress,
              signatureMessage: nonceData.message,
              expiresAt: nonceData.expiresAt,
            }
          } as ClientResponse));
        } catch (error: any) {
          socket.send(JSON.stringify({
            key: 'walletNonce',
            data: {
              success: false,
              message: error.message,
              translationKey: error.message,
            }
          } as ClientResponse));
        }
        break;
      }
      case 'walletLogin': {
        try {
          if (!message.walletAddress || !message.signature) {
            throw new Error('WALLET_SIGNATURE_REQUIRED');
          }
          const {user} = await verifyWalletLogin(message.walletAddress, message.signature);
          const token = generateToken(user.id);
          const refreshToken = generateRefreshToken(user.id);
          await saveRefreshToken(user.id, refreshToken);
          socket.send(JSON.stringify({
            key: 'walletLogin',
            data: {
              success: true,
              token,
              refreshToken,
              walletAddress: user.wallet_address || undefined,
            }
          } as ClientResponse));
        } catch (error: any) {
          socket.send(JSON.stringify({
            key: 'walletLogin',
            data: {
              success: false,
              message: error.message,
              translationKey: error.message,
            }
          } as ClientResponse));
        }
        break;
      }
      case 'refreshToken': {
        const {refreshToken} = message;
        if (!refreshToken) {
          const response: ClientResponse = {
            key: 'refreshToken',
            data: {
              message: 'refreshToken is required',
              translationKey: 'REFRESH_TOKEN_REQUIRED',
              success: false,
            }
          };
          socket.send(JSON.stringify(response));
          return;
        }
        const storedToken = await findRefreshToken(refreshToken);
        if (!storedToken) {
          const response: ClientResponse = {
            key: 'refreshToken',
            data: {
              message: 'Invalid username or password',
              translationKey: 'INVALID_USERNAME_OR_PASSWORD',
              success: false,
            }
          };
          socket.send(JSON.stringify(response));
          return;
        }
        try {
          const payload = verifyRefreshToken(refreshToken);
          const newAccessToken = generateToken(payload.userId);
          const response: ClientResponse = {
            key: 'refreshToken',
            data: {
              token: newAccessToken,
              success: true,
            }
          };
          socket.send(JSON.stringify(response));
        } catch (error: any) {
          logger.error(error.message);
          const response: ClientResponse = {
            key: 'refreshToken',
            data: {
              message: error.message,
              translationKey: 'REFRESH_TOKEN_ERROR',
              success: false,
            }
          };
          socket.send(JSON.stringify(response));
        }
        break;
      }
      case 'userParams': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          player = players.get(socket);
          const user = await User.findOne({where: {id: auth.userId}});
          if (player && user) {
            const realtimeChipBalance = getRealtimeChipBalance(user, player);
            const currentTable = tables.get(player.selectedTableId);
            const isTournamentPlayer =
              currentTable instanceof HoldemTable && Boolean(currentTable.tournamentContext);
            player.playerDatabaseId = user.id;
            player.playerName = user.username || user.wallet_address || player.playerName;
            if (!isTournamentPlayer) {
              player.playerMoney = realtimeChipBalance;
            }
            player.playerWinCount = user.win_count;
            player.playerLoseCount = user.lose_count;
            const userStats = await buildUserStatsPayload(user, player);
            const response: ClientResponse = {
              key: 'userParams',
              data: {
                success: true,
                userStats,
              }
            };
            socket.send(JSON.stringify(response));
          }
        }
        break;
      }
      case 'userStatistics': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          player = players.get(socket);
          const user = await User.findOne({where: {id: auth.userId}});
          if (player && user) {
            const userStats = await buildUserStatsPayload(user, player);
            const achievements: Achievement[] = await Achievement.findAll({where: {userId: auth.userId}});
            const dailyAverageStats = await getDailyAverageStats(auth.userId);
            const response: ClientResponse = {
              key: 'userStatistics',
              data: {
                userStats: {
                  ...userStats,
                  achievements: achievements.map(({id, achievementId, count}) => {
                    const definition: AchievementDefinition = getAchievementDefinitionById(achievementId);
                    return {
                      id: id,
                      name: definition.name,
                      description: definition.description,
                      icon: definition.icon,
                      count: count,
                    }
                  }),
                  dailyAverageStats: dailyAverageStats,
                },
                success: true,
              }
            };
            socket.send(JSON.stringify(response));
          }
        }
        break;
      }
      case 'updateUserProfile': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          const user = await User.findOne({where: {id: auth.userId}});
          player = players.get(socket);
          if (!user) {
            socket.send(JSON.stringify({
              key: 'updateUserProfile',
              data: {
                success: false,
                message: '用户不存在',
              }
            } as ClientResponse));
            break;
          }

          const requestedUsername = typeof message.username === 'string' ? message.username.trim() : '';
          const requestedAvatar = typeof message.avatarIcon === 'string' ? message.avatarIcon.trim() : '';

          if (!requestedUsername || requestedUsername.length < 2 || requestedUsername.length > 20) {
            socket.send(JSON.stringify({
              key: 'updateUserProfile',
              data: {
                success: false,
                message: '昵称长度需在 2 到 20 个字符之间',
              }
            } as ClientResponse));
            break;
          }

          if (!isValidRequestedAvatar(requestedAvatar)) {
            socket.send(JSON.stringify({
              key: 'updateUserProfile',
              data: {
                success: false,
                message: '头像选项无效',
              }
            } as ClientResponse));
            break;
          }

          const duplicatedUser = await User.findOne({where: {username: requestedUsername}});
          if (duplicatedUser && duplicatedUser.id !== user.id) {
            socket.send(JSON.stringify({
              key: 'updateUserProfile',
              data: {
                success: false,
                message: '昵称已被占用',
              }
            } as ClientResponse));
            break;
          }

          user.username = requestedUsername;
          user.avatar_icon = requestedAvatar;
          await user.save();

          if (player) {
            player.playerName = requestedUsername;
          }

          const userStats = await buildUserStatsPayload(user, player);

          socket.send(JSON.stringify({
            key: 'updateUserProfile',
            data: {
              success: true,
              message: '资料更新成功',
              userStats,
            }
          } as ClientResponse));
        }
        break;
      }
      case 'getEconomyOverview': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          player = players.get(socket);
          const economy = await getEconomyOverview(auth.userId);
          if (economy?.userWallet) {
            economy.userWallet.chipBalance = getRealtimeChipBalance(
              {
                id: auth.userId,
                money: economy.userWallet.chipBalance,
              } as User,
              player
            );
          }
          socket.send(JSON.stringify({
            key: 'economyOverview',
            data: {
              success: true,
              economy,
            }
          } as ClientResponse));
        }
        break;
      }
      case 'syncOnchainState': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          try {
            await runOnchainReconciliationCycle();
            const economy = await getEconomyOverview(auth.userId);
            socket.send(JSON.stringify({
              key: 'syncOnchainState',
              data: {
                success: true,
                economy,
              }
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'syncOnchainState',
              data: {
                success: false,
                message: error.message || 'SYNC_ONCHAIN_STATE_FAILED',
                translationKey: error.message || 'SYNC_ONCHAIN_STATE_FAILED',
              }
            } as ClientResponse));
          }
        }
        break;
      }
      case 'confirmDeposit': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          const txHash = typeof message.txHash === 'string' ? message.txHash.trim() : '';
          if (!txHash) {
            socket.send(JSON.stringify({
              key: 'confirmDeposit',
              data: { success: false, message: 'MISSING_TX_HASH' },
            } as ClientResponse));
            break;
          }
          try {
            const userWallet = await confirmDepositByTxHash(txHash, auth.userId);
            const economy = await getEconomyOverview(auth.userId);
            socket.send(JSON.stringify({
              key: 'confirmDeposit',
              data: { success: true, economy, userWallet },
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'confirmDeposit',
              data: {
                success: false,
                message: error.message || 'CONFIRM_DEPOSIT_FAILED',
              },
            } as ClientResponse));
          }
        }
        break;
      }
      case 'exchangeAllinToChips': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          player = players.get(socket);

          try {
            if ((player?.selectedTableId ?? -1) > -1) {
              throw new Error('LEAVE_TABLE_BEFORE_CASHIER');
            }

            const wallet = await exchangeAllinToChips(auth.userId, Number(message.amount || 0));

            if (player) {
              player.playerMoney = wallet.chipBalance;
            }

            socket.send(JSON.stringify({
              key: 'exchangeAllinToChips',
              data: {
                success: true,
                message: '兑换成功',
                wallet,
              }
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'exchangeAllinToChips',
              data: {
                success: false,
                message: getCashierErrorMessage(error.message),
                translationKey: error.message,
              }
            } as ClientResponse));
          }
        }
        break;
      }
      case 'redeemChipsToAllin': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          player = players.get(socket);

          try {
            if ((player?.selectedTableId ?? -1) > -1) {
              throw new Error('LEAVE_TABLE_BEFORE_CASHIER');
            }

            const wallet = await redeemChipsToAllin(auth.userId, Number(message.amount || 0));

            if (player) {
              player.playerMoney = wallet.chipBalance;
            }

            socket.send(JSON.stringify({
              key: 'redeemChipsToAllin',
              data: {
                success: true,
                message: '换回成功，ALLIN 将转入您的链上钱包（约数秒到账）',
                wallet,
              }
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'redeemChipsToAllin',
              data: {
                success: false,
                message: getCashierErrorMessage(error.message),
                translationKey: error.message,
              }
            } as ClientResponse));
          }
        }
        break;
      }
      case 'requestAllinWithdrawal': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          player = players.get(socket);

          try {
            if ((player?.selectedTableId ?? -1) > -1) {
              throw new Error('LEAVE_TABLE_BEFORE_CASHIER');
            }

            const result = await requestAllinWithdrawal(auth.userId, Number(message.amount || 0));

            socket.send(JSON.stringify({
              key: 'requestAllinWithdrawal',
              data: {
                success: true,
                message: '提现申请已提交',
                request: result,
              }
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'requestAllinWithdrawal',
              data: {
                success: false,
                message: getCashierErrorMessage(error.message),
                translationKey: error.message,
              }
            } as ClientResponse));
          }
        }
        break;
      }
      case 'getTournamentList': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          const tournaments = await getTournamentList(auth.userId);
          const decoratedTournaments = await Promise.all(
            tournaments.map((tournament) => this.decorateTournamentViewWithRuntimeTables(tournament, auth.userId))
          );
          socket.send(JSON.stringify({
            key: 'tournamentList',
            data: {
              success: true,
              tournaments: decoratedTournaments,
            }
          } as ClientResponse));
        }
        break;
      }
      case 'getMyTournamentTable': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          try {
            const assignment = await getMyTournamentTableAssignment(
              auth.userId,
              Number(message.tournamentId || 0) || undefined
            );
            if (assignment.canEnter) {
              await this.ensureTournamentRuntimeBootstrap(assignment.tournamentId, auth.userId, auth.userId);
            }
            const runtimeTableId =
              assignment.tableNo > 0
                ? TOURNAMENT_RUNTIME_TABLES.get(
                    this.getTournamentRuntimeKey(
                      assignment.tournamentId,
                      assignment.editionKey,
                      assignment.tableNo
                    )
                  ) || null
                : null;

            socket.send(JSON.stringify({
              key: 'myTournamentTable',
              data: {
                success: true,
                assignment: {
                  ...assignment,
                  tableId: runtimeTableId,
                },
              },
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'myTournamentTable',
              data: {
                success: false,
                message: error.message,
                translationKey: error.message,
              },
            } as ClientResponse));
          }
        }
        break;
      }
      case 'enterTournamentTable': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          try {
            const player = players.get(socket);
            if (!player) {
              throw new Error('PLAYER_NOT_FOUND');
            }

            const assignment = await getMyTournamentTableAssignment(
              auth.userId,
              Number(message.tournamentId || 0) || undefined
            );

            if (!assignment.canEnter) {
              throw new Error('TOURNAMENT_TABLE_NOT_READY');
            }

            await this.ensureTournamentRuntimeBootstrap(assignment.tournamentId, auth.userId, auth.userId);
            const tournamentTable = this.ensureTournamentRuntimeTable(assignment);
            const stack =
              assignment.currentStack === null || assignment.currentStack === undefined
                ? TOURNAMENT_STARTING_STACK
                : Math.max(0, Number(assignment.currentStack || 0));

            player.playerMoney = stack;
            this.joinPlayerToTable(socket, player, tournamentTable, 'enterTournamentTable');
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'enterTournamentTable',
              data: {
                success: false,
                message: error.message,
                translationKey: error.message,
              },
            } as ClientResponse));
          }
        }
        break;
      }
      case 'registerTournament': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          try {
            const txHash = typeof message.txHash === 'string' ? message.txHash.trim() || undefined : undefined;
            const registration = await registerForTournament(auth.userId, Number(message.tournamentId), { txHash });
            const economy = await getEconomyOverview(auth.userId);
            socket.send(JSON.stringify({
              key: 'registerTournament',
              data: {
                success: true,
                registration,
                economy,
              }
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'registerTournament',
              data: {
                success: false,
                message: error.message,
                translationKey: error.message,
              }
            } as ClientResponse));
          }
        }
        break;
      }
      case 'rankings': {
        const ranks: RanksInterface[] = await getRankings();
        if (ranks) {
          const response: ClientResponse = {
            key: 'rankings',
            data: {
              ranks: ranks,
              count: ranks.length,
            }
          };
          socket.send(JSON.stringify(response));
        }
        break;
      }
      case 'createCashTierTable': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          try {
            const tierCode = String(message.tierCode || '');
            if (!this.isCashTierFull(tierCode)) {
              throw new Error('CASH_TIER_HAS_AVAILABLE_SEATS');
            }
            const createdTable = await createCashTierTableForUser(auth.userId, tierCode);
            this.createUserTable(createdTable, tables.size);
            socket.send(JSON.stringify({
              key: 'createCashTierTable',
              data: {
                success: true,
                table: createdTable,
                tierCode: tierCode,
              }
            } as ClientResponse));
          } catch (error: any) {
            socket.send(JSON.stringify({
              key: 'createCashTierTable',
              data: {
                success: false,
                message: error.message,
                translationKey: error.message,
                tierCode: message.tierCode,
              }
            } as ClientResponse));
          }
        }
        break;
      }
      case 'getUserTable': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success && message.tableId) {
          const table: UserTableInterface | null = await getUserTable(auth.userId, message.tableId);
          const response: ClientResponse = {
            key: 'getUserTable',
            data: {
              table: table,
              success: table !== null,
            }
          };
          socket.send(JSON.stringify(response));
        }
        break;
      }
      case 'getUserTables': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          const tables: UserTableInterface[] = await getUserTables(auth.userId);
          const response: ClientResponse = {
            key: 'getUserTables',
            data: {
              tables: tables,
              success: true,
            }
          };
          socket.send(JSON.stringify(response));
        }
        break;
      }
      case 'createUpdateUserTable': {
        const auth: AuthInterface = authenticate(socket, message);
        if (auth.success) {
          try {
            const tableData: UserTableInterface = message.tableData as UserTableInterface;
            const savedTable = await createUpdateUserTable(auth.userId, tableData);
            if (savedTable.id && Number(tableData.id) > 0) {
              table = findTableByDatabaseId(tables, Number(savedTable.id));
              if (table) {
                table.setTableInfo(savedTable);
                logger.info(`Table info/settings updated for ${savedTable.tableName}`);
              }
            }
            if (!tableData.id || tableData.id === -1) {
              this.createUserTable(savedTable, tables.size);
            }
            const response: ClientResponse = {
              key: 'createUpdateUserTable',
              data: {
                success: true,
                table: savedTable,
              }
            };
            socket.send(JSON.stringify(response));
          } catch (error: any) {
            const response: ClientResponse = {
              key: 'createUpdateUserTable',
              data: {
                success: false,
                message: getUserTableErrorMessage(error.message),
                translationKey: error.message,
              }
            };
            socket.send(JSON.stringify(response));
          }
        }
        break;
      }
      default:
        logger.error(`No handler for ${message.key} full message ${JSON.stringify(message)}`);
    }
  }

  private createUserTable(
    table: UserTableInterface, roomNumber: number
  ): void {
    switch (table.game) {
      case 'HOLDEM':
        const matchedTierIndex = gameConfig.games.holdEm.games.findIndex(
          (game) => Number(game.minBet) === Number(table.minBet)
        );
        const holdemInstance = this.createGameTable(
          roomNumber,
          HoldemTable,
          table.botCount,
          gameConfig.games.holdEm.startMoney,
          matchedTierIndex >= 0 ? matchedTierIndex : 0
        ) as HoldemTable;
        holdemInstance.setTableInfo(table);
        break;
      case 'FIVE_CARD_DRAW':
        const fiveCardDrawInstance = this.createGameTable(
          roomNumber, FiveCardDrawTable, table.botCount, gameConfig.games.fiveCardDraw.startMoney
        ) as FiveCardDrawTable;
        fiveCardDrawInstance.setTableInfo(table);
        break;
      case 'BOTTLE_SPIN':
        const bottleSpinInstance = this.createGameTable(
          roomNumber, BottleSpinTable, table.botCount, gameConfig.games.bottleSpin.startMoney
        ) as BottleSpinTable;
        bottleSpinInstance.setTableInfo(table);
        break;
    }
  }

  private async cleanupExpiredPrivateRooms(): Promise<void> {
    const expiredTables = await UserTable.findAll({
      where: {
        roomType: 'private_friendly',
        expiresAt: {
          [Op.lte]: new Date(),
        },
      },
    });

    for (const expiredTable of expiredTables) {
      const runtimeTable = findTableByDatabaseId(tables, Number(expiredTable.id));
      if (runtimeTable) {
        if ((runtimeTable as HoldemTable).gameStarted) {
          continue;
        }
        removeRuntimeUserTableByDatabaseId(
          Number(expiredTable.id),
          '亲友房时长已结束，本局结算后房间已自动关闭'
        );
      }

      await expiredTable.destroy();
    }
  }

  private getTournamentRuntimeKey(tournamentId: number, editionKey: string, tableNo: number) {
    return `${tournamentId}:${editionKey}:${tableNo}`;
  }

  private getNextRuntimeTableId() {
    const currentIds = Array.from(tables.keys());
    return currentIds.length ? Math.max(...currentIds) + 1 : 0;
  }

  private ensureTournamentRuntimeTable(assignment: {
    tournamentId: number;
    editionKey: string;
    tableNo: number;
    blindLevelIndex?: number;
    blindLevel?: number;
    currentMinBet?: number;
    currentSmallBlind?: number;
    currentBigBlind?: number;
    nextBlindAt?: string | null;
    blindIntervalMinutes?: number;
  }) {
    const runtimeKey = this.getTournamentRuntimeKey(
      assignment.tournamentId,
      assignment.editionKey,
      assignment.tableNo
    );
    const existingTableId = TOURNAMENT_RUNTIME_TABLES.get(runtimeKey);
    const existingTable = existingTableId !== undefined ? tables.get(existingTableId) : null;

    if (existingTable && existingTable instanceof HoldemTable) {
      existingTable.setTournamentContext?.({
        tournamentId: assignment.tournamentId,
        editionKey: assignment.editionKey,
        tableNo: assignment.tableNo,
        startingStack: TOURNAMENT_STARTING_STACK,
        blindLevelIndex: assignment.blindLevelIndex,
        blindLevel: assignment.blindLevel,
        currentMinBet: assignment.currentMinBet,
        currentSmallBlind: assignment.currentSmallBlind,
        currentBigBlind: assignment.currentBigBlind,
        nextBlindAt: assignment.nextBlindAt || null,
        blindIntervalMinutes: assignment.blindIntervalMinutes,
      });
      return existingTable;
    }

    const tableId = this.getNextRuntimeTableId();
    const tableInstance = this.createGameTable(
      tableId,
      HoldemTable,
      0,
      TOURNAMENT_STARTING_STACK,
      0
    ) as HoldemTable;

    tableInstance.setTournamentContext?.({
      tournamentId: assignment.tournamentId,
      editionKey: assignment.editionKey,
      tableNo: assignment.tableNo,
      startingStack: TOURNAMENT_STARTING_STACK,
      blindLevelIndex: assignment.blindLevelIndex,
      blindLevel: assignment.blindLevel,
      currentMinBet: assignment.currentMinBet,
      currentSmallBlind: assignment.currentSmallBlind,
      currentBigBlind: assignment.currentBigBlind,
      nextBlindAt: assignment.nextBlindAt || null,
      blindIntervalMinutes: assignment.blindIntervalMinutes,
    });
    tableInstance.setTournamentStateSyncHandler?.((payload) => {
      this.queueTournamentStateSync(payload);
    });
    TOURNAMENT_RUNTIME_TABLES.set(runtimeKey, tableId);
    return tableInstance;
  }

  private async decorateTournamentViewWithRuntimeTables(tournament: any, userId: number) {
    if (!tournament || tournament.status !== 'active' || !Array.isArray(tournament.currentTables)) {
      return tournament;
    }

    this.bootstrapTournamentRuntimeTables(
      tournament.id,
      tournament.currentEdition,
      tournament.currentTables,
      {
        blindLevelIndex: tournament.blindLevelIndex,
        blindLevel: tournament.blindLevel,
        currentMinBet: tournament.currentMinBet,
        currentSmallBlind: tournament.currentSmallBlind,
        currentBigBlind: tournament.currentBigBlind,
        nextBlindAt: tournament.nextBlindAt,
        blindIntervalMinutes: tournament.blindIntervalMinutes,
      },
      userId
    );

    const canSpectate = !tournament.registrationStatus || tournament.registrationStatus === 'eliminated';

    return {
      ...tournament,
      currentTables: tournament.currentTables.map((tableInfo: any) => {
        const runtimeTableId =
          TOURNAMENT_RUNTIME_TABLES.get(
            this.getTournamentRuntimeKey(tournament.id, tournament.currentEdition, Number(tableInfo.tableNo || 0))
          ) || null;
        const runtimeTable = runtimeTableId !== null ? tables.get(runtimeTableId) : null;

        return {
          ...tableInfo,
          tableId: runtimeTableId,
          spectatorsCount: runtimeTable instanceof HoldemTable ? runtimeTable.spectators.length : 0,
          canSpectate,
        };
      }),
    };
  }

  private async refreshActiveTournamentRuntimeTables() {
    if (!TOURNAMENT_RUNTIME_TABLES.size) {
      return;
    }

    const tournaments = await getTournamentList();
    for (const tournament of tournaments) {
      if (tournament.status !== 'active' || !Array.isArray(tournament.currentTables)) {
        continue;
      }

      this.bootstrapTournamentRuntimeTables(
        tournament.id,
        tournament.currentEdition,
        tournament.currentTables,
        {
          blindLevelIndex: tournament.blindLevelIndex,
          blindLevel: tournament.blindLevel,
          currentMinBet: tournament.currentMinBet,
          currentSmallBlind: tournament.currentSmallBlind,
          currentBigBlind: tournament.currentBigBlind,
          nextBlindAt: tournament.nextBlindAt,
          blindIntervalMinutes: tournament.blindIntervalMinutes,
        }
      );
    }
  }

  private detachPlayerFromCurrentTable(player: Player) {
    if (player.selectedTableId < 0) {
      return;
    }

    const currentTable = tables.get(player.selectedTableId);
    if (!currentTable) {
      player.selectedTableId = -1;
      return;
    }

    currentTable.spectators = currentTable.spectators.filter((spectator) => spectator !== player);
    currentTable.playersToAppend = currentTable.playersToAppend.filter(
      (waitingPlayer) => waitingPlayer !== player
    );

    const seatedPlayerIndex = currentTable.players.indexOf(player);
    if (seatedPlayerIndex !== -1) {
      if (currentTable.gameStarted) {
        currentTable.playerFold(player.playerId);
      } else {
        currentTable.players.splice(seatedPlayerIndex, 1);
      }
    }

    player.selectedTableId = -1;
    currentTable.sendStatusUpdate();
  }

  private joinPlayerToTable(
    socket: WebSocket,
    player: Player,
    table: FiveCardDrawTable | HoldemTable | BottleSpinTable,
    responseKey: 'selectTable' | 'enterTournamentTable'
  ) {
    if (table instanceof HoldemTable && table.tournamentContext && player.playerDatabaseId > 0) {
      const existingTournamentPlayer = [
        ...table.players,
        ...table.playersToAppend,
        ...table.spectators,
      ].find(
        (entry) =>
          !entry.isBot &&
          entry.playerDatabaseId > 0 &&
          Number(entry.playerDatabaseId) === Number(player.playerDatabaseId)
      );

      if (existingTournamentPlayer) {
        existingTournamentPlayer.socket = player.socket;
        existingTournamentPlayer.playerName = player.playerName;
        existingTournamentPlayer.selectedTableId = table.tableId;
        players.set(socket, existingTournamentPlayer);
        table.sendStatusUpdate();
        socket.send(JSON.stringify({
          key: responseKey,
          data: {
            success: true,
            tableId: table.tableId,
            game: table.game,
          },
        } as ClientResponse));
        return;
      }
    }

    if (isPlayerInTable(player, table.players, table.playersToAppend)) {
      socket.send(JSON.stringify({
        key: responseKey,
        data: {
          success: true,
          tableId: table.tableId,
          game: table.game,
        },
      } as ClientResponse));
      return;
    }

    if (player.selectedTableId > -1 && player.selectedTableId !== table.tableId) {
      this.detachPlayerFromCurrentTable(player);
    }

    player.selectedTableId = table.tableId;
    table.playersToAppend.push(player);
    logger.info(`${player.playerName} selected table ${table.tableId}`);
    table.triggerNewGame();

    socket.send(JSON.stringify({
      key: responseKey,
      data: {
        success: true,
        tableId: table.tableId,
        game: table.game,
      },
    } as ClientResponse));
  }

  private queueTournamentStateSync(payload: {
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
  }) {
    const runtimeKey = this.getTournamentRuntimeKey(payload.tournamentId, payload.editionKey, payload.tableNo);
    if (TOURNAMENT_SYNC_IN_PROGRESS.has(runtimeKey)) {
      return;
    }

    TOURNAMENT_SYNC_IN_PROGRESS.add(runtimeKey);
    syncTournamentRuntimeState(payload)
      .then((result) => {
        if (!result?.currentTables?.length) {
          return;
        }

        this.reconcileTournamentTables(
          result.tournamentId,
          result.editionKey,
          result.currentTables,
          {
            blindLevelIndex: result.blindLevelIndex,
            blindLevel: result.blindLevel,
            currentMinBet: result.currentMinBet,
            currentSmallBlind: result.currentSmallBlind,
            currentBigBlind: result.currentBigBlind,
            nextBlindAt: result.nextBlindAt,
            blindIntervalMinutes: result.blindIntervalMinutes,
          }
        );
      })
      .catch((error) => {
        logger.error(`Tournament runtime sync failed for ${runtimeKey}: ${error}`);
      })
      .finally(() => {
        TOURNAMENT_SYNC_IN_PROGRESS.delete(runtimeKey);
      });
  }

  private findTournamentParticipantByUserId(table: HoldemTable, userId: number) {
    return [...table.players, ...table.playersToAppend, ...table.spectators].find(
      (participant) => participant.playerDatabaseId > 0 && Number(participant.playerDatabaseId) === Number(userId)
    );
  }

  private createTournamentBotParticipant(
    table: HoldemTable,
    playerInfo: {
      userId: number;
      username?: string | null;
      currentStack?: number;
    }
  ) {
    const mockSocket = createMockWebSocket();
    const currentStack =
      playerInfo.currentStack === null || playerInfo.currentStack === undefined
        ? TOURNAMENT_STARTING_STACK
        : Math.max(0, Number(playerInfo.currentStack || 0));
    const player = new Player(
      mockSocket,
      playerIdIncrement,
      currentStack,
      true,
      playerInfo.username || `tourbot_${playerInfo.userId}`
    );
    player.playerDatabaseId = playerInfo.userId;
    player.selectedTableId = table.tableId;
    playerIdIncrement++;
    players.set(mockSocket, player);
    table.playersToAppend.push(player);
  }

  private bootstrapTournamentRuntimeTables(
    tournamentId: number,
    editionKey: string,
    currentTables: Array<{
      tableNo: number;
      players: Array<{
        userId: number;
        username?: string | null;
        loginMethod?: string | null;
        currentStack: number;
      }>;
    }>,
    blindState?: {
      blindLevelIndex?: number;
      blindLevel?: number;
      currentMinBet?: number;
      currentSmallBlind?: number;
      currentBigBlind?: number;
      nextBlindAt?: string | null;
      blindIntervalMinutes?: number;
    },
    deferredUserId?: number
  ) {
    const tableMap = new Map<number, HoldemTable>();

    currentTables.forEach((tableInfo) => {
      const runtimeTable = this.ensureTournamentRuntimeTable({
        tournamentId,
        editionKey,
        tableNo: tableInfo.tableNo,
        blindLevelIndex: blindState?.blindLevelIndex,
        blindLevel: blindState?.blindLevel,
        currentMinBet: blindState?.currentMinBet,
        currentSmallBlind: blindState?.currentSmallBlind,
        currentBigBlind: blindState?.currentBigBlind,
        nextBlindAt: blindState?.nextBlindAt,
        blindIntervalMinutes: blindState?.blindIntervalMinutes,
      });

      runtimeTable.setTournamentStateSyncHandler?.((payload) => {
        this.queueTournamentStateSync(payload);
      });
      tableMap.set(tableInfo.tableNo, runtimeTable);

      let shouldTrigger = false;
      const hasDeferredUser =
        Number(deferredUserId || 0) > 0 &&
        tableInfo.players.some((playerInfo) => Number(playerInfo.userId) === Number(deferredUserId));

      tableInfo.players.forEach((playerInfo) => {
        const existingParticipant = this.findTournamentParticipantByUserId(runtimeTable, playerInfo.userId);
        if (existingParticipant) {
          if (!runtimeTable.gameStarted || runtimeTable.isResultsCall) {
            existingParticipant.playerMoney = Math.max(
              0,
              Number(playerInfo.currentStack || existingParticipant.playerMoney)
            );
          }
          existingParticipant.selectedTableId = runtimeTable.tableId;
          return;
        }

        if (playerInfo.loginMethod !== 'bot') {
          return;
        }

        this.createTournamentBotParticipant(runtimeTable, playerInfo);
        shouldTrigger = true;
      });

      if (shouldTrigger && !hasDeferredUser && !runtimeTable.gameStarted) {
        runtimeTable.triggerNewGame();
      }
    });

    return tableMap;
  }

  private async ensureTournamentRuntimeBootstrap(tournamentId: number, userId: number, deferredUserId?: number) {
    const tournaments = await getTournamentList(userId);
    const tournament = tournaments.find((item) => Number(item.id) === Number(tournamentId));
    if (!tournament || tournament.status !== 'active' || !Array.isArray(tournament.currentTables)) {
      return;
    }

    this.bootstrapTournamentRuntimeTables(
      tournament.id,
      tournament.currentEdition,
      tournament.currentTables,
      {
        blindLevelIndex: tournament.blindLevelIndex,
        blindLevel: tournament.blindLevel,
        currentMinBet: tournament.currentMinBet,
        currentSmallBlind: tournament.currentSmallBlind,
        currentBigBlind: tournament.currentBigBlind,
        nextBlindAt: tournament.nextBlindAt,
        blindIntervalMinutes: tournament.blindIntervalMinutes,
      },
      deferredUserId
    );
  }

  private reconcileTournamentTables(
    tournamentId: number,
    editionKey: string,
    currentTables: Array<{
      tableNo: number;
      players: Array<{
        userId: number;
        username?: string | null;
        loginMethod?: string | null;
        currentStack: number;
      }>;
    }>,
    blindState?: {
      blindLevelIndex?: number;
      blindLevel?: number;
      currentMinBet?: number;
      currentSmallBlind?: number;
      currentBigBlind?: number;
      nextBlindAt?: string | null;
      blindIntervalMinutes?: number;
    }
  ) {
    const assignmentMap = new Map<number, {tableNo: number; currentStack: number}>();
    const tableMap = this.bootstrapTournamentRuntimeTables(tournamentId, editionKey, currentTables, blindState);

    currentTables.forEach((tableInfo) => {
      tableInfo.players.forEach((playerInfo) => {
        assignmentMap.set(playerInfo.userId, {
          tableNo: tableInfo.tableNo,
          currentStack: Number(playerInfo.currentStack || 0),
        });
      });
    });

    for (const [runtimeKey, runtimeTableId] of TOURNAMENT_RUNTIME_TABLES) {
      if (!runtimeKey.startsWith(`${tournamentId}:${editionKey}:`)) {
        continue;
      }

      const currentTable = tables.get(runtimeTableId);
      if (!(currentTable instanceof HoldemTable)) {
        continue;
      }

      const participants = [...currentTable.players, ...currentTable.playersToAppend, ...currentTable.spectators];
      participants.forEach((participant) => {
        if (participant.playerDatabaseId <= 0 || (!participant.isBot && !participant.socket)) {
          return;
        }

        const assignment = assignmentMap.get(participant.playerDatabaseId);
        if (!assignment) {
          if (!currentTable.isResultsCall && currentTable.gameStarted) {
            return;
          }

          currentTable.players = currentTable.players.filter((item) => item !== participant);
          currentTable.playersToAppend = currentTable.playersToAppend.filter((item) => item !== participant);
          currentTable.spectators = currentTable.spectators.filter((item) => item !== participant);
          participant.selectedTableId = -1;
          if (participant.isBot && participant.socket) {
            players.delete(participant.socket);
            participant.socket = null;
          }
          return;
        }

        const targetTable = tableMap.get(assignment.tableNo);
        if (!targetTable || targetTable.tableId === currentTable.tableId) {
          if (!currentTable.gameStarted || currentTable.isResultsCall) {
            participant.playerMoney = Math.max(0, Number(assignment.currentStack || participant.playerMoney));
          }
          return;
        }

        if (!currentTable.isResultsCall && currentTable.gameStarted) {
          return;
        }

        currentTable.players = currentTable.players.filter((item) => item !== participant);
        currentTable.playersToAppend = currentTable.playersToAppend.filter((item) => item !== participant);
        currentTable.spectators = currentTable.spectators.filter((item) => item !== participant);
        participant.playerMoney = Math.max(0, Number(assignment.currentStack || participant.playerMoney));
        participant.selectedTableId = targetTable.tableId;
        targetTable.playersToAppend.push(participant);
        targetTable.triggerNewGame();
        if (!participant.isBot && participant.socket) {
          participant.socket.send(JSON.stringify({
            key: 'enterTournamentTable',
            data: {
              success: true,
              tableId: targetTable.tableId,
              game: targetTable.game,
            },
          } as ClientResponse));
        }
      });
    }
  }

  private createGameTable(
    tableNumber: number,
    tableClass: typeof HoldemTable | typeof FiveCardDrawTable | typeof BottleSpinTable,
    botCount: number,
    startMoney: number,
    forcedType?: number,
  ): HoldemTable | FiveCardDrawTable | BottleSpinTable {
    if (typeof forcedType === 'number' && forcedType >= 0) {
      const tableInstance = new tableClass(this.eventEmitter, forcedType, tableNumber);
      if (tableInstance instanceof HoldemTable) {
        tableInstance.targetBotCount = forcedType <= 1 ? botCount : 0;
      }
      tables.set(tableNumber, tableInstance);
      logger.info(`Created game table id ${tableNumber} with name (${tableClass.name})`);
      const initialBotCount =
        tableInstance instanceof HoldemTable && forcedType > 1 ? 0 : botCount;
      Array.from({length: initialBotCount}).forEach(() => {
        this.onAppendBot(tableNumber, startMoney);
      });
      return tableInstance;
    }

    let betTypeCount = {lowBets: 0, mediumBets: 0, highBets: 0};
    tables.forEach((table) => {
      if (table instanceof tableClass) {
        const gameType = table instanceof HoldemTable ? table.holdemType : table.gameType;
        switch (gameType) {
          case 0:
            betTypeCount.lowBets++;
            break;
          case 1:
            betTypeCount.mediumBets++;
            break;
          case 2:
            betTypeCount.highBets++;
            break;
        }
      }
    });
    const tableType = Object.entries(betTypeCount)
      .sort(([, countA], [, countB]) => countA - countB)
      .map(([key]) => key);
    let type: number = 0;
    switch (tableType[0]) {
      case 'lowBets':
        type = 0;
        break;
      case 'mediumBets':
        type = 1;
        break;
      case 'highBets':
        type = 2;
        break;
    }
    const tableInstance = new tableClass(this.eventEmitter, type, tableNumber);
    if (tableInstance instanceof HoldemTable) {
      tableInstance.targetBotCount = type <= 1 ? botCount : 0;
    }
    tables.set(tableNumber, tableInstance);
    logger.info(`Created game table id ${tableNumber} with name (${tableClass.name})`);
    const initialBotCount = tableInstance instanceof HoldemTable && type > 1 ? 0 : botCount;
    Array.from({length: initialBotCount}).forEach(() => {
      this.onAppendBot(tableNumber, startMoney);
    });
    return tableInstance;
  }

  private isCashTierFull(tierCode: string): boolean {
    const tier = allinConfig.cashTiers.find((item) => item.code === tierCode);
    if (!tier) {
      return false;
    }

    const tierTables = Array.from(tables.values()).filter((table) => {
      return table instanceof HoldemTable && Number(table.tableMinBet) === Number(tier.minBet);
    });

    if (tierTables.length === 0) {
      return false;
    }

    return tierTables.every((table) => (table.players.length + table.playersToAppend.length) >= table.maxSeats);
  }


  // append new bot on selected room
  private onAppendBot(tableNumber: number, botStartingMoney: number): void {
    const table = tables.get(tableNumber);
    if (!table) {
      return;
    }
    if (table instanceof HoldemTable && table.holdemType > 1) {
      return;
    }
    if (table instanceof HoldemTable) {
      const humanCount =
        table.players.filter((player) => player && !player.isBot && player.selectedTableId === table.tableId).length +
        table.playersToAppend.filter(
          (player) => player && !player.isBot && player.selectedTableId === table.tableId
        ).length;
      if (humanCount >= 3) {
        return;
      }
    }
    if ((table.playersToAppend.length + table.players.length) < table.maxSeats) {
      const mockSocket = createMockWebSocket();
      const currentBotNames: string[] = table.players
        .filter((player: PlayerInterface) => player.isBot)
        .map((playerObj: PlayerInterface) => {
          return playerObj.playerName
        });
      const randomizedBotMoney = this.getBotStartingMoney(table, botStartingMoney);
      const player = new Player(
        mockSocket,
        playerIdIncrement,
        randomizedBotMoney,
        true,
        getRandomBotName(currentBotNames)
      );
      player.selectedTableId = table.tableId;
      playerIdIncrement++;
      players.set(mockSocket, player);
      table.playersToAppend.push(player);
      logger.info(`Bot ${player.playerName} added into table ${table.tableName} with ${player.playerMoney}`);
      table.triggerNewGame();
    } else {
      logger.info(`Too many players on table ${table.tableName} so cannot append more bots`);
    }
  }

  private getBotStartingMoney(
    table: HoldemTable | FiveCardDrawTable | BottleSpinTable,
    fallbackMoney: number
  ): number {
    if (!(table instanceof HoldemTable)) {
      return fallbackMoney;
    }

    const baseBlind = Math.max(1, Number(table.tableMinBet || 0));
    const minMultiplier = table.holdemType === 0 ? 75 : 40;
    const maxMultiplier = table.holdemType === 0 ? 165 : 95;
    const randomMultiplier = getRandomInt(minMultiplier, maxMultiplier);
    const randomOffset = getRandomInt(3, 97);
    return baseBlind * randomMultiplier + randomOffset;
  }

  private autoPlayAction(player: Player) {
    if (!player.isFold) {
      const table = tables.get(player.selectedTableId);
      if (table instanceof HoldemTable) {
        const checkAmount = table.currentHighestBet === 0 ?
          table.tableMinBet : (table.currentHighestBet - player.totalBet);
        const autoplay = new HoldemBot(
          player.playerName,
          player.playerMoney,
          player.playerCards,
          table.isCallSituation,
          table.tableMinBet,
          checkAmount,
          table.evaluatePlayerCards(table.current_player_turn).value,
          table.currentStage,
          player.totalBet,
          table.totalPot + table.players.reduce((sum, seatedPlayer) => sum + Number(seatedPlayer.totalBet || 0), 0)
        );
        const action = autoplay.performAction();
        const responseArray: ClientResponse = {
          key: 'autoPlayActionResult', data: {
            action: action.action,
            amount: action.amount,
          }
        };
        logger.info(`🤖 Sending player ${player.playerId} auto play action ${action.action}`);
        player.socket?.send(JSON.stringify(responseArray));
      } else if (table instanceof FiveCardDrawTable) {
        const checkAmount = table.currentHighestBet === 0 ?
          table.tableMinBet : (table.currentHighestBet - player.totalBet);
        const autoplay = new FiveCardDrawBot(
          player.playerName,
          player.playerMoney,
          player.playerCards,
          table.isCallSituation,
          table.tableMinBet,
          checkAmount,
          table.evaluatePlayerCards(table.current_player_turn),
          table.currentStage,
          player.totalBet
        );
        const action = autoplay.performAction();
        const responseArray: ClientResponse = {
          key: 'autoPlayActionResult', data: {
            action: action.action,
            amount: action.amount,
            cards: action.cardsToDiscard,
          }
        };
        logger.info(`🤖 Sending player ${player.playerId} auto play action ${action.action}`);
        player.socket?.send(JSON.stringify(responseArray));
      } else if (table instanceof BottleSpinTable) {
        const checkAmount = table.currentHighestBet === 0 ?
          table.tableMinBet : (table.currentHighestBet - player.totalBet);
        const autoplay = new BottleSpinBot(
          player.playerName,
          player.playerMoney,
          table.isCallSituation,
          table.tableMinBet,
          checkAmount,
          table.currentStage,
          player.totalBet
        );
        const action = autoplay.performAction();
        const responseArray: ClientResponse = {
          key: 'autoPlayActionResult', data: {
            action: action.action,
            amount: action.amount,
          }
        };
        logger.info(`🤖 Sending player ${player.playerId} auto play action ${action.action}`);
        player.socket?.send(JSON.stringify(responseArray));
      } else {
        logger.warn('No auto play handler defined for selected game');
      }
    }
  }

}

export {GameHandler}
