import logger from '../../logger';
import {HoldemStage} from '../../enums';
import {getRandomInt} from '../../utils';
import {BotInterface} from '../../interfaces';
import {BOT_CALL, BOT_CHECK, BOT_FOLD, BOT_RAISE, BOT_REMOVE} from '../../constants';

export class HoldemBot implements BotInterface {

  name: string;
  playerMoney: number;
  myHand: string[];
  isCallSituation: boolean;
  tableMinBet: number;
  checkAmount: number;
  handValue: number;
  currentStage: HoldemStage;
  myTotalBet: number;
  tablePot: number;
  resultsSet: { action: string; amount: number };

  /*
    Changelog:
        05.08.2018 - Added isBot bit to separate bots from autoPlay actions (to tweak parameters)
        05.08.2018 - Added logic to never fold if have nothing to call against (no money to lose on checks)
        06.08.2018 - Added logic for # 1 First stage, fixed getCalculatedRaiseAmount function over playerMoney problem
        08.08.2018 - Many modifications because bots suddenly folded all time caused by myTotalBet change on collectPotAction
        05.11.2018 - Removed this.isBot logic check. Making autoPlay action for own file for future tricks
  */
  constructor(
    botName: string,
    playerMoney: number,
    myHand: string[],
    isCallSituation: boolean,
    tableMinBet: number,
    checkAmount: number,
    handValue: number,
    currentStage: HoldemStage,
    myTotalBet: number,
    tablePot: number
  ) {
    this.name = botName;
    this.playerMoney = playerMoney;
    this.myHand = myHand;
    this.isCallSituation = isCallSituation;
    this.tableMinBet = tableMinBet;
    this.checkAmount = checkAmount;
    this.handValue = handValue;
    this.currentStage = currentStage;
    this.myTotalBet = myTotalBet;
    this.tablePot = tablePot;
    this.resultsSet = {action: "", amount: 0};
  }

  performAction(): { action: string; amount: number } {
    if (this.playerMoney <= this.tableMinBet + 100) {
      this.resultsSet.action = BOT_REMOVE;
    } else if (this.isCallSituation && this.checkAmount > this.playerMoney) {
      this.resultsSet.action = this.shouldCallAllIn() ? BOT_CALL : BOT_FOLD;
    } else {
      if (this.shouldJamShortStack()) {
        this.resultsSet.action = BOT_RAISE;
        this.resultsSet.amount = this.playerMoney;
      } else {
      this.handleGameStages();
      }
    }

    logger.info(
      `${this.name} | ${this.resultsSet.action} ${
        this.resultsSet.amount > 0 ? this.resultsSet.amount : ""
      } | hand value: ${this.handValue ?? ""} | cA: ${this.checkAmount}`
    );

    return this.resultsSet;
  }

  private shouldCallAllIn(): boolean {
    const callPressure = this.getCallPressure();
    const potOdds = this.getPotOdds();

    switch (this.currentStage) {
      case HoldemStage.TWO_PRE_FLOP:
        return this.shouldCallPreflopAllIn(callPressure, potOdds);
      case HoldemStage.FOUR_POST_FLOP:
        return this.handValue >= 10200
          || (this.handValue >= 8400 && callPressure <= 0.42 && potOdds <= 0.34)
          || (this.handValue >= 7600 && callPressure <= 0.26 && potOdds <= 0.22);
      case HoldemStage.SIX_THE_POST_TURN:
        return this.handValue >= 11800
          || (this.handValue >= 9300 && callPressure <= 0.34 && potOdds <= 0.28)
          || (this.handValue >= 8600 && callPressure <= 0.22 && potOdds <= 0.18);
      case HoldemStage.EIGHT_THE_SHOW_DOWN:
        return this.handValue >= 12400
          || (this.handValue >= 9800 && callPressure <= 0.26 && potOdds <= 0.2)
          || (this.handValue >= 9000 && callPressure <= 0.14 && potOdds <= 0.14);
      default:
        return false;
    }
  }

  private shouldJamShortStack(): boolean {
    if (this.isCallSituation) {
      return false;
    }

    const stackInBigBlinds = this.getStackInBigBlinds();
    if (stackInBigBlinds > 12) {
      return false;
    }

    switch (this.currentStage) {
      case HoldemStage.TWO_PRE_FLOP: {
        const ranks = this.getSortedHoleRanks();
        const highRank = ranks[0];
        const lowRank = ranks[1];
        const pocketPair = highRank === lowRank;
        const suited = this.myHand[0]?.[1] === this.myHand[1]?.[1];
        return pocketPair && highRank >= 7
          || (highRank >= 13 && lowRank >= 10)
          || (highRank === 14 && lowRank >= 9 && suited);
      }
      case HoldemStage.FOUR_POST_FLOP:
        return this.handValue >= 9800;
      case HoldemStage.SIX_THE_POST_TURN:
        return this.handValue >= 10800;
      case HoldemStage.EIGHT_THE_SHOW_DOWN:
        return this.handValue >= 11200;
      default:
        return false;
    }
  }

  private shouldCallPreflopAllIn(callPressure: number, potOdds: number): boolean {
    const ranks = this.getSortedHoleRanks();
    const highRank = ranks[0];
    const lowRank = ranks[1];
    const pocketPair = highRank === lowRank;
    const suited = this.myHand[0]?.[1] === this.myHand[1]?.[1];

    if (pocketPair && highRank >= 10) {
      return true;
    }

    if (pocketPair && highRank >= 8 && callPressure <= 0.65) {
      return true;
    }

    if (highRank >= 13 && lowRank >= 11 && callPressure <= 0.6) {
      return true;
    }

    if (highRank === 14 && lowRank >= 10 && suited && callPressure <= 0.55) {
      return true;
    }

    if (highRank >= 12 && lowRank >= 10 && suited && callPressure <= 0.4 && potOdds <= 0.32) {
      return true;
    }

    return false;
  }

  private getSortedHoleRanks(): number[] {
    const rankMap: {[key: string]: number} = {
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      T: 10,
      J: 11,
      Q: 12,
      K: 13,
      A: 14,
    };

    return this.myHand
      .map((card) => rankMap[card?.[0]] || 0)
      .sort((left, right) => right - left);
  }

  private handleGameStages(): void {
    switch (this.currentStage) {
      case HoldemStage.TWO_PRE_FLOP:
        this.handleFirstStage();
        break;
      case HoldemStage.FOUR_POST_FLOP:
        this.handleSecondStage();
        break;
      case HoldemStage.SIX_THE_POST_TURN:
        this.handleThirdStage();
        break;
      case HoldemStage.EIGHT_THE_SHOW_DOWN:
        this.handleFourthStage();
        break;
    }
  }

  private handleFirstStage(): void {
    const ranks = this.getSortedHoleRanks();
    const highRank = ranks[0];
    const lowRank = ranks[1];
    const hasSameCards = this.myHand[0][0] === this.myHand[1][0];
    const suited = this.myHand[0]?.[1] === this.myHand[1]?.[1];
    const connected = Math.abs(highRank - lowRank) <= 1;
    const premiumBroadway = highRank >= 13 && lowRank >= 10;

    if (!this.isCallSituation && (hasSameCards && highRank >= 8 || premiumBroadway)) {
      this.resultsSet.action = BOT_RAISE;
      this.resultsSet.amount = this.getCalculatedRaiseAmount();
    } else if (this.isCallSituation && this.hasBadHoleCardsHand() && this.getCallPressure() > 0.18) {
      this.resultsSet.action = BOT_FOLD;
    } else if (
      this.isCallSituation &&
      !hasSameCards &&
      !premiumBroadway &&
      !(suited && connected && highRank >= 10) &&
      this.getCallPressure() > 0.28
    ) {
      this.resultsSet.action = BOT_FOLD;
    } else {
      this.HOLDEM_BOT_CHECK_CALL();
    }
  }

  private handleSecondStage(): void {
    if (this.handValue < 4300 && this.isCallSituation) {
      this.resultsSet.action = BOT_FOLD;
    } else {
      if (this.handValue > 11200 && !this.isCallSituation) {
        this.resultsSet.action = BOT_RAISE;
        this.resultsSet.amount = this.getCalculatedRaiseAmount();
      } else {
        if (
          this.handValue < 7000 && this.isCallSituation
          || (this.handValue < 8200 && this.isCallSituation && this.getCallPressure() > 0.32)
        ) {
          this.resultsSet.action = BOT_FOLD;
        } else {
          this.HOLDEM_BOT_CHECK_CALL();
        }
      }
    }
  }

  private handleThirdStage(): void {
    if (this.handValue < 4500 && this.isCallSituation) {
      this.resultsSet.action = BOT_FOLD;
    } else {
      if (this.handValue > 13800 && !this.isCallSituation) {
        this.resultsSet.action = BOT_RAISE;
        this.resultsSet.amount = this.getCalculatedRaiseAmount();
      } else {
        if (
          this.handValue < 9000 && this.isCallSituation
          || (this.handValue < 9800 && this.isCallSituation && this.getCallPressure() > 0.24)
        ) {
          this.resultsSet.action = BOT_FOLD;
        } else {
          this.HOLDEM_BOT_CHECK_CALL();
        }
      }
    }
  }

  private handleFourthStage(): void {
    if (this.handValue > 18200 && !this.isCallSituation) {
      this.resultsSet.action = BOT_RAISE;
      this.resultsSet.amount = this.getCalculatedRaiseAmount();
    } else {
      if (
        this.handValue < 9000 && this.isCallSituation
        || (this.handValue < 10200 && this.isCallSituation && this.getCallPressure() > 0.16)
      ) {
        this.resultsSet.action = BOT_FOLD;
      } else {
        this.HOLDEM_BOT_CHECK_CALL();
      }
    }
  }

  private getCalculatedRaiseAmount(): number {
    let value1 = this.myTotalBet + this.checkAmount;
    let value2 = value1 / 3;
    let v = Math.ceil((value1 + value2 + 1) / 10) * 10;
    v += [10, 25, 50, 75, 100][getRandomInt(0, 4)];
    return Math.min(v, this.playerMoney);
  }

  private HOLDEM_BOT_CHECK_CALL(): void {
    this.resultsSet.action = this.isCallSituation ? BOT_CALL : BOT_CHECK;
  }

  private getCallPressure(): number {
    return this.checkAmount / Math.max(this.playerMoney, 1);
  }

  private getPotOdds(): number {
    return this.checkAmount / Math.max(this.tablePot + this.checkAmount, 1);
  }

  private getStackInBigBlinds(): number {
    return this.playerMoney / Math.max(this.tableMinBet, 1);
  }

  private hasBadHoleCardsHand(): boolean {
    const badHands = [
      "Q7", "Q6", "Q5", "Q4", "Q3", "Q2", "J6", "J5", "J4", "J3", "J2",
      "95", "94", "93", "92", "85", "84", "83", "82", "74", "73", "72",
      "64", "63", "62", "53", "52", "43", "42", "32"
    ];
    const hand = this.myHand[0][0] + this.myHand[1][0];
    return badHands.some((badHand) => hand.includes(badHand[0]) && hand.includes(badHand[1]));
  }

}
