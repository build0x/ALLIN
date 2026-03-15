import { playCardTakeOutFromPackageOne, playCardSlideSix } from '@/components/Audio';
import { formatMoney } from '@/utils/Money';

export const NewBoard = (getEnableSounds) => {
  let totalPot = 240;
  let potBreakdown = [];
  let minBet = 100;

  let showMiddleCards = true;
  const middleCards = [];
  const middleCardsSlideUp = [];
  for (let m = 0; m < 5; m++) {
    middleCards.push(null);
    middleCardsSlideUp.push(null);
  }

  const resetMiddleCards = () => {
    for (let m = 0; m < middleCards.length; m++) {
      middleCards[m] = null;
      middleCardsSlideUp[m] = false;
    }
  };

  const setMiddleCard = (number, cardStr, isMiddleOfTheGame) => {
    const enableSounds = getEnableSounds();
    if (enableSounds && !isMiddleOfTheGame) {
      playCardSlideSix.play();
    }

    middleCards[number] = cardStr;
  };

  const startWinnerCardGlowAnimation = (cardNumber) => {
    if (cardNumber < 0 || cardNumber > 4) return;

    middleCardsSlideUp[cardNumber] = true;
  };

  const setTotalPot = (money) => {
    totalPot = money;
  };

  const getTotalPot = () => {
    return totalPot;
  };

  const setPotBreakdown = (pots) => {
    potBreakdown = Array.isArray(pots) ? pots : [];
  };

  const getPotBreakdown = () => {
    return potBreakdown;
  };

  const middleCardsPuffIn = [false, false, false, false, false];

  const isShowMiddleCards = () => {
    return showMiddleCards;
  };

  const setShowMiddleCards = (bool) => {
    showMiddleCards = bool;
  };

  return {
    middleCards,
    middleCardsSlideUp,
    middleCardsPuffIn,
    setTotalPot,
    getTotalPot,
    setPotBreakdown,
    getPotBreakdown,
    resetMiddleCards,
    setMiddleCard,
    startWinnerCardGlowAnimation,
    isShowMiddleCards,
    setShowMiddleCards,
  };
};

export const initBoard = (board) => {
  board.setTotalPot(0);
  board.setPotBreakdown([]);
  board.resetMiddleCards();
  board.setShowMiddleCards(true);
};

export const NewRoomInfo = () => {
  let tableName = '♦ Default table';
  let spectatorsCount = '♦ 观战人数: 0';
  let waitingPlayersCount = '♦ 等待中: 0';
  let deckStatus = '♦ 剩余牌: -';
  let deckCardsBurned = '♦ 已烧牌: -';
  let minBet = '♦ 最低下注: -';
  let tournamentBlind = '';
  let tournamentNextBlind = '';
  let roomStatusText = '等待参数中...';
  let roomTurnText = '暂无行动';

  const translateRoomStatusText = (statusStr) => {
    if (!statusStr) {
      return '等待参数中...';
    }

    const normalizedStatus = statusStr.trim().toLowerCase().replace(/\s+/g, ' ');
    const compactStatus = normalizedStatus.replace(/[^a-z]/g, '');
    const statusMap = {
      'waiting players...': '等待玩家中...',
      'pre flop': '翻牌前',
      'pre flop & small blind & big blind': '翻牌前（小盲/大盲）',
      'the flop': '翻牌圈',
      'the turn': '转牌圈',
      'the river': '河牌圈',
      'the show down': '摊牌比牌',
      flop: '翻牌圈',
      turn: '转牌圈',
      river: '河牌圈',
      showdown: '摊牌比牌',
      'post turn': '本轮结算',
      'dealing cards...': '正在发牌...',
      'new round starting...': '新一局开始中...',
    };

    if (statusMap[normalizedStatus]) {
      return statusMap[normalizedStatus];
    }

    const compactStatusMap = {
      preflop: '翻牌前',
      flop: '翻牌圈',
      turn: '转牌圈',
      river: '河牌圈',
      theflop: '翻牌圈',
      theturn: '转牌圈',
      theriver: '河牌圈',
      showdown: '摊牌比牌',
      theshowdown: '摊牌比牌',
      postturn: '本轮结算',
    };

    if (compactStatusMap[compactStatus]) {
      return compactStatusMap[compactStatus];
    }

    const playersNeededMatch = statusStr.match(/^(\d+)\s+players needed to start a new game\.{3}$/);
    if (playersNeededMatch) {
      return `需要${playersNeededMatch[1]}名玩家才能开始游戏`;
    }

    return statusStr;
  };

  const translateRoomTurnText = (turnStr) => {
    if (!turnStr || turnStr === 'No Turn...') {
      return '暂无行动';
    }

    if (turnStr.endsWith(' Turn')) {
      return `${turnStr.slice(0, -5)} 当前行动`;
    }

    return turnStr;
  };

  const setRoomStatusText = (statusStr) => {
    roomStatusText = translateRoomStatusText(statusStr);
  };

  const getRoomStatusText = () => {
    return roomStatusText;
  };

  const setRoomTurnText = (turnStr) => {
    roomTurnText = translateRoomTurnText(turnStr);
  };

  const getRoomTurnText = () => {
    return roomTurnText;
  };

  const setTableName = (val) => {
    tableName = '♦ ' + val;
  };

  const getTableName = () => {
    return tableName;
  };

  const setRoomSpectatorCount = (val) => {
    spectatorsCount = '♦ 观战人数: ' + val;
  };

  const getRoomSpectatorCount = () => {
    return spectatorsCount;
  };

  const setRoomWaitingPlayersCount = (val) => {
    waitingPlayersCount = '♦ 等待中: ' + val;
  };

  const getRoomWaitingPlayersCount = () => {
    return waitingPlayersCount;
  };

  const setRoomDeckStatus = (val) => {
    deckStatus = '♦ 剩余牌: ' + val;
  };

  const getRoomDeckStatus = () => {
    return deckStatus;
  };

  const setRoomDeckBurnedCount = (val) => {
    deckCardsBurned = '♦ 已烧牌: ' + val;
  };

  const getRoomDeckBurnedCount = () => {
    return deckCardsBurned;
  };

  const setMinBet = (money) => {
    minBet = money;
  };

  const getMinBet = () => {
    return `♦ 最低下注: ${formatMoney(minBet)}`;
  };

  const getMinBetValue = () => {
    return Number(minBet || 0);
  };

  const setTournamentBlind = (value) => {
    tournamentBlind = value || '';
  };

  const getTournamentBlind = () => {
    return tournamentBlind;
  };

  const setTournamentNextBlind = (value) => {
    tournamentNextBlind = value || '';
  };

  const getTournamentNextBlind = () => {
    return tournamentNextBlind;
  };

  return {
    getRoomStatusText,
    getRoomTurnText,
    getTableName,
    getRoomSpectatorCount,
    getRoomWaitingPlayersCount,
    getRoomDeckStatus,
    getRoomDeckBurnedCount,
    getMinBet,
    getMinBetValue,
    getTournamentBlind,
    getTournamentNextBlind,
    setRoomStatusText,
    setRoomTurnText,
    setTableName,
    setRoomSpectatorCount,
    setRoomWaitingPlayersCount,
    setRoomDeckStatus,
    setRoomDeckBurnedCount,
    setMinBet,
    setTournamentBlind,
    setTournamentNextBlind,
  };
};

export const NewCtrl = (getEnableSounds) => {
  let isFoldBtn = true;
  let isCheckBtn = true;
  let isRaiseBtn = true;
  let isCallSituation = true;

  const toggleCheckAndCall = (val) => {
    isCallSituation = val;
  };

  const actionBtnVisibility = (visible, isInit) => {
    const enableSounds = getEnableSounds();
    if (visible) {
      if (!isFoldBtn && !isInit) {
        if (enableSounds) {
          playCardTakeOutFromPackageOne.play();
        }
      }
      isFoldBtn = true;
      isCheckBtn = true;
      isRaiseBtn = true;
    } else {
      if (isFoldBtn && !isInit) {
        if (enableSounds) {
          playCardTakeOutFromPackageOne.play();
        }
      }
      isFoldBtn = false;
      isCheckBtn = false;
      isRaiseBtn = false;
    }
  };

  return {
    isCallSituation,
    isFoldBtn,
    isCheckBtn,
    isRaiseBtn,
    toggleCheckAndCall,
    actionBtnVisibility,
  };
};

export const initCtrl = (ctrl) => {
  ctrl.actionBtnVisibility(false, true);
};

const NewRoom = (roomInfo, board, ctrl) => {
  return {
    roomInfo,
    board,
    ctrl,
  };
};

// ----------------------------------------------------
export const roomUpdate = (sData, room) => {
  const roomInfo = room.roomInfo;
  roomInfo.setRoomStatusText(sData.currentStatus);
  roomInfo.setRoomTurnText(sData.currentTurnText);
  roomInfo.setTableName(sData.tableName);
  roomInfo.setRoomSpectatorCount(sData.spectatorsCount);
  roomInfo.setRoomWaitingPlayersCount(sData.appendPlayersCount);
  roomInfo.setRoomDeckStatus(sData.deckStatus);
  roomInfo.setRoomDeckBurnedCount(sData.deckCardsBurned);
  roomInfo.setMinBet(sData.tableMinBet);
  if (sData.tournamentInfo) {
    const smallBlind = Number(sData.tournamentInfo.currentSmallBlind || 0);
    const bigBlind = Number(sData.tournamentInfo.currentBigBlind || sData.tableMinBet || 0);
    roomInfo.setTournamentBlind(
      `L${Number(sData.tournamentInfo.blindLevel || 0)} · ${formatMoney(smallBlind)}/${formatMoney(bigBlind)}`
    );
    roomInfo.setTournamentNextBlind(
      sData.tournamentInfo.nextBlindAt
        ? `下次升盲 ${new Date(sData.tournamentInfo.nextBlindAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}`
        : '已到最高盲注'
    );
  } else {
    roomInfo.setTournamentBlind('');
    roomInfo.setTournamentNextBlind('');
  }

  const board = room.board;
  board.setTotalPot(sData.totalPot);
  board.setPotBreakdown(sData.potBreakdown || []);

  const ctrl = room.ctrl;
  ctrl.toggleCheckAndCall(sData.isCallSituation);
};

export default NewRoom;
