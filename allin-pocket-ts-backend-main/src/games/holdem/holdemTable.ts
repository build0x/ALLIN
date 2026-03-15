import {gameConfig} from '../../gameConfig';
import {HoldemStage, PlayerState, SocketState} from '../../enums';
import {
  ClientResponse,
  HandEvaluationInterface,
  HoldemTableInterface,
  PlayerData, PlayerInterface, PotBreakdownInterface, TableInfoInterface, UserTableInterface,
} from '../../interfaces';
import logger from '../../logger';
import {Poker} from '../../poker';
import {BotType, ChatMessage, Game, PlayerAction} from '../../types';
import {
  asciiToStringCardsArray,
  containsValue,
  findFirstAiBotPlayer,
  findPlayerById,
  getRandomInt,
  sendClientMessage,
  stringToAsciiCardsArray
} from '../../utils';
import {
  BOT_CALL, BOT_CHECK, BOT_FOLD,
  BOT_RAISE,
  BOT_REMOVE,
  NEW_BOT_EVENT_KEY,
  PlayerActions,
  WIN_STREAK_XP,
  WIN_XP
} from '../../constants';
import evaluator from '../../evaluator';
import {HoldemBot} from './holdemBot';
import {Hand} from 'pokersolver';
import {Player} from '../../player';
import EventEmitter from 'events';
import {User} from '../../database/models/user';
import {Statistic} from '../../database/models/statistic';

// noinspection DuplicatedCode
export class HoldemTable implements HoldemTableInterface {
  eventEmitter: EventEmitter;
  game: Game = 'HOLDEM';
  holdemType: number;
  tableId: number;
  tableDatabaseId: number;
  roomType: string;
  expiresAt: string | null;
  tablePassword: string;
  tableMinBet: number;
  tableName: string;
  maxSeats: number;
  minPlayers: number;
  turnTimeOut: number;
  afterRoundCountDown: number;
  currentStage: number;
  holeCardsGiven: boolean;
  totalPot: number;
  bots: any[];
  players: Player[];
  playersToAppend: Player[];
  playersTemp: Player[];
  spectators: Player[];
  spectatorsTemp: Player[];
  deck: string[] = [];
  deckCard: number;
  deckSize: number;
  deckCardsBurned: number;
  middleCards: string[];
  gameStarted: boolean;
  turnTimeOutObj: NodeJS.Timeout | null;
  turnIntervalObj: NodeJS.Timeout | null;
  updateJsonTemp: any | null;
  current_player_turn: number;
  currentTurnText: string;
  currentHighestBet: number;
  minimumRaiseAmount: number;
  isCallSituation: boolean;
  isResultsCall: boolean;
  roundWinnerPlayerIds: number[];
  roundWinnerPlayerCards: any[];
  roundWinnerPayouts: PlayerData[];
  potBreakdown: PotBreakdownInterface[];
  roundResultMessage: string;
  currentStatusText: string;
  lastUserAction: { playerId: number; actionText: string | null };
  targetBotCount: number;
  dealerPlayerArrayIndex: number;
  smallBlindPlayerArrayIndex: number;
  smallBlindGiven: boolean;
  bigBlindGiven: boolean;
  bigBlindPlayerHadTurn: boolean;
  lastWinnerPlayers: any[];
  collectingPot: boolean;
  chatMessages: ChatMessage[] = [];
  chatMaxSize: number = 50;
  tournamentContext:
    | {
        tournamentId: number;
        editionKey: string;
        tableNo: number;
        startingStack: number;
        blindLevelIndex?: number;
        blindLevel?: number;
        currentMinBet?: number;
        currentSmallBlind?: number;
        currentBigBlind?: number;
        nextBlindAt?: string | null;
        blindIntervalMinutes?: number;
      }
    | null;
  pendingTournamentContext:
    | {
        tournamentId: number;
        editionKey: string;
        tableNo: number;
        startingStack: number;
        blindLevelIndex?: number;
        blindLevel?: number;
        currentMinBet?: number;
        currentSmallBlind?: number;
        currentBigBlind?: number;
        nextBlindAt?: string | null;
        blindIntervalMinutes?: number;
      }
    | null;
  tournamentStateSyncHandler:
    | ((payload: {
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
      }) => void)
    | null;

  constructor(
    eventEmitter: EventEmitter,
    holdemType: number,
    tableId: number,
  ) {
    this.eventEmitter = eventEmitter;
    this.holdemType = holdemType;
    this.tableId = tableId;
    this.tableDatabaseId = -1;
    this.roomType = 'cash';
    this.expiresAt = null;
    this.tablePassword = '';
    this.tableMinBet = gameConfig.games.holdEm.games[holdemType].minBet;
    this.tableName = gameConfig.games.holdEm.games[holdemType].name || ('Table ' + tableId);
    this.maxSeats = gameConfig.games.holdEm.games[holdemType].max_seats;
    this.minPlayers = gameConfig.games.holdEm.games[holdemType].minPlayers;
    this.turnTimeOut = gameConfig.games.holdEm.games[holdemType].turnCountdown * 1000;
    this.afterRoundCountDown = gameConfig.games.holdEm.games[this.holdemType].afterRoundCountdown * 1000;
    this.currentStage = HoldemStage.ONE_HOLE_CARDS;
    this.holeCardsGiven = false;
    this.totalPot = 0;
    this.bots = [];
    this.players = [];
    this.playersToAppend = [];
    this.playersTemp = [];
    this.spectators = [];
    this.spectatorsTemp = [];
    this.deck = [];
    this.deckCard = 0;
    this.deckSize = 52;
    this.deckCardsBurned = 0;
    this.middleCards = [];
    this.gameStarted = false;
    this.turnTimeOutObj = null;
    this.turnIntervalObj = null;
    this.updateJsonTemp = null;
    this.current_player_turn = 0;
    this.currentTurnText = '';
    this.currentHighestBet = 0;
    this.minimumRaiseAmount = this.tableMinBet;
    this.isCallSituation = false;
    this.isResultsCall = false;
    this.targetBotCount = 0;
    this.roundWinnerPlayerIds = [];
    this.roundWinnerPlayerCards = [];
    this.roundWinnerPayouts = [];
    this.potBreakdown = [];
    this.roundResultMessage = '';
    this.currentStatusText = 'Waiting players...';
    this.lastUserAction = {playerId: -1, actionText: null};
    this.dealerPlayerArrayIndex = -1;
    this.smallBlindPlayerArrayIndex = -1;
    this.smallBlindGiven = false;
    this.bigBlindGiven = false;
    this.bigBlindPlayerHadTurn = false;
    this.lastWinnerPlayers = [];
    this.collectingPot = false;
    this.tournamentContext = null;
    this.pendingTournamentContext = null;
    this.tournamentStateSyncHandler = null;
  }

  resetTableParams(): void {
    this.currentStage = HoldemStage.ONE_HOLE_CARDS;
    this.holeCardsGiven = false;
    this.totalPot = 0;
    this.middleCards = [];
    this.currentHighestBet = 0;
    this.updateJsonTemp = null;
    this.current_player_turn = 0;
    this.isResultsCall = false;
    this.roundWinnerPlayerIds = [];
    this.roundWinnerPlayerCards = [];
    this.roundWinnerPayouts = [];
    this.potBreakdown = [];
    this.roundResultMessage = '';
    this.lastUserAction = {playerId: -1, actionText: null};
    this.smallBlindGiven = false;
    this.bigBlindGiven = false;
    this.bigBlindPlayerHadTurn = false;
    this.collectingPot = false;
    this.deckCardsBurned = 0;
    this.minimumRaiseAmount = this.tableMinBet;
  }

  setTableInfo(
    table: UserTableInterface
  ): void {
    this.tableName = table.tableName || this.tableName;
    this.tableDatabaseId = Number(table.id) || this.tableDatabaseId;
    this.roomType = table.roomType || this.roomType;
    this.expiresAt = table.expiresAt ? new Date(table.expiresAt).toISOString() : this.expiresAt;
    this.tablePassword = table.password || this.tablePassword;
    if (table.turnCountdown && table.turnCountdown > 0) {
      this.turnTimeOut = Number(table.turnCountdown) * 1000;
    }
    if (table.maxSeats && table.maxSeats > 0) {
      this.maxSeats = table.maxSeats;
    }
    if (table.minBet && table.minBet > 0) {
      this.tableMinBet = Number(table.minBet);
    }
    if (table.afterRoundCountdown && table.afterRoundCountdown > 0) {
      this.afterRoundCountDown = Number(table.afterRoundCountdown) * 1000;
    }
    logger.debug(`Table info updated for table ${this.tableId} set name to ${this.tableName}`);
  }

  setTournamentContext(context: {
    tournamentId: number;
    editionKey: string;
    tableNo: number;
    startingStack: number;
    blindLevelIndex?: number;
    blindLevel?: number;
    currentMinBet?: number;
    currentSmallBlind?: number;
    currentBigBlind?: number;
    nextBlindAt?: string | null;
    blindIntervalMinutes?: number;
  }): void {
    const nextContext = {
      ...(this.tournamentContext || {}),
      ...context,
    };

    if (this.gameStarted && !this.isResultsCall && this.holeCardsGiven) {
      this.pendingTournamentContext = nextContext;
      return;
    }

    this.pendingTournamentContext = null;
    this.tournamentContext = nextContext;
    this.roomType = 'tournament';
    this.tableName = `总锦标赛 ${nextContext.editionKey} - 第 ${nextContext.tableNo} 桌`;
    this.maxSeats = 6;
    this.minPlayers = 2;
    this.tableMinBet = Math.max(
      1,
      Number(nextContext.currentMinBet || Math.max(100, Math.floor(nextContext.startingStack / 100)))
    );
    this.minimumRaiseAmount = this.tableMinBet;
    if (!this.gameStarted) {
      this.currentStatusText = '锦标赛牌桌等待玩家进入';
    }
  }

  private applyPendingTournamentContext(): void {
    if (!this.pendingTournamentContext) {
      return;
    }

    const nextContext = this.pendingTournamentContext;
    this.pendingTournamentContext = null;
    this.setTournamentContext(nextContext);
  }

  setTournamentStateSyncHandler(
    handler: (payload: {
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
    }) => void
  ): void {
    this.tournamentStateSyncHandler = handler;
  }

  private emitTournamentStateSync(): void {
    if (!this.tournamentContext || !this.tournamentStateSyncHandler) {
      return;
    }

    this.tournamentStateSyncHandler({
      tournamentId: this.tournamentContext.tournamentId,
      editionKey: this.tournamentContext.editionKey,
      tableNo: this.tournamentContext.tableNo,
      players: this.players
        .filter((player) => player.playerDatabaseId > 0)
        .map((player) => ({
          userId: player.playerDatabaseId,
          playerId: player.playerId,
          playerName: player.playerName,
          currentStack: Math.max(0, Number(player.playerMoney || 0) + Number(player.totalBet || 0)),
          playerMoney: Number(player.playerMoney || 0),
          totalBet: Number(player.totalBet || 0),
          isFold: player.isFold,
          isAllIn: player.isAllIn,
          isDisconnected: player.socket == null,
        })),
      gameStarted: this.gameStarted,
      isResultsCall: this.isResultsCall,
    });
  }

  getTableInfo(): TableInfoInterface {
    const seatedPlayers = this.players.filter(
      (player) => player && (player.isBot || player.selectedTableId === this.tableId)
    ).length;
    const waitingPlayers = this.playersToAppend.filter(
      (player) => player && (player.isBot || player.selectedTableId === this.tableId)
    ).length;

    return {
      game: this.game,
      tableId: this.tableId,
      tableName: this.tableName,
      tableMinBet: this.tableMinBet,
      playerCount: seatedPlayers + waitingPlayers + this.bots.length,
      maxSeats: this.maxSeats,
      passwordProtected: this.tablePassword.length > 0,
      roomType: this.roomType,
      expiresAt: this.expiresAt,
      spectatorsCount: this.spectators.length,
      tournamentInfo: this.tournamentContext
        ? {
            tournamentId: this.tournamentContext.tournamentId,
            editionKey: this.tournamentContext.editionKey,
            tableNo: this.tournamentContext.tableNo,
            blindLevelIndex: this.tournamentContext.blindLevelIndex,
            blindLevel: this.tournamentContext.blindLevel,
            currentMinBet: this.tableMinBet,
            currentSmallBlind: Number(this.tournamentContext.currentSmallBlind || this.tableMinBet / 2),
            currentBigBlind: Number(this.tournamentContext.currentBigBlind || this.tableMinBet),
            nextBlindAt: this.tournamentContext.nextBlindAt || null,
            blindIntervalMinutes: this.tournamentContext.blindIntervalMinutes,
          }
        : null,
    };
  }

  triggerNewGame(): void {
    this.cleanSpectators();
    if (!this.gameStarted) {
      this.syncCashTableBots();
      this.playersTemp = [];
      for (const player of this.players) {
        if (player && player.socket && player.playerMoney > 0 && player.selectedTableId === this.tableId) {
          this.playersTemp.push(player);
        } else if (player && !player.isBot && player.selectedTableId === this.tableId) {
          sendClientMessage(
            player.socket,
            '筹码不足，已切换为观战状态。',
            'NO_MONEY_CHANGED_TO_SPECTATOR'
          );
          this.spectators.push(player);
        }
      }
      this.players = this.playersTemp
        .filter(player => player && player.socket)
        .slice(0, this.maxSeats);
      const excessPlayers = this.playersTemp.slice(this.maxSeats);
      for (const player of excessPlayers) {
        if (!player.isBot) {
          sendClientMessage(
            player.socket,
            '当前座位已满，已切换为观战状态。',
            'NO_SEAT_CHANGED_TO_SPECTATOR'
          );
          this.spectators.push(player);
        }
      }
      this.playersTemp = [];
      if (this.playersToAppend.length > 0) {
        for (const player of this.playersToAppend) {
          if (player.socket && player.playerMoney > 0 && this.players.length < this.maxSeats) {
            this.players.push(player);
          } else if (!player.isBot) {
            sendClientMessage(
              player.socket,
              this.players.length >= this.maxSeats
                ? '当前座位已满，已切换为观战状态。'
                : '筹码不足，已切换为观战状态。',
              this.players.length >= this.maxSeats
                ? 'NO_SEAT_CHANGED_TO_SPECTATOR'
                : 'NO_MONEY_CHANGED_TO_SPECTATOR'
            );
            this.spectators.push(player);
          }
        }
        this.playersToAppend = [];
      }
      if (this.players.length >= this.minPlayers) {
        setTimeout(() => {
          this.startGame();
        }, gameConfig.common.startGameTimeOut);
      } else {
        logger.info(`Table ${this.tableName} has not enough players`);
        this.currentStatusText = `${this.minPlayers} players needed to start a new game...`;
      }
    } else {
      logger.warn(`Cannot append more players since a round is running for table: ${this.tableName}`);
    }
  }

  cleanSpectators(): void {
    this.spectatorsTemp = [];
    for (const spectator of this.spectators) {
      if (spectator && spectator.socket) {
        this.spectatorsTemp.push(spectator);
      }
    }
    this.spectators = this.spectatorsTemp.filter(spectator => spectator && spectator.socket);
    this.spectatorsTemp = [];
  }

  startGame(): void {
    if (!this.gameStarted) {
      this.gameStarted = true;
      logger.info('Game started for table: ' + this.tableName);
      this.applyPendingTournamentContext();
      this.resetTableParams();
      this.resetPlayerParameters(); // Reset players (resets dealer param too)
      this.setNextDealerPlayer(); // Get next dealer player
      this.getNextSmallBlindPlayer(); // Get small blind player
      let response = this.getTableParams();
      logger.debug(JSON.stringify(response));
      for (let i = 0; i < this.players.length; i++) {
        this.players[i].isFold = false;
        this.sendWebSocketData(i, response);
      }
      for (let w = 0; w < this.playersToAppend.length; w++) {
        this.sendWaitingPlayerWebSocketData(w, response);
      }
      for (let s = 0; s < this.spectators.length; s++) {
        this.sendSpectatorWebSocketData(s, response);
      }
      this.newGame();
    }
  }

  getTableParams(): ClientResponse {
    const response: ClientResponse = {
      key: 'tableParams',
      data: {
        game: this.game,
        gameStarted: this.currentStage >= HoldemStage.ONE_HOLE_CARDS && this.holeCardsGiven,
        playerCount: this.players.length,
        totalPot: this.totalPot,
        tableMinBet: this.tableMinBet,
        tableName: this.tableName,
        currentStatus: this.currentStatusText,
        currentTurnText: this.currentTurnText,
        middleCards: this.middleCards,
        playersData: [],
        isCallSituation: this.isCallSituation,
        isResultsCall: this.isResultsCall,
        roundWinnerPlayerIds: this.roundWinnerPlayerIds,
        roundWinnerPlayerCards: this.roundWinnerPlayerCards,
        roundWinnerPayouts: this.roundWinnerPayouts,
        roundResultMessage: this.roundResultMessage,
        potBreakdown: this.potBreakdown,
        appendPlayersCount: this.playersToAppend.length,
        spectatorsCount: this.spectators.length,
        deckStatus: `${this.deckCard}/${this.deckSize}`,
        deckCardsBurned: this.deckCardsBurned,
        collectingPot: this.collectingPot,
        tournamentInfo: this.tournamentContext
          ? {
              tournamentId: this.tournamentContext.tournamentId,
              editionKey: this.tournamentContext.editionKey,
              tableNo: this.tournamentContext.tableNo,
              blindLevelIndex: this.tournamentContext.blindLevelIndex,
              blindLevel: this.tournamentContext.blindLevel,
              currentMinBet: this.tableMinBet,
              currentSmallBlind: Number(this.tournamentContext.currentSmallBlind || this.tableMinBet / 2),
              currentBigBlind: Number(this.tournamentContext.currentBigBlind || this.tableMinBet),
              nextBlindAt: this.tournamentContext.nextBlindAt || null,
              blindIntervalMinutes: this.tournamentContext.blindIntervalMinutes,
            }
          : null,
      },
    };
    response.data.playersData = this.players.map((player: PlayerInterface) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      playerMoney: player.playerMoney,
      isDealer: player.isDealer,
    }));
    return response;
  }

  newGame(): void {
    // Always shuffle new deck
    this.deck = Poker.visualize(Poker.shuffle(Poker.newSet()));
    this.deckSize = this.deck.length;
    this.deckCard = 0;
    this.sendStatusUpdate();
    setTimeout(() => {
      this.staging();
    }, 1000);
  };

  staging(): void {
    switch (this.currentStage) {
      case HoldemStage.ONE_HOLE_CARDS: // Give cards
        this.currentStatusText = 'Hole cards';
        this.currentTurnText = '';
        this.burnCard(); // Burn one card before dealing cards
        this.holeCards();
        break;
      case HoldemStage.TWO_PRE_FLOP: // First betting round
        this.currentStatusText = 'Pre flop & small blind & big blind';
        this.isCallSituation = false; // table related reset
        this.resetPlayerStates();
        this.resetRoundParameters();
        this.current_player_turn = this.smallBlindPlayerArrayIndex; // Round starting player is always small blind player
        this.currentTurnText = '';
        this.currentHighestBet = 0;
        this.bettingRound(this.smallBlindPlayerArrayIndex); // this.bettingRound(this.current_player_turn);
        break;
      case HoldemStage.THREE_THE_FLOP: // Show three middle cards
        this.currentStatusText = 'The flop';
        this.currentTurnText = '';
        this.burnCard(); // Burn one card before dealing cards
        this.theFlop();
        break;
      case HoldemStage.FOUR_POST_FLOP: // Second betting round
        this.currentStatusText = 'Post flop';
        this.currentTurnText = '';
        this.isCallSituation = false; // table related reset
        this.resetPlayerStates();
        this.resetRoundParameters();
        this.current_player_turn = this.smallBlindPlayerArrayIndex; // Round starting player is always small blind player
        this.currentHighestBet = 0;
        this.bettingRound(this.current_player_turn); // this.bettingRound(this.current_player_turn);
        break;
      case HoldemStage.FIVE_THE_TURN: // Show fourth card
        this.currentStatusText = 'The turn';
        this.currentTurnText = '';
        this.burnCard(); // Burn one card before dealing cards
        this.theTurn();
        break;
      case HoldemStage.SIX_THE_POST_TURN: // Third betting round
        this.currentStatusText = 'Post turn';
        this.currentTurnText = '';
        this.isCallSituation = false; // table related reset
        this.resetPlayerStates();
        this.resetRoundParameters();
        this.current_player_turn = this.smallBlindPlayerArrayIndex; // Round starting player is always small blind player
        this.currentHighestBet = 0;
        this.bettingRound(this.current_player_turn); // this.bettingRound(this.current_player_turn);
        break;
      case HoldemStage.SEVEN_THE_RIVER: // Show fifth card
        this.currentStatusText = 'The river';
        this.currentTurnText = '';
        this.burnCard(); // Burn one card before dealing cards
        this.theRiver();
        break;
      case HoldemStage.EIGHT_THE_SHOW_DOWN: // Fourth and final betting round
        this.currentStatusText = 'The show down';
        this.currentTurnText = '';
        this.isCallSituation = false; // table related reset
        this.resetPlayerStates();
        this.resetRoundParameters();
        this.current_player_turn = this.smallBlindPlayerArrayIndex; // Round starting player is always small blind player
        this.currentHighestBet = 0;
        this.bettingRound(this.current_player_turn); // this.bettingRound(this.current_player_turn);
        break;
      case HoldemStage.NINE_SEND_ALL_PLAYERS_CARDS: // Send all players cards here before results to all players and spectators
        this.sendAllPlayersCards(); // Avoiding cheating with this
        break;
      case HoldemStage.TEN_RESULTS:
        this.roundResultsEnd();
        break;
      default:
        return;
    }
    this.sendStatusUpdate();
  }

  sendStatusUpdate(): void {
    if (!this.gameStarted) {
      this.syncCashTableBots();
    }
    const response = {
      key: 'statusUpdate',
      data: {
        totalPot: this.totalPot,
        tableMinBet: this.tableMinBet,
        currentStatus: this.currentStatusText,
        currentTurnText: this.currentTurnText,
        middleCards: this.middleCards,
        playersData: [] as any[],
        isCallSituation: this.isCallSituation,
        isResultsCall: this.isResultsCall,
        roundWinnerPlayerIds: this.roundWinnerPlayerIds,
        roundWinnerPlayerCards: this.roundWinnerPlayerCards,
        roundWinnerPayouts: this.roundWinnerPayouts,
        potBreakdown: this.potBreakdown,
        roundResultMessage: this.roundResultMessage,
        tableName: this.tableName,
        playingPlayersCount: this.players.length,
        appendPlayersCount: this.playersToAppend.length,
        spectatorsCount: this.spectators.length,
        deckStatus: `${this.deckCard}/${this.deckSize}`,
        deckCardsBurned: this.deckCardsBurned,
        collectingPot: this.collectingPot,
        tournamentInfo: this.tournamentContext
          ? {
              tournamentId: this.tournamentContext.tournamentId,
              editionKey: this.tournamentContext.editionKey,
              tableNo: this.tournamentContext.tableNo,
              blindLevelIndex: this.tournamentContext.blindLevelIndex,
              blindLevel: this.tournamentContext.blindLevel,
              currentMinBet: this.tableMinBet,
              currentSmallBlind: Number(this.tournamentContext.currentSmallBlind || this.tableMinBet / 2),
              currentBigBlind: Number(this.tournamentContext.currentBigBlind || this.tableMinBet),
              nextBlindAt: this.tournamentContext.nextBlindAt || null,
              blindIntervalMinutes: this.tournamentContext.blindIntervalMinutes,
            }
          : null,
      },
    };
    response.data.playersData = this.players.map(player => ({
      playerId: player.playerId,
      playerName: player.playerName,
      playerMoney: player.playerMoney,
      totalBet: player.totalBet,
      isPlayerTurn: player.isPlayerTurn,
      isFold: player.isFold,
      timeLeft: player.playerTimeLeft,
      timeBar: (player.playerTimeLeft / this.turnTimeOut) * 100,
      actionsAvailable: player.actionsAvailable
    }));
    if (JSON.stringify(this.updateJsonTemp) !== JSON.stringify(response)) {
      this.updateJsonTemp = response;
      this.players.forEach((_, i) => this.sendWebSocketData(i, response));
      this.playersToAppend.forEach((_, w) => this.sendWaitingPlayerWebSocketData(w, response));
      this.spectators.forEach((_, s) => this.sendSpectatorWebSocketData(s, response));
      this.emitTournamentStateSync();
    }
  }


  holeCards(): void {
    this.currentStage = HoldemStage.TWO_PRE_FLOP;
    for (let cardIndex = 0; cardIndex < 2; cardIndex++) {
      for (let i = 0; i < this.players.length; i++) {
        const c = this.getNextDeckCard();
        logger.debug(`Player ${this.players[i].playerName} got card ${c}`);
        this.players[i].playerCards[cardIndex] = c;
      }
    }
    let response: ClientResponse = {key: 'holeCards', data: {}};
    for (let i = 0; i < this.players.length; i++) {
      response.data.players = [];
      for (let p = 0; p < this.players.length; p++) {
        let playerData: PlayerData = {};
        playerData.playerId = this.players[p].playerId;
        playerData.playerName = this.players[p].playerName;
        this.players[p].playerId === this.players[i].playerId ? playerData.cards = this.players[p].playerCards : playerData.cards = [];
        response.data.players.push(playerData);
      }
      this.sendWebSocketData(i, response);
    }
    response.data.players = [];
    for (let i = 0; i < this.players.length; i++) {
      let playerData: PlayerData = {};
      playerData.playerId = this.players[i].playerId;
      playerData.cards = []; // Empty cards, otherwise causes security problem
      response.data.players.push(playerData);
    }
    for (let i = 0; i < this.spectators.length; i++) {
      this.sendSpectatorWebSocketData(i, response);
    }
    this.holeCardsGiven = true;
    setTimeout(() => {
      this.staging();
    }, 3000);
  }

  theFlop(): void {
    this.currentStage = HoldemStage.FOUR_POST_FLOP;
    this.middleCards[0] = this.getNextDeckCard();
    this.middleCards[1] = this.getNextDeckCard();
    this.middleCards[2] = this.getNextDeckCard();
    let response: ClientResponse = {key: 'theFlop', data: {}};
    response.data.middleCards = this.middleCards;
    for (let p = 0; p < this.players.length; p++) {
      this.sendWebSocketData(p, response);
    }
    for (let w = 0; w < this.playersToAppend.length; w++) {
      this.sendWaitingPlayerWebSocketData(w, response);
    }
    for (let s = 0; s < this.spectators.length; s++) {
      this.sendSpectatorWebSocketData(s, response);
    }
    setTimeout(() => {
      this.staging();
    }, 2000);
  }

  theTurn(): void {
    this.currentStage = HoldemStage.SIX_THE_POST_TURN;
    this.middleCards[3] = this.getNextDeckCard();
    let response: ClientResponse = {key: 'theTurn', data: {}};
    response.data.middleCards = this.middleCards;
    for (let p = 0; p < this.players.length; p++) {
      this.sendWebSocketData(p, response);
    }
    for (let w = 0; w < this.playersToAppend.length; w++) {
      this.sendWaitingPlayerWebSocketData(w, response);
    }
    for (let s = 0; s < this.spectators.length; s++) {
      this.sendSpectatorWebSocketData(s, response);
    }
    setTimeout(() => {
      this.staging();
    }, 1500);
  }

  theRiver(): void {
    this.currentStage = HoldemStage.EIGHT_THE_SHOW_DOWN;
    this.middleCards[4] = this.getNextDeckCard();
    let response: ClientResponse = {key: 'theRiver', data: {}};
    response.data.middleCards = this.middleCards;
    for (let p = 0; p < this.players.length; p++) {
      this.sendWebSocketData(p, response);
    }
    for (let w = 0; w < this.playersToAppend.length; w++) {
      this.sendWaitingPlayerWebSocketData(w, response);
    }
    for (let s = 0; s < this.spectators.length; s++) {
      this.sendSpectatorWebSocketData(s, response);
    }
    setTimeout(() => {
      this.staging();
    }, 1500);
  }

  sendAllPlayersCards(): void {
    this.currentStage = HoldemStage.TEN_RESULTS;
    let response: ClientResponse = {key: 'allPlayersCards', data: {}};
    response.data.players = [];
    for (let i = 0; i < this.players.length; i++) {
      let playerData: PlayerData = {};
      playerData.playerId = this.players[i].playerId;
      playerData.cards = this.players[i].playerCards;
      response.data.players.push(playerData);
    }
    for (let p = 0; p < this.players.length; p++) {
      this.sendWebSocketData(p, response);
    }
    for (let a = 0; a < this.playersToAppend.length; a++) {
      this.sendWaitingPlayerWebSocketData(a, response);
    }
    for (let s = 0; s < this.spectators.length; s++) {
      this.sendSpectatorWebSocketData(s, response);
    }
    setTimeout(() => {
      this.staging();
    }, 2000);
  }

  roundResultsEnd(): void {
    this.evaluateActiveHands();
    this.potBreakdown = this.buildPotBreakdown();
    const resolvedPots = this.resolvePotBreakdown(this.potBreakdown);

    this.roundWinnerPlayerIds = resolvedPots.winnerPlayerIds;
    this.roundWinnerPlayerCards = resolvedPots.winnerPlayerCards;
    this.roundWinnerPayouts = resolvedPots.payouts;
    this.roundResultMessage = resolvedPots.resultMessage;
    this.totalPot = resolvedPots.totalAwardedPot;
    this.currentStatusText =
      this.roundWinnerPayouts.length > 0
        ? `${this.roundWinnerPayouts.map((winner) => winner.playerName).join(' / ')} 赢得奖池`
        : '本局结算完成';

    const winnerPlayers = this.players
      .map((player, index) => ({player, index}))
      .filter(({player}) => this.roundWinnerPlayerIds.includes(player.playerId))
      .map(({index}) => index);

    logger.info(
      `${this.tableName} winners are ${this.roundWinnerPayouts
        .map((winner) => `${winner.playerName}:${winner.amount}`)
        .join(', ')}`
    );

    // noinspection JSIgnoredPromiseFromCall
    this.updateLoggedInPlayerDatabaseStatistics(winnerPlayers, this.lastWinnerPlayers);
    this.lastWinnerPlayers = winnerPlayers;
    this.isResultsCall = true;

    setTimeout(() => {
      this.gameStarted = false;
      this.triggerNewGame();
    }, this.afterRoundCountDown);
  }

  roundResultsMiddleOfTheGame(): void {
    let winnerPlayer = -1;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] !== null) {
        if (!this.players[i].isFold) {
          winnerPlayer = i;
          break;
        }
      }
    }
    if (winnerPlayer !== -1) {
      this.collectChipsToPotAndSendAction();
      this.collectingPot = false;
      this.potBreakdown = this.buildPotBreakdown();
      const resolvedPots = this.resolvePotBreakdown(this.potBreakdown);

      this.currentStatusText = this.players[winnerPlayer].playerName + ' is only standing player!';
      this.currentTurnText = '';
      this.isResultsCall = true;
      this.roundWinnerPlayerIds = resolvedPots.winnerPlayerIds;
      this.roundWinnerPlayerCards = resolvedPots.winnerPlayerCards;
      this.roundWinnerPayouts = resolvedPots.payouts;
      this.roundResultMessage = resolvedPots.resultMessage;
      this.totalPot = resolvedPots.totalAwardedPot;
      this.sendStatusUpdate();
      // noinspection JSIgnoredPromiseFromCall
      this.updateLoggedInPlayerDatabaseStatistics([winnerPlayer], this.lastWinnerPlayers);
      this.lastWinnerPlayers = [winnerPlayer]; // Take new reference of winner player
    }
    setTimeout(() => {
      this.gameStarted = false;
      this.triggerNewGame();
    }, gameConfig.games.holdEm.games[this.holdemType].afterRoundCountdown * 1000);
  }

  bettingRound(currentPlayerTurn: number): void {
    if (this.hasActivePlayers()) { // Checks that game has active players (not fold ones)
      let verifyBets = this.verifyPlayersBets(); // Active players have correct amount of money in game
      let noRoundPlayedPlayer = this.getNotRoundPlayedPlayer(); // Returns player position who has not played it's round
      if (currentPlayerTurn >= this.players.length || this.isCallSituation && verifyBets === -1 || verifyBets === -1 && noRoundPlayedPlayer === -1) {
        this.resetPlayerStates();
        if (verifyBets === -1 && this.smallBlindGiven) {
          if (noRoundPlayedPlayer === -1) {
            this.currentStage = this.currentStage + 1;
            if (this.collectChipsToPotAndSendAction()) { // Collect pot and send action if there is pot to collect
              setTimeout(() => {
                this.collectingPot = false;
                this.staging();
              }, 2500); // Have some time to collect pot and send action
            } else {
              setTimeout(() => {
                this.staging(); // No pot to collect, continue without timing
              }, 500);
            }
          } else {
            this.players[noRoundPlayedPlayer].isPlayerTurn = true;
            this.players[noRoundPlayedPlayer].actionsAvailable = ['CHECK', 'CALL', 'FOLD', 'RAISE'];
            this.players[noRoundPlayedPlayer].playerTimeLeft = this.turnTimeOut;
            this.currentTurnText = '' + this.players[noRoundPlayedPlayer].playerName + ' Turn';
            this.sendStatusUpdate();
            if (this.players[noRoundPlayedPlayer].isBot) {
              this.botActionHandler(noRoundPlayedPlayer);
            }
            this.bettingRoundTimer(noRoundPlayedPlayer);
          }
        } else {
          this.isCallSituation = true;
          this.queueBettingRound(verifyBets);
        }
      } else {
        if (this.players[currentPlayerTurn] != null || this.isCallSituation && verifyBets === -1 || !this.smallBlindGiven || !this.bigBlindGiven || !this.bigBlindPlayerHadTurn) { // 07.08.2018, added || !this.bigBlindPlayerHadTurn
          // Forced small and big blinds case
          if (this.currentStage === HoldemStage.TWO_PRE_FLOP && (!this.smallBlindGiven || !this.bigBlindGiven)) {
            this.playerCheck(this.players[currentPlayerTurn].playerId);
            this.queueBettingRound(currentPlayerTurn + 1);
          } else {
            if (!this.players[currentPlayerTurn].isFold && !this.players[currentPlayerTurn].isAllIn) {
              if (verifyBets !== -1 || !this.smallBlindGiven || !this.bigBlindGiven) {
                this.isCallSituation = true;
              }
              // player's turn
              this.players[currentPlayerTurn].isPlayerTurn = true;
              this.players[currentPlayerTurn].actionsAvailable = ['CHECK', 'CALL', 'FOLD', 'RAISE'];
              this.players[currentPlayerTurn].playerTimeLeft = this.turnTimeOut;
              this.currentTurnText = '' + this.players[currentPlayerTurn].playerName + ' Turn';
              this.sendStatusUpdate();

              if (this.players[currentPlayerTurn].isBot) {
                this.botActionHandler(currentPlayerTurn);
              }
              this.bettingRoundTimer(currentPlayerTurn);
            } else {
              this.current_player_turn = this.current_player_turn + 1;
              this.queueBettingRound(this.current_player_turn);
            }
          }
        } else {
          if (this.isCallSituation && verifyBets !== -1) {
            this.queueBettingRound(verifyBets);
          } else {
            this.current_player_turn = this.current_player_turn + 1;
            this.queueBettingRound(this.current_player_turn);
          }
        }
      }
    } else {
      this.roundResultsMiddleOfTheGame();
    }
  }

  private queueBettingRound(nextPlayerTurn: number): void {
    setTimeout(() => {
      this.bettingRound(nextPlayerTurn);
    }, 0);
  }

  bettingRoundTimer(currentPlayerTurn: number): void {
    let turnTime = 0;
    this.turnIntervalObj = setInterval(() => {
      if (this.players[currentPlayerTurn] !== null) {
        if (this.players[currentPlayerTurn].playerState === PlayerState.NONE) {
          turnTime = turnTime + 1000;
          this.players[currentPlayerTurn].playerTimeLeft = this.turnTimeOut - turnTime;
        } else {
          this.clearTimers();
          this.queueBettingRound(currentPlayerTurn + 1);
        }
      } else {
        this.clearTimers();
        this.queueBettingRound(currentPlayerTurn + 1);
      }
    }, 500);
    this.turnTimeOutObj = setTimeout(() => {
      if (this.players[currentPlayerTurn].playerState === PlayerState.NONE) {
        this.playerFold(this.players[currentPlayerTurn].playerId);
        this.sendStatusUpdate();
      }
      this.clearTimers();
      this.queueBettingRound(currentPlayerTurn + 1);
    }, this.turnTimeOut + 200);
  }

  clearTimers(): void {
    if (this.turnIntervalObj !== null) {
      clearInterval(this.turnIntervalObj);
    }
    if (this.turnTimeOutObj !== null) {
      clearTimeout(this.turnTimeOutObj);
    }
  }

  playerFold(playerId: number): void {
    let playerIndex = this.getPlayerIndex(playerId);
    if (this.players[playerIndex] !== undefined) {
      if (this.players[playerIndex].socket != null || this.players[playerIndex].isBot) {
        if (playerIndex !== -1) {
          if (!this.smallBlindGiven || !this.bigBlindGiven) {
            let blind_amount = 0;
            if (!this.smallBlindGiven && !this.bigBlindGiven) {
              blind_amount = (this.tableMinBet / 2);
              this.smallBlindGiven = true;
            } else if (this.smallBlindGiven && !this.bigBlindGiven) {
              blind_amount = this.tableMinBet;
              this.bigBlindGiven = true;
            }
            if (blind_amount <= this.players[playerIndex].playerMoney) {
              if (blind_amount === this.players[playerIndex].playerMoney || this.someOneHasAllIn()) {
                this.players[playerIndex].isAllIn = true;
              }
              this.players[playerIndex].totalBet = this.players[playerIndex].totalBet + blind_amount;
              this.players[playerIndex].playerMoney = this.players[playerIndex].playerMoney - blind_amount;
            }
          }
          this.players[playerIndex].setStateFold();
          this.checkHighestBet();
          this.sendLastPlayerAction(playerId, PlayerActions.FOLD);
          this.sendAudioCommand('fold');
        }
      }
    }
  }

  playerCheck(playerId: number): void {
    let playerIndex = this.getPlayerIndex(playerId);
    if (this.players[playerIndex].socket != null || this.players[playerIndex].isBot) {
      if (playerIndex !== -1) {
        let check_amount = 0;
        if (this.isCallSituation || this.totalPot === 0 || !this.smallBlindGiven || !this.bigBlindGiven) {
          if (this.smallBlindGiven && this.bigBlindGiven) {
            check_amount = this.currentHighestBet === 0
              ? this.tableMinBet
              : this.getCallAmount(playerIndex);
          } else {
            if (this.smallBlindGiven && !this.bigBlindGiven) {
              check_amount = this.tableMinBet;
              this.bigBlindGiven = true;
              this.players[playerIndex].roundPlayed = false;
            } else {
              check_amount = this.tableMinBet / 2;
              this.smallBlindGiven = true;
            }
          }

          const contributedAmount = this.contributeChips(playerIndex, check_amount);
          this.players[playerIndex].setStateCheck();

          if (this.isCallSituation) {
            this.sendLastPlayerAction(playerId, PlayerActions.CALL);
          }

          if (
            contributedAmount < check_amount &&
            this.players[playerIndex].playerMoney === 0
          ) {
            this.players[playerIndex].isAllIn = true;
          }
        } else {
          this.players[playerIndex].setStateCheck();
          this.sendLastPlayerAction(playerId, PlayerActions.CHECK);
        }
        if (this.isCallSituation || check_amount > 0) {
          this.sendAudioCommand('call');
        } else {
          this.sendAudioCommand('check');
        }
        this.checkHighestBet();
      }
    }
  }

  playerRaise(playerId: number, amount: number): void {
    let playerIndex = this.getPlayerIndex(playerId);
    if (this.players[playerIndex].socket !== null || this.players[playerIndex].isBot) {
      if (playerIndex !== -1) {
        const previousHighestBet = this.currentHighestBet;
        const playerBetDifference = this.getCallAmount(playerIndex);
        const player = this.players[playerIndex];
        let desiredContribution = amount;

        if (desiredContribution <= 0) {
          desiredContribution = playerBetDifference > 0 ? playerBetDifference : this.tableMinBet;
        }

        if (desiredContribution < playerBetDifference) {
          desiredContribution = playerBetDifference + desiredContribution;
        }

        const maxTotalBet = player.totalBet + player.playerMoney;
        const tentativeContribution = Math.max(0, Math.min(desiredContribution, player.playerMoney));
        const tentativeTotalBet = player.totalBet + tentativeContribution;
        const isUnderMinimumRaise =
          playerBetDifference > 0 &&
          tentativeTotalBet > previousHighestBet &&
          tentativeTotalBet < (previousHighestBet + this.minimumRaiseAmount);
        const canAffordMinimumRaise = maxTotalBet >= (previousHighestBet + this.minimumRaiseAmount);

        if (isUnderMinimumRaise && canAffordMinimumRaise) {
          desiredContribution = playerBetDifference;
        }

        const contributedAmount = this.contributeChips(playerIndex, desiredContribution);
        const updatedTotalBet = this.players[playerIndex].totalBet;
        const raiseSize = updatedTotalBet - previousHighestBet;
        const isShortAllInCall =
          updatedTotalBet < previousHighestBet && this.players[playerIndex].playerMoney === 0;
        const isRealRaise = updatedTotalBet > previousHighestBet;

        if (contributedAmount > 0) {
          this.players[playerIndex].setStateRaise();
          this.isCallSituation = true;

          if (isRealRaise) {
            this.currentHighestBet = updatedTotalBet;
            if (raiseSize >= this.minimumRaiseAmount) {
              this.minimumRaiseAmount = raiseSize;
            }
          }

          if (!this.smallBlindGiven || !this.bigBlindGiven) {
            if (contributedAmount >= (this.tableMinBet / 2)) {
              this.smallBlindGiven = true;
            }
            if (contributedAmount >= this.tableMinBet) {
              this.bigBlindGiven = true;
            }
          }
        }

        this.sendLastPlayerAction(
          playerId,
          isRealRaise && !isShortAllInCall ? PlayerActions.RAISE : PlayerActions.CALL
        );
        this.sendAudioCommand(isRealRaise && !isShortAllInCall ? 'raise' : 'call');
        this.checkHighestBet();
      }
    }
  }

  checkHighestBet(): void {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].totalBet > this.currentHighestBet) {
        this.currentHighestBet = this.players[i].totalBet;
      }
    }
  }

  private getCallAmount(playerIndex: number): number {
    return Math.max(0, this.currentHighestBet - this.players[playerIndex].totalBet);
  }

  private contributeChips(playerIndex: number, requestedAmount: number): number {
    const player = this.players[playerIndex];
    const contributedAmount = Math.max(0, Math.min(requestedAmount, player.playerMoney));

    if (contributedAmount === 0) {
      return 0;
    }

    player.totalBet = player.totalBet + contributedAmount;
    player.handContribution = player.handContribution + contributedAmount;
    player.playerMoney = player.playerMoney - contributedAmount;

    if (player.playerMoney === 0) {
      player.isAllIn = true;
    }

    return contributedAmount;
  }

  private solvePlayerShowdownHand(player: Player): any | null {
    const boardCards = this.middleCards.filter((card): card is string => Boolean(card));
    const holeCards = (player.playerCards || []).filter((card): card is string => Boolean(card));

    if (boardCards.length !== 5 || holeCards.length !== 2) {
      return null;
    }

    try {
      return Hand.solve(asciiToStringCardsArray([...boardCards, ...holeCards]));
    } catch (error) {
      logger.error(`Failed to solve holdem hand for ${player.playerName}`, error);
      return null;
    }
  }

  private getFallbackHandEvaluation(cardsToEvaluate: string[]): HandEvaluationInterface {
    try {
      const solvedHand = Hand.solve(asciiToStringCardsArray(cardsToEvaluate));
      const handTypeMap: { [key: string]: number } = {
        'high card': 1,
        'pair': 2,
        'two pair': 3,
        'three of a kind': 4,
        'straight': 5,
        'flush': 6,
        'full house': 7,
        'four of a kind': 8,
        'straight flush': 9,
      };
      const handType = handTypeMap[(solvedHand?.name || '').toLowerCase()] || 0;

      return {
        value: handType << 12,
        handName: (solvedHand?.name || '').toLowerCase() || null,
        handType,
        handRank: 0,
      };
    } catch (error) {
      logger.error(`Failed to solve fallback holdem hand: ${cardsToEvaluate.join(',')}`, error);
      return {value: 0, handName: null};
    }
  }

  private selectWinningPlayers(eligiblePlayers: Player[], solvedHandMap: Map<number, any>): Player[] {
    const solvedEligibleHands = eligiblePlayers
      .map((player) => ({
        player,
        solvedHand: solvedHandMap.get(player.playerId),
      }))
      .filter((entry) => entry.solvedHand != null);

    if (solvedEligibleHands.length === 0) {
      const highestHandValue = Math.max(...eligiblePlayers.map((player) => player.handValue));
      return eligiblePlayers.filter((player) => player.handValue === highestHandValue);
    }

    const winnerHands = Hand.winners(solvedEligibleHands.map((entry) => entry.solvedHand));
    return solvedEligibleHands
      .filter((entry) => winnerHands.includes(entry.solvedHand))
      .map((entry) => entry.player);
  }

  private evaluateActiveHands(): void {
    for (let i = 0; i < this.players.length; i++) {
      if (!this.players[i].isFold) {
        const solvedHand = this.solvePlayerShowdownHand(this.players[i]);
        const evaluated = this.evaluatePlayerCards(i);
        this.players[i].handValue = evaluated.value;
        this.players[i].cardsInvolvedOnEvaluation = solvedHand?.cards || [];
        this.players[i].handName = solvedHand?.descr || solvedHand?.name || evaluated.handName;
        logger.info(
          `${this.players[i].playerName} has ${this.players[i].handName} with value ${this.players[i].handValue} cards involved ${solvedHand?.cards || []}`
        );
      }
    }
  }

  private buildPotBreakdown(): PotBreakdownInterface[] {
    const positiveLevels = Array.from(new Set(
      this.players
        .map((player) => Number(player.handContribution || 0))
        .filter((contribution) => contribution > 0)
    )).sort((a, b) => a - b);

    const potBreakdown: PotBreakdownInterface[] = [];
    let previousLevel = 0;
    let contestedPotCount = 0;

    for (const level of positiveLevels) {
      const contributors = this.players.filter(
        (player) => Number(player.handContribution || 0) >= level
      );
      const amount = (level - previousLevel) * contributors.length;

      if (amount <= 0 || contributors.length === 0) {
        previousLevel = level;
        continue;
      }

      const eligiblePlayers = contributors.filter((player) => !player.isFold);
      if (eligiblePlayers.length === 0) {
        previousLevel = level;
        continue;
      }

      if (contributors.length === 1) {
        potBreakdown.push({
          type: 'refund',
          label: '未跟注返还',
          amount,
          eligiblePlayerIds: [contributors[0].playerId],
          winnerPlayerIds: [contributors[0].playerId],
          handName: null,
        });
      } else {
        contestedPotCount = contestedPotCount + 1;
        potBreakdown.push({
          type: contestedPotCount === 1 ? 'main' : 'side',
          label: contestedPotCount === 1 ? '主池' : `边池${contestedPotCount - 1}`,
          amount,
          eligiblePlayerIds: eligiblePlayers.map((player) => player.playerId),
        });
      }

      previousLevel = level;
    }

    return potBreakdown;
  }

  private resolvePotBreakdown(potBreakdown: PotBreakdownInterface[]): {
    payouts: PlayerData[];
    winnerPlayerIds: number[];
    winnerPlayerCards: any[];
    totalAwardedPot: number;
    resultMessage: string;
  } {
    const payoutMap = new Map<number, PlayerData>();
    const winnerCardMap = new Map<number, any>();
    const solvedHandMap = new Map<number, any>();
    let totalAwardedPot = 0;

    for (const player of this.players) {
      if (!player.isFold) {
        const solvedHand = this.solvePlayerShowdownHand(player);
        if (solvedHand != null) {
          solvedHandMap.set(player.playerId, solvedHand);
        }
      }
    }

    for (const pot of potBreakdown) {
      const eligiblePlayers = this.players.filter((player) =>
        pot.eligiblePlayerIds.includes(player.playerId)
      );

      if (!eligiblePlayers.length) {
        continue;
      }

      if (pot.type === 'refund') {
        eligiblePlayers[0].playerMoney = eligiblePlayers[0].playerMoney + pot.amount;
        pot.winnerPlayerIds = [eligiblePlayers[0].playerId];
        continue;
      }

      const winners = eligiblePlayers.length > 1
        ? this.selectWinningPlayers(eligiblePlayers, solvedHandMap)
        : eligiblePlayers;

      const amountPerWinner = pot.amount / winners.length;
      totalAwardedPot = totalAwardedPot + pot.amount;
      pot.winnerPlayerIds = winners.map((player) => player.playerId);
      pot.handName = winners[0]?.handName || null;

      for (const winner of winners) {
        winner.playerMoney = winner.playerMoney + amountPerWinner;
        const existingPayout = payoutMap.get(winner.playerId);

        payoutMap.set(winner.playerId, {
          playerId: winner.playerId,
          playerName: winner.playerName,
          amount: Number(existingPayout?.amount || 0) + amountPerWinner,
          handName: winner.handName,
        });

        if (!winnerCardMap.has(winner.playerId)) {
          winnerCardMap.set(
            winner.playerId,
            stringToAsciiCardsArray(winner.cardsInvolvedOnEvaluation || [])
          );
        }
      }
    }

    const payouts = Array.from(payoutMap.values());
    const resultMessage = payouts.length === 0
      ? '本局结算完成'
      : payouts.length === 1
        ? `${payouts[0].playerName} 赢得 ${payouts[0].amount}`
        : payouts.map((winner) => `${winner.playerName} ${winner.amount}`).join(' / ');

    return {
      payouts,
      winnerPlayerIds: payouts.map((winner) => Number(winner.playerId)),
      winnerPlayerCards: payouts.map((winner) => winnerCardMap.get(Number(winner.playerId))),
      totalAwardedPot,
      resultMessage,
    };
  }

  sendWebSocketData(playerIndex: number, data: any): void {
    const player = this.players[playerIndex];
    if (player != null && !player.isBot && player.selectedTableId === this.tableId) {
      if (player.socket != null) {
        if (player.socket.readyState === SocketState.OPEN) {
          player.socket.send(JSON.stringify(data));
        } else {
          player.socket = null;
        }
      } else if (!this.tournamentContext) {
        player.setStateFold();
      }
    }
  }

  sendWaitingPlayerWebSocketData(player: any, data: any): void {
    if (
      this.playersToAppend[player] != null &&
      !this.playersToAppend[player].isBot &&
      this.playersToAppend[player].selectedTableId === this.tableId
    ) {
      if (this.playersToAppend[player].socket != null) {
        if (this.playersToAppend[player].socket.readyState === SocketState.OPEN) {
          this.playersToAppend[player].socket.send(JSON.stringify(data));
        } else {
          this.playersToAppend[player].socket = null;
        }
      }
    }
  }

  sendSpectatorWebSocketData(spectator: any, data: any): void {
    if (
      this.spectators[spectator] != null &&
      this.spectators[spectator].selectedTableId === this.tableId
    ) {
      if (this.spectators[spectator].socket != null) {
        if (this.spectators[spectator].socket.readyState === SocketState.OPEN) {
          this.spectators[spectator].socket.send(JSON.stringify(data));
        }
      }
    }
  }

  sendAudioCommand(action: string): void {
    let response: ClientResponse = {key: 'audioCommand', data: {}};
    response.data.command = action;
    for (let i = 0; i < this.players.length; i++) {
      this.updateJsonTemp = response;
      this.sendWebSocketData(i, response);
    }
    for (let w = 0; w < this.playersToAppend.length; w++) {
      this.sendWaitingPlayerWebSocketData(w, response);
    }
    for (let s = 0; s < this.spectators.length; s++) {
      this.sendSpectatorWebSocketData(s, response);
    }
  }

  sendLastPlayerAction(playerId: number, playerAction: PlayerAction): void {
    let response = {key: '', data: {}};
    response.key = 'lastUserAction';
    this.lastUserAction.playerId = playerId;
    this.lastUserAction.actionText = playerAction;
    response.data = this.lastUserAction;
    for (let i = 0; i < this.players.length; i++) {
      this.updateJsonTemp = response;
      this.sendWebSocketData(i, response);
    }
    for (let w = 0; w < this.playersToAppend.length; w++) {
      this.sendWaitingPlayerWebSocketData(w, response);
    }
    for (let s = 0; s < this.spectators.length; s++) {
      this.sendSpectatorWebSocketData(s, response);
    }
  }

  collectChipsToPotAndSendAction(): boolean {
    let boolMoneyToCollect = false;
    for (let u = 0; u < this.players.length; u++) {
      if (this.players[u].totalBet > 0) {
        boolMoneyToCollect = true;
      }
      this.totalPot = this.totalPot + this.players[u].totalBet; // Get round bet to total pot
      this.players[u].totalBet = 0; // It's collected, we can empty players total bet
    }
    // Send animation action
    if (boolMoneyToCollect) {
      this.collectingPot = true;
      let response = {key: '', data: {}};
      response.key = 'collectChipsToPot';
      for (let i = 0; i < this.players.length; i++) {
        this.updateJsonTemp = response;
        this.sendWebSocketData(i, response);
      }
      for (let w = 0; w < this.playersToAppend.length; w++) {
        this.sendWaitingPlayerWebSocketData(w, response);
      }
      for (let s = 0; s < this.spectators.length; s++) {
        this.sendSpectatorWebSocketData(s, response);
      }
      return true; // Money to collect, wait before continuing to staging
    }
    return false; // No money to collect, continue staging without delay
  }

  getNextDeckCard(): string {
    let nextCard = this.deck[this.deckCard];
    this.deckCard = this.deckCard + 1;
    return nextCard;
  }

  getPlayerIndex(playerId: number): number {
    return this.players.findIndex(player => player.playerId === playerId);
  }

  hasActivePlayers(): boolean {
    let count = 0;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] !== null) {
        if (!this.players[i].isFold) {
          count = count + 1;
        }
      }
    }
    return count > 1;
  }

  someOneHasAllIn(): boolean {
    let count = 0;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].isAllIn) {
        count = count + 1;
      }
    }
    return count > 0;
  }

  setNextDealerPlayer(): void {
    this.dealerPlayerArrayIndex = this.dealerPlayerArrayIndex + 1;
    if (this.dealerPlayerArrayIndex >= this.players.length) {
      this.dealerPlayerArrayIndex = 0;
    }
    this.players[this.dealerPlayerArrayIndex].isDealer = true;
  }

  getNextSmallBlindPlayer(): void {
    if (this.players.length > 2) {
      this.smallBlindPlayerArrayIndex = this.dealerPlayerArrayIndex + 1;
      if (this.smallBlindPlayerArrayIndex >= this.players.length) {
        this.smallBlindPlayerArrayIndex = 0;
      }
    } else {
      this.smallBlindPlayerArrayIndex = this.dealerPlayerArrayIndex;
    }
  }

  getNextBigBlindPlayer(): number {
    let bigBlindPlayerIndex = this.smallBlindPlayerArrayIndex + 1;
    if (bigBlindPlayerIndex >= this.players.length) {
      bigBlindPlayerIndex = 0;
    }
    return bigBlindPlayerIndex;
  }

  resetRoundParameters(): void {
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].roundPlayed = false;
    }
    this.minimumRaiseAmount = this.tableMinBet;
  }

  getNotRoundPlayedPlayer(): number {
    // Check that all players have had their turn
    for (let i = 0; i < this.players.length; i++) {
      if (!this.players[i].isFold && !this.players[i].roundPlayed && !this.players[i].isAllIn) {
        return i;
      }
    }
    // Check that big blind player have had its turn
    if (
      this.currentStage === HoldemStage.TWO_PRE_FLOP &&
      this.smallBlindGiven &&
      this.bigBlindGiven &&
      !this.bigBlindPlayerHadTurn
    ) {
      this.bigBlindPlayerHadTurn = true;
      let bigBlindPlayer = this.getNextBigBlindPlayer();
      this.players[bigBlindPlayer].playerState = PlayerState.NONE;
      this.players[bigBlindPlayer].roundPlayed = false;
      return bigBlindPlayer;
    }
    return -1; // Otherwise return -1 to continue
  }

  evaluatePlayerCards(currentPlayer: number): HandEvaluationInterface {
    let cardsToEvaluate = [];
    let ml = this.middleCards.length;
    // Push available middle cards
    for (let i = 0; i < ml; i++) {
      if (this.middleCards[i] !== void 0) { // Index is not 'undefined'
        cardsToEvaluate.push(this.middleCards[i]);
      }
    }
    // Push player hole cards
    if (this.players[currentPlayer] === undefined) {
      return {value: 0, handName: null};
    } else {
      if (this.players[currentPlayer].playerCards == null || this.players[currentPlayer].playerCards === undefined) {
        return {value: 0, handName: null};
      } else {
        cardsToEvaluate.push(this.players[currentPlayer].playerCards[0]);
        cardsToEvaluate.push(this.players[currentPlayer].playerCards[1]);
        let cl = cardsToEvaluate.length;
        if (cl === 3 || cl === 5 || cl === 6 || cl === 7) {
          try {
            return evaluator.evalHand(cardsToEvaluate);
          } catch (error) {
            const fallbackEvaluation = this.getFallbackHandEvaluation(cardsToEvaluate);
            if (fallbackEvaluation.value > 0) {
              return fallbackEvaluation;
            }
            logger.error(`Failed to evaluate holdem hand: ${cardsToEvaluate.join(',')}`, error);
            return fallbackEvaluation;
          }
        } else {
          return {value: 0, handName: null};
        }
      }
    }
  }

  async updateLoggedInPlayerDatabaseStatistics(winnerPlayers: number[], lastWinnerPlayers: any): Promise<void> {
    if (this.tournamentContext) {
      return;
    }

    for (let index: number = 0; index < this.players.length; index++) {
      const player = this.players[index];
      if (player && player.socket) {
        if (!player.isBot && player.isLoggedInPlayer() && player.playerDatabaseId > 0) {
          if (containsValue(winnerPlayers, index)) {
            let winStreak: boolean = containsValue(lastWinnerPlayers, index);
            const user = await User.findOne({where: {id: player.playerDatabaseId}});
            if (user) {
              const incrementXp: number = (winStreak ? WIN_STREAK_XP : WIN_XP);
              await user.update({
                win_count: user.win_count + 1,
                xp: user.xp + incrementXp,
                money: player.playerMoney,
                play_count: user.play_count + 1,
              });
              player.playerWinCount = player.playerWinCount + 1;
              const response: ClientResponse = {
                key: 'onXPGained', data: {
                  amount: incrementXp,
                  message: winStreak ? 'XP win streak' : 'XP gained',
                  translationKey: winStreak ? 'XP_GAINED_WIN_STREAK' : 'XP_GAINED',
                }
              };
              this.sendWebSocketData(index, response);
            }
          } else {
            if (this.totalPot >= (this.tableMinBet * this.players.length)) {
              const user = await User.findOne({where: {id: player.playerDatabaseId}});
              if (user) {
                await user.update({
                  lose_count: user.lose_count + 1,
                  money: player.playerMoney,
                  play_count: user.play_count + 1,
                });
                player.playerLoseCount = player.playerLoseCount + 1;
              }
            }
          }
          await Statistic.create({
            userId: player.playerDatabaseId,
            money: player.playerMoney,
            winCount: player.playerWinCount,
            loseCount: player.playerLoseCount,
          });
        }
      }
    }
  }

  burnCard() {
    this.deckCard = this.deckCard + 1;
    this.deckCardsBurned = this.deckCardsBurned + 1;
  };


  resetPlayerParameters() {
    this.resetPlayerStates();
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].resetParams();
      this.players[i].checkFunds(this.tableMinBet);
    }
  };

  resetPlayerStates() {
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].playerState = PlayerState.NONE;
    }
  };

  verifyPlayersBets(): number {
    let highestBet = 0;
    for (let i = 0; i < this.players.length; i++) { // Get the highest bet
      if (this.players[i] != null) {
        if (!this.players[i].isFold) {
          if (highestBet === 0) {
            highestBet = this.players[i].totalBet;
          }
          if (this.players[i].totalBet > highestBet) {
            highestBet = this.players[i].totalBet;
          }
        }
      }
    }
    for (let i = 0; i < this.players.length; i++) { // Find someone with lower bet
      if (this.players[i] != null) {
        if (!this.players[i].isFold && !this.players[i].isAllIn) {
          if (this.players[i].totalBet < highestBet) {
            return i;
          }
        }
      }
    }
    return !this.smallBlindGiven || !this.bigBlindGiven ? 0 : -1;
  }

  botActionHandler(currentPlayerTurn: number): void {
    const botType: BotType = this.players[currentPlayerTurn].botType;
    let check_amount = (this.currentHighestBet === 0 ? this.tableMinBet :
      (this.currentHighestBet - this.players[currentPlayerTurn].totalBet));
    let playerId = this.players[currentPlayerTurn].playerId;
    let botObj = new HoldemBot(
      this.players[currentPlayerTurn].playerName,
      this.players[currentPlayerTurn].playerMoney,
      this.players[currentPlayerTurn].playerCards,
      this.isCallSituation,
      this.tableMinBet,
      check_amount,
      this.evaluatePlayerCards(currentPlayerTurn).value,
      this.currentStage,
      this.players[currentPlayerTurn].totalBet,
      this.totalPot + this.players.reduce((sum, player) => sum + Number(player.totalBet || 0), 0)
    );
    if (botType === 'NORMAL') {
      let resultSet = botObj.performAction();
      let tm = setTimeout(() => {
        switch (resultSet.action) {
          case BOT_FOLD:
            this.playerFold(playerId);
            break;
          case BOT_CHECK:
            this.playerCheck(playerId);
            break;
          case BOT_CALL:
            this.playerCheck(playerId);
            break;
          case BOT_RAISE:
            this.playerRaise(playerId, resultSet.amount);
            break;
          case BOT_REMOVE: // HoldemBot run out of money
            if (this.tournamentContext) {
              this.playerCheck(playerId);
            } else {
              this.playerFold(playerId);
              this.removeBotFromTable(currentPlayerTurn);
            }
            break;
          default:
            this.playerCheck(playerId);
            break;
        }
        this.sendStatusUpdate();

        clearTimeout(tm);
      }, gameConfig.games.holdEm.bot.turnTimes[getRandomInt(1, 4)]);
    } else if (botType === 'AI') {
      // todo
    }
  }

  removeBotFromTable(currentPlayerTurn: number, shouldRequeue = true): void {
    this.players[currentPlayerTurn].socket = null;
    this.players[currentPlayerTurn].selectedTableId = -1;
    if (shouldRequeue && this.players[currentPlayerTurn].isBot && !this.tournamentContext) {
      this.eventEmitter.emit(NEW_BOT_EVENT_KEY, this.tableId, gameConfig.games.holdEm.startMoney);
    }
  }

  private isBotManagedLowTier(): boolean {
    return !this.tournamentContext && this.holdemType <= 1;
  }

  private getHumanPlayerCount(): number {
    const seatedHumans = this.players.filter(
      (player) => player && !player.isBot && player.selectedTableId === this.tableId
    ).length;
    const waitingHumans = this.playersToAppend.filter(
      (player) => player && !player.isBot && player.selectedTableId === this.tableId
    ).length;
    return seatedHumans + waitingHumans;
  }

  private getCurrentBotCount(): number {
    const seatedBots = this.players.filter((player) => player && player.isBot).length;
    const waitingBots = this.playersToAppend.filter((player) => player && player.isBot).length;
    return seatedBots + waitingBots;
  }

  private syncCashTableBots(): void {
    if (this.tournamentContext) {
      return;
    }

    const humanCount = this.getHumanPlayerCount();
    const desiredBotCount = this.isBotManagedLowTier() && humanCount < 3 ? this.targetBotCount : 0;
    const excessBotCount = this.getCurrentBotCount() - desiredBotCount;

    if (excessBotCount > 0) {
      let toRemove = excessBotCount;

      for (let index = this.playersToAppend.length - 1; index >= 0 && toRemove > 0; index--) {
        if (this.playersToAppend[index]?.isBot) {
          this.playersToAppend[index].socket = null;
          this.playersToAppend[index].selectedTableId = -1;
          this.playersToAppend.splice(index, 1);
          toRemove--;
        }
      }

      for (let index = this.players.length - 1; index >= 0 && toRemove > 0; index--) {
        if (this.players[index]?.isBot) {
          this.removeBotFromTable(index, false);
          toRemove--;
        }
      }
    }
  }

  getTableBotCount(): number {
    let l = this.players.length;
    let c = 0;
    for (let i = 0; i < l; i++) {
      if (this.players[i].isBot) {
        c++;
      }
    }
    return c;
  }

  getChatMessages(playerId: number): void {
    const player: Player | null = findPlayerById(playerId, this.players, this.playersToAppend, this.spectators);
    if (player && player.socket) {
      const response: ClientResponse = {
        key: 'getChatMessages', data: {
          messages: [...this.chatMessages],
        }
      };
      if (player.socket.readyState === SocketState.OPEN) {
        player.socket.send(JSON.stringify(response));
      }
    }
  }

  handleChatMessage(playerId: number, message: string): void {
    const player: Player | null = findPlayerById(playerId, this.players, this.playersToAppend, this.spectators);
    if (player) {
      if (this.chatMessages.length >= this.chatMaxSize) {
        this.chatMessages.shift();
      }
      const newMessage: ChatMessage = {playerName: player.playerName, message};
      this.chatMessages.push(newMessage);
      const response: ClientResponse = {key: 'chatMessage', data: {success: true, chatMessage: newMessage}};
      const allRecipients = [
        ...this.players.map((_, i) => () => this.sendWebSocketData(i, response)),
        ...this.playersToAppend.map((_, i) =>
          () => this.sendWaitingPlayerWebSocketData(i, response)
        ),
        ...this.spectators.map((_, i) =>
          () => this.sendSpectatorWebSocketData(i, response)
        ),
      ];
      allRecipients.forEach((send) => send());

      const aiBotPlayer: Player | undefined = findFirstAiBotPlayer(this.players);
      if (!player.isBot && aiBotPlayer) {
        // noinspection JSIgnoredPromiseFromCall
        this.createLlmMessage(aiBotPlayer, player.playerName, message);
      }
    }
  }

  private async createLlmMessage(
    aiBotPlayer: Player, msgPlayerName: string, userMsg: string
  ) {

    if (aiBotPlayer && process.env.JAN_AI_SERVER_ADDRESS) {
      // const llmMsg: string | null = await fetchLLMChatCompletion(
      //   this.game,
      //   aiBotPlayer.playerName,
      //   aiBotPlayer.playerCards,
      //   this.middleCards,
      //   msgPlayerName,
      //   userMsg
      // );
      // if (llmMsg) {
      //   await sleep(1000);
      //   this.handleChatMessage(aiBotPlayer.playerId, llmMsg)
      // }
    }
  }

}
