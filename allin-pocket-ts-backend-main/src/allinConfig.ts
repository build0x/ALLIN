export type CashTierConfig = {
  code: string;
  title: string;
  tableName: string;
  minBet: number;
  minHoldAmount: number;
  rakePercent: number;
  winBurnPercent: number;
  badge: string;
  maxSeats: number;
  botCount: number;
  turnCountdown: number;
  afterRoundCountdown: number;
};

export type TournamentTierConfig = {
  code: string;
  title: string;
  requiredHoldAmount: number;
  buyInAllin: number;
  burnAmount: number;
  bnbPrizeAmount: number;
  minPlayers: number;
  maxPlayers: number;
  startsInMinutes: number;
  badge: string;
};

export const allinConfig = {
  wallet: {
    messageDomain: 'ALLIN',
    chainId: 56,
    nonceExpiresMinutes: 10,
  },
  cashTiers: [
    {
      code: 'bronze',
      title: '青铜常规场',
      tableName: '青铜常规场',
      minBet: 10,
      minHoldAmount: 10,
      rakePercent: 3,
      winBurnPercent: 5,
      badge: 'BRONZE',
      maxSeats: 6,
      botCount: 1,
      turnCountdown: 20,
      afterRoundCountdown: 8,
    },
    {
      code: 'silver',
      title: '白银常规场',
      tableName: '白银常规场',
      minBet: 100,
      minHoldAmount: 100,
      rakePercent: 3,
      winBurnPercent: 5,
      badge: 'SILVER',
      maxSeats: 6,
      botCount: 2,
      turnCountdown: 20,
      afterRoundCountdown: 8,
    },
    {
      code: 'gold',
      title: '黄金常规场',
      tableName: '黄金常规场',
      minBet: 1000,
      minHoldAmount: 1000,
      rakePercent: 3,
      winBurnPercent: 5,
      badge: 'GOLD',
      maxSeats: 6,
      botCount: 0,
      turnCountdown: 20,
      afterRoundCountdown: 8,
    },
    {
      code: 'diamond',
      title: '钻石常规场',
      tableName: '钻石常规场',
      minBet: 10000,
      minHoldAmount: 10000,
      rakePercent: 3,
      winBurnPercent: 5,
      badge: 'DIAMOND',
      maxSeats: 6,
      botCount: 0,
      turnCountdown: 20,
      afterRoundCountdown: 8,
    },
    {
      code: 'master',
      title: '大师常规场',
      tableName: '大师常规场',
      minBet: 100000,
      minHoldAmount: 100000,
      rakePercent: 3,
      winBurnPercent: 5,
      badge: 'MASTER',
      maxSeats: 6,
      botCount: 0,
      turnCountdown: 20,
      afterRoundCountdown: 8,
    },
  ] as CashTierConfig[],
  tournamentTiers: [
    {
      code: 'allin-championship',
      title: 'ALLIN 总锦标赛',
      requiredHoldAmount: 1000000,
      buyInAllin: 100000,
      burnAmount: 0,
      bnbPrizeAmount: 0,
      minPlayers: 6,
      maxPlayers: 60,
      startsInMinutes: 30,
      badge: 'ALLIN CHAMPIONSHIP',
    },
  ] as TournamentTierConfig[],
};
