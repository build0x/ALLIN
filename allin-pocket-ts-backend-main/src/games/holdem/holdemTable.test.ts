import EventEmitter from 'events';
import {HoldemTable} from './holdemTable';
import {Player} from '../../player';

const createTable = (): any => new HoldemTable(new EventEmitter(), 0, 1);

const createPlayer = (playerId: number, playerName: string, playerMoney: number) => {
  return new Player(null as any, playerId, playerMoney, true, playerName);
};

describe('HoldemTable rules', () => {
  it('识别 9 高顺并胜过更小顺子', () => {
    const table = createTable();
    const alice = createPlayer(1, 'Alice', 0);
    const bob = createPlayer(2, 'Bob', 0);

    table.players = [alice, bob];
    table.middleCards = ['5♣', '6♦', '7♥', '8♠', 'A♣'];
    alice.playerCards = ['9♣', 'K♦'];
    bob.playerCards = ['4♣', 'Q♦'];
    alice.handContribution = 100;
    bob.handContribution = 100;

    table.evaluateActiveHands();
    const resolved = table.resolvePotBreakdown(table.buildPotBreakdown());

    expect(alice.handName?.toLowerCase()).toContain('straight');
    expect(resolved.winnerPlayerIds).toEqual([1]);
  });

  it('把 A2345 当作顺子，但不会把 KA234 当作顺子', () => {
    const table = createTable();
    const wheel = createPlayer(1, 'Wheel', 0);
    const wrap = createPlayer(2, 'Wrap', 0);

    table.players = [wheel, wrap];
    table.middleCards = ['2♣', '3♦', '4♥', 'K♣', 'Q♦'];
    wheel.playerCards = ['A♦', '5♠'];
    wrap.playerCards = ['A♠', '9♠'];
    wheel.handContribution = 100;
    wrap.handContribution = 100;

    table.evaluateActiveHands();
    const resolved = table.resolvePotBreakdown(table.buildPotBreakdown());

    expect(wheel.handName?.toLowerCase()).toContain('straight');
    expect(wrap.handName?.toLowerCase()).not.toContain('straight');
    expect(resolved.winnerPlayerIds).toEqual([1]);
  });

  it('短码跟注不足时会自动 all-in，不会被当作弃牌', () => {
    const table = createTable();
    const shorty = createPlayer(1, 'Shorty', 2000);
    const deep = createPlayer(2, 'Deep', 10000);

    table.players = [shorty, deep];
    table.currentHighestBet = 10000;
    table.isCallSituation = true;
    table.smallBlindGiven = true;
    table.bigBlindGiven = true;

    table.playerCheck(shorty.playerId);

    expect(shorty.totalBet).toBe(2000);
    expect(shorty.handContribution).toBe(2000);
    expect(shorty.playerMoney).toBe(0);
    expect(shorty.isAllIn).toBe(true);
    expect(shorty.isFold).toBe(false);
  });

  it('按投入金额拆出主池和边池', () => {
    const table = createTable();
    const alice = createPlayer(1, 'Alice', 0);
    const bob = createPlayer(2, 'Bob', 0);
    const carol = createPlayer(3, 'Carol', 0);

    table.players = [alice, bob, carol];
    alice.handContribution = 10000;
    bob.handContribution = 2000;
    carol.handContribution = 10000;

    const pots = table.buildPotBreakdown();

    expect(pots).toHaveLength(2);
    expect(pots[0]).toMatchObject({
      type: 'main',
      label: '主池',
      amount: 6000,
      eligiblePlayerIds: [1, 2, 3],
    });
    expect(pots[1]).toMatchObject({
      type: 'side',
      label: '边池1',
      amount: 16000,
      eligiblePlayerIds: [1, 3],
    });
  });

  it('主池和边池会分别结算，不再直接平分总奖池', () => {
    const table = createTable();
    const alice = createPlayer(1, 'Alice', 0);
    const bob = createPlayer(2, 'Bob', 0);
    const carol = createPlayer(3, 'Carol', 0);

    table.players = [alice, bob, carol];
    table.middleCards = ['2♣', '2♦', '9♠', 'K♥', 'A♥'];
    alice.playerCards = ['A♠', 'K♠'];
    bob.playerCards = ['9♣', '9♦'];
    carol.playerCards = ['Q♠', 'J♠'];
    alice.handContribution = 10000;
    bob.handContribution = 2000;
    carol.handContribution = 10000;

    table.evaluateActiveHands();
    const resolved = table.resolvePotBreakdown(table.buildPotBreakdown());
    const payoutMap = new Map<number, number>(resolved.payouts.map((payout: any) => [payout.playerId, payout.amount]));

    expect(payoutMap.get(2)).toBe(6000);
    expect(payoutMap.get(1)).toBe(16000);
    expect(payoutMap.get(3) || 0).toBe(0);
  });

  it('普通玩家不能用小于最小加注额的金额重新加注', () => {
    const table = createTable();
    const raiser = createPlayer(1, 'Raiser', 1000);
    const caller = createPlayer(2, 'Caller', 1000);

    table.players = [raiser, caller];
    table.currentHighestBet = 200;
    table.minimumRaiseAmount = 100;
    table.isCallSituation = true;
    table.smallBlindGiven = true;
    table.bigBlindGiven = true;
    raiser.totalBet = 100;
    raiser.handContribution = 100;

    table.playerRaise(raiser.playerId, 50);

    expect(raiser.totalBet).toBe(200);
    expect(table.currentHighestBet).toBe(200);
    expect(table.minimumRaiseAmount).toBe(100);
  });

  it('中途只剩一名玩家时也会发送结算状态', () => {
    jest.useFakeTimers();

    const table = createTable();
    const winner = createPlayer(1, 'Winner', 0);
    const folded = createPlayer(2, 'Folded', 0);

    table.players = [winner, folded];
    winner.isFold = false;
    folded.isFold = true;
    winner.handContribution = 100;
    folded.handContribution = 100;
    table.totalPot = 200;

    table.collectChipsToPotAndSendAction = jest.fn();
    table.sendStatusUpdate = jest.fn();
    table.updateLoggedInPlayerDatabaseStatistics = jest.fn();
    table.triggerNewGame = jest.fn();

    table.roundResultsMiddleOfTheGame();

    expect(table.isResultsCall).toBe(true);
    expect(table.roundWinnerPayouts).toEqual(
      expect.arrayContaining([expect.objectContaining({playerId: 1, amount: 200})])
    );
    expect(table.sendStatusUpdate).toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
});
