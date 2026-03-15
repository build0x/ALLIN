export const gameConfig = {
  common: {
    startGameTimeOut: 3000,
  },
  games: {
    holdEm: {
      startingTables: 5,
      startMoney: 1000,
      bot: {
        botCounts: [1, 2, 0, 0, 0],
        turnTimes: [1000, 1500, 2000, 2500, 3000],
        betAmounts: [
          [10, 12, 15, 20],
          [100, 120, 150, 200],
          [1000, 1200, 1500, 2000],
          [10000, 12000, 15000, 20000],
          [100000, 120000, 150000, 200000]
        ]
      },
      games: [
        {
          name: '青铜常规场',
          typeName: 'Bronze',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 10,
          afterRoundCountdown: 8
        },
        {
          name: '白银常规场',
          typeName: 'Silver',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 100,
          afterRoundCountdown: 8
        },
        {
          name: '黄金常规场',
          typeName: 'Gold',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 1000,
          afterRoundCountdown: 8
        },
        {
          name: '钻石常规场',
          typeName: 'Diamond',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 10000,
          afterRoundCountdown: 8
        },
        {
          name: '大师常规场',
          typeName: 'Master',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 100000,
          afterRoundCountdown: 8
        }
      ],
    },
    fiveCardDraw: {
      startingTables: 0,
      startMoney: 1000,
      bot: {
        botCounts: [1, 2, 1, 0],
        turnTimes: [1000, 1500, 2000, 2500, 3000],
        betAmounts: [
          [15, 25, 30, 40], // Low bet game
          [20, 30, 50, 50], // Medium bet game
          [35, 50, 80, 100] // High bet game
        ]
      },
      games: [
        {
          name: 'Five Card Draw with low bets',
          typeName: 'Low bets',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 10,
          afterRoundCountdown: 8,
          discardAndDrawTimeout: 20,
        },
        {
          name: 'Five Card Draw with medium bets',
          typeName: 'Medium bets',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 20,
          afterRoundCountdown: 8,
          discardAndDrawTimeout: 20,
        },
        {
          name: 'Five Card Draw with high bets',
          typeName: 'High bets',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 50,
          afterRoundCountdown: 8,
          discardAndDrawTimeout: 20,
        },
      ],
    },
    bottleSpin: {
      startingTables: 0,
      startMoney: 1000,
      bot: {
        botCounts: [3, 1],
        turnTimes: [1000, 1500, 2000, 2500, 3000],
        betAmounts: [
          [25, 35, 100, 500],         // Low bet game
          [125, 150, 200, 250],       // Medium bet game
          [1100, 1200, 1500, 2000]    // High bet game
        ]
      },
      games: [
        {
          name: 'Bottle Spin with low bets',
          typeName: 'Low bets',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 10,
          afterRoundCountdown: 5,
        }, {
          name: 'Bottle Spin with medium bets',
          typeName: 'Medium bets',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 20,
          afterRoundCountdown: 5,
          discardAndDrawTimeout: 20,
        },
        {
          name: 'Bottle Spin with high bets',
          typeName: 'High bets',
          max_seats: 6,
          minPlayers: 2,
          turnCountdown: 20,
          minBet: 50,
          afterRoundCountdown: 5,
          discardAndDrawTimeout: 20,
        },
      ],
    },
    blackJack: {
      startingTables: 0,
      startMoney: 1000,
      bot: {
        botCounts: [1, 1],
      },
    },
    dices: {
      startingTables: 0,
      startMoney: 1000,
      bot: {
        botCounts: [1, 1],
      },
    }
  }
};
