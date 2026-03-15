import {HoldemBot} from './holdemBot';
import {HoldemStage} from '../../enums';
import {BOT_CALL, BOT_FOLD, BOT_RAISE} from '../../constants';

type BotInput = {
  botName?: string;
  playerMoney?: number;
  myHand?: string[];
  isCallSituation?: boolean;
  tableMinBet?: number;
  checkAmount?: number;
  handValue?: number;
  currentStage?: HoldemStage;
  myTotalBet?: number;
  tablePot?: number;
};

const createBot = (overrides: BotInput = {}) => {
  return new HoldemBot(
    overrides.botName || 'test-bot',
    overrides.playerMoney ?? 1000,
    overrides.myHand || ['A♠', 'A♥'],
    overrides.isCallSituation ?? true,
    overrides.tableMinBet ?? 100,
    overrides.checkAmount ?? 1500,
    overrides.handValue ?? 12000,
    overrides.currentStage ?? HoldemStage.TWO_PRE_FLOP,
    overrides.myTotalBet ?? 100,
    overrides.tablePot ?? 3000
  );
};

describe('HoldemBot decision logic', () => {
  it('会用强口袋对子跟注 preflop all-in', () => {
    const bot = createBot();

    const result = bot.performAction();

    expect(result.action).toBe(BOT_CALL);
  });

  it('会用弱垃圾牌弃掉 preflop all-in', () => {
    const bot = createBot({
      myHand: ['7♣', '2♦'],
      handValue: 3000,
      myTotalBet: 0,
      tablePot: 4000,
    });

    const result = bot.performAction();

    expect(result.action).toBe(BOT_FOLD);
  });

  it('短码且牌力足够时会主动 shove', () => {
    const bot = createBot({
      playerMoney: 650,
      myHand: ['K♠', 'K♥'],
      isCallSituation: false,
      checkAmount: 0,
      currentStage: HoldemStage.TWO_PRE_FLOP,
      myTotalBet: 0,
      tablePot: 500,
    });

    const result = bot.performAction();

    expect(result.action).toBe(BOT_RAISE);
    expect(result.amount).toBe(650);
  });

  it('turn 强成牌面对 all-in 会跟注', () => {
    const bot = createBot({
      myHand: ['A♠', 'K♠'],
      playerMoney: 1400,
      handValue: 12000,
      currentStage: HoldemStage.SIX_THE_POST_TURN,
      myTotalBet: 300,
      tablePot: 4200,
    });

    const result = bot.performAction();

    expect(result.action).toBe(BOT_CALL);
  });
});
