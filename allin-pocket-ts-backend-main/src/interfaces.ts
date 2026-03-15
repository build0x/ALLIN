import WebSocket from 'ws';
import {PlayerState} from './enums';
import {AchievementIcon, ChatMessage, ClientMessageType, Game, PlayerAction, ResponseKey} from './types';

export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
}

export interface GameHandlerInterface {
  createStartingTables(): void;

  onConnection(socket: WebSocket): void;

  onClientDisconnected(socket: WebSocket): void;

  onMessage(socket: WebSocket, message: string): void;

  onError(): void;

  onClose(): void;
}


export interface PlayerInterface {
  socket: WebSocket | null;
  playerId: number;
  isBot: boolean;
  playerMoney: number;
  handContribution: number;
  playerDatabaseId: number;
  selectedTableId: number;
  playerName: string;
  playerWinCount: number;
  playerLoseCount: number;
  playerCards: string[];
  playerState: PlayerState;
  totalBet: number;
  isDealer: boolean;
  isPlayerTurn: boolean;
  playerTimeLeft: number;
  isFold: boolean;
  isAllIn: boolean;
  roundPlayed: boolean;
  handValue: number;
  handName: string | null;
  cardsInvolvedOnEvaluation: { value: string; suit: string; }[];

  resetParams(): void;

  checkFunds(tableMinBet: number): void;

  isLoggedInPlayer(): boolean;

  setPlayerMoney(amount: number): void;

  setStateNone(): void;

  setStateFold(): void;

  setStateCheck(): void;

  setStateRaise(): void;
}

export interface TableInfoInterface {
  game: Game;
  tableId: number;
  tableName: string;
  tableMinBet: number;
  playerCount: number;
  maxSeats: number;
  passwordProtected: boolean;
  roomType?: string;
  expiresAt?: string | Date | null;
  spectatorsCount?: number;
  tournamentInfo?: {
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
  } | null;
}

export interface HoldemTableInterface {

  resetTableParams(): void; // Run before each new round

  setTableInfo(table: UserTableInterface): void;

  getTableInfo(): TableInfoInterface;

  triggerNewGame(): void;

  cleanSpectators(): void;

  startGame(): void;

  newGame(): void; // New deck here

  staging(): void;

  holeCards(): void; // Give players two cards

  theFlop(): void; // Show three middle cards

  theTurn(): void; // Show fourth card

  theRiver(): void; // Show fifth card

  sendAllPlayersCards(): void; // Send all player cards to all clients before round results call

  roundResultsEnd(): void; // Calculate winner and transfer money

  roundResultsMiddleOfTheGame(): void; // Game has stopped middle of the game due everyone folded or disconnected except one

  bettingRound(currentPlayerTurn: number): void;

  bettingRoundTimer(currentPlayerTurn: number): void;

  clearTimers(): void;

  sendStatusUpdate(): void;

  playerFold(playerId: number): void; // Remember that if small or big blind is not given, folding player must still pay blind

  playerCheck(playerId: number): void; // Player checks but also Call goes through this function

  playerRaise(playerId: number, amount: number): void;

  burnCard(): void; // Burn one card before dealing

  resetPlayerParameters(): void;

  resetPlayerStates(): void;

  verifyPlayersBets(): number; // Method checks that every player has correct amount of money in bet

  checkHighestBet(): void;

  getTableParams(): void;

  setTournamentContext?(context: {
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
  }): void;

  sendWebSocketData(player: any, data: any): void; // Send data to table players via this function

  sendWaitingPlayerWebSocketData(player: any, data: any): void; // Send data to waiting table players via this function

  sendSpectatorWebSocketData(spectator: any, data: any): void; // Send table status data to spectators

  cleanSpectators(): void;

  sendAudioCommand(action: string): void; // Needed to be able to play other players command audio on client side

  sendLastPlayerAction(playerId: number, playerAction: PlayerAction): void; // Animated last user action text command

  collectChipsToPotAndSendAction(): boolean; // Collect chips to pot action, collects and clears user total pots for this round

  getNextDeckCard(): string;

  getPlayerIndex(playerId: number): number;

  hasActivePlayers(): boolean;

  someOneHasAllIn(): void;

  setNextDealerPlayer(): void;

  getNextSmallBlindPlayer(): void;

  getNextBigBlindPlayer(): number;

  resetRoundParameters(): void;

  getNotRoundPlayedPlayer(): number;

  evaluatePlayerCards(currentPlayer: number): HandEvaluationInterface;

  updateLoggedInPlayerDatabaseStatistics(winnerPlayers: any, lastWinnerPlayers: any): void;

  botActionHandler(currentPlayerTurn: number): void;

  removeBotFromTable(currentPlayerTurn: number): void;

  getTableBotCount(): number;

  handleChatMessage(playerId: number, message: string): void;

  getChatMessages(playerId: number): void;

}

export interface Player {
  playerId: string | number;
  playerName: string;
  playerMoney: number;
  isDealer: boolean;
}

export interface PlayerData {
  playerId?: number;
  playerName?: string;
  playerMoney?: number;
  isDealer?: boolean;
  cards?: any;
  amount?: number;
  handName?: string | null;
}

export interface PotBreakdownInterface {
  type: 'main' | 'side' | 'refund';
  label: string;
  amount: number;
  eligiblePlayerIds: number[];
  winnerPlayerIds?: number[];
  handName?: string | null;
}

export interface ClientResponse {
  key: ResponseKey;
  data: {
    game?: Game;
    playerId?: number;
    tables?: any[];
    message?: string;
    messages?: ChatMessage[];
    command?: string;
    players?: PlayerData[];
    gameStarted?: boolean;
    playerCount?: number;
    tableMinBet?: number;
    totalPot?: number;
    currentStatus?: string;
    currentTurnText?: string;
    middleCards?: any[];
    playersData?: PlayerData[];
    isCallSituation?: boolean;
    isResultsCall?: boolean;
    roundWinnerPlayerIds?: number[];
    roundWinnerPlayerCards?: any[];
    action?: string;
    amount?: number;
    translationKey?: string;
    clientMessageType?: ClientMessageType;
    cards?: string[];
    timeLeft?: number;
    success?: boolean;
    token?: string;
    stats?: StatsInterface;
    userStats?: UserStatsInterface;
    chatMessage?: ChatMessage;
    ranks?: RanksInterface[];
    table?: UserTableInterface | null;
    tableId?: number;
    initialSpeed?: number;
    deceleration?: number;
    count?: number;
    refreshToken?: string;
    nonce?: string;
    walletAddress?: string;
    signatureMessage?: string;
    expiresAt?: Date;
    economy?: any;
    tournaments?: any[];
    assignment?: any;
    registration?: any;
    tierCode?: string;
    roundWinnerPayouts?: PlayerData[];
    roundResultMessage?: string;
    potBreakdown?: PotBreakdownInterface[];
    tableName?: string;
    playingPlayersCount?: number;
    appendPlayersCount?: number;
    spectatorsCount?: number;
    deckStatus?: string;
    deckCardsBurned?: number;
    collectingPot?: boolean;
    tournamentInfo?: any;
  };
}

export interface HandEvaluationInterface {
  value: number;
  handName: string | null;
  handRank?: number;
  handType?: number;
}

export interface BotInterface {
  performAction(): { action: string; amount: number };
}

export interface StatsInterface {
  totalGames: number;
  totalBots: number;
  totalPlayers: number;
}

export interface AuthInterface {
  success: boolean;
  userId: number;
}

export interface DailyAverageStatsInterface {
  labels: string[];
  averageMoney: number[];
  averageWinCount: number[];
  averageLoseCount: number[];
}

export interface UserStatsInterface {
  username: string;
  money: number;
  winCount: number;
  loseCount: number;
  xp: number;
  avatarIcon?: string | null;
  walletAddress?: string | null;
  allinBalance?: number;
  walletAllinBalance?: number;
  vaultAllinBalance?: number;
  holdAmount?: number;
  lifetimeBurned?: number;
  achievements?: {
    id: number;
    name: string;
    description: string;
    icon: string;
    count: number;
  }[];
  dailyAverageStats?: DailyAverageStatsInterface;
}

export interface RanksInterface {
  username: string;
  xp: number;
  money: number;
  win_count: number;
  lose_count: number;
}

export interface UserTableInterface {
  id: number;
  game: Game;
  tableName: string;
  maxSeats: number;
  botCount: number;
  password: string;
  turnCountdown: number;
  minBet: number;
  afterRoundCountdown: number;
  discardAndDrawTimeout: number;
  roomType?: string;
  expiresAt?: string | Date | null;
  burnAmount?: number;
  durationHours?: number;
}

export interface ChatCompletionResponse {
  choices: {
    finish_reason: string;
    index: number;
    message: {
      content: string;
      role: string;
    };
  }[];
  created: number;
  id: string;
  model: string;
  object: string;
  system_fingerprint: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface AchievementDefinition {
  id: number;
  name: string;
  description: string;
  icon: AchievementIcon;
}
