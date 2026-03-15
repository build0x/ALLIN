import React, { useEffect, useContext, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import socketContext from '@/context/websocket/socketContext';
import tableContext from '@/context/table/tableContext';
import { playCardPlaceChipsOne } from '@/components/Audio';
import contentContext from '@/context/content/contentContext';
import { formatMoney } from '@/utils/Money';

const ControlCard = styled.div`
  background: linear-gradient(160deg, rgba(37, 37, 37, 0.96) 0%, rgba(24, 24, 24, 0.96) 100%);
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 16px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
  width: 100%;
  padding: 12px;

  @media (min-width: 768px) {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
`;

const SectionLabel = styled.div`
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(212, 175, 55, 0.88);
  margin-bottom: 8px;

  @media (min-width: 768px) {
    text-align: center;
    width: 100%;
  }
`;

const QuickBetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  @media (min-width: 768px) {
    justify-content: center;
    width: 100%;
  }

  @media (max-width: 768px) {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;

  @media (min-width: 768px) {
    justify-content: center;
    width: 100%;
  }

  @media (max-width: 768px) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }
`;

const ActionButton = styled.button`
  min-width: 88px;
  border-radius: 10px;
  border: 0;
  color: ${(props) => (props.$active ? '#fff' : 'rgba(255,255,255,0.72)')};
  background: ${(props) =>
    props.$active
      ? 'linear-gradient(135deg, #ff5f6d 0%, #dc3545 100%)'
      : 'linear-gradient(160deg, rgba(48,48,48,0.95) 0%, rgba(28,28,28,0.95) 100%)'};
  box-shadow: ${(props) => (props.$active ? '0 8px 24px rgba(220, 53, 69, 0.24)' : 'none')};
  opacity: ${(props) => (props.disabled ? 0.9 : 1)};

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const BetButton = styled.button`
  min-width: 70px;
  border-radius: 10px;

  @media (max-width: 768px) {
    min-width: 0;
    width: 100%;
    padding-left: 0;
    padding-right: 0;
  }
`;

/* 桌面端：不再使用，与移动端统一用底部栏 */
const DesktopControls = styled.div`
  display: none;
`;

/* 桌面+移动端统一：一行 [弃牌][跟注][加注▼] + 展开金额 */
const MobileControls = styled.div`
  display: block;
  padding: 8px 10px 10px;

  @media (min-width: 768px) {
    padding: 12px 16px 16px;
    max-width: 440px;
    margin: 0 auto;
  }
`;

const MobileBarRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;

  @media (min-width: 768px) {
    gap: 10px;
  }
`;

const MobileBtn = styled.button`
  flex: 1;
  min-width: 0;
  border-radius: 10px;
  border: 0;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 6px;
  color: ${(props) => (props.$active ? '#fff' : 'rgba(255,255,255,0.85)')};
  background: ${(props) =>
    props.$active
      ? 'linear-gradient(135deg, #ff5f6d 0%, #dc3545 100%)'
      : 'linear-gradient(160deg, rgba(48,48,48,0.95) 0%, rgba(28,28,28,0.95) 100%)'};
  box-shadow: ${(props) => (props.$active ? '0 4px 12px rgba(220, 53, 69, 0.25)' : 'none')};
  opacity: ${(props) => (props.disabled ? 0.6 : 1)};
  white-space: nowrap;

  &.btn-call {
    background: ${(props) =>
      props.$active
        ? 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)'
        : 'linear-gradient(160deg, rgba(48,48,48,0.95) 0%, rgba(28,28,28,0.95) 100%)'};
  }
  &.btn-raise {
    background: ${(props) =>
      props.$active
        ? 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)'
        : 'linear-gradient(160deg, rgba(48,48,48,0.95) 0%, rgba(28,28,28,0.95) 100%)'};
  }
`;

const MobileRaisePanel = styled.div`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;

  @media (min-width: 768px) {
    margin-top: 10px;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
`;

const MobileQuickBetBtn = styled.button`
  min-width: 0;
  border-radius: 8px;
  border: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 4px;
  color: #fff;
  background: linear-gradient(160deg, rgba(180, 60, 60, 0.95) 0%, rgba(140, 40, 40, 0.95) 100%);
  white-space: nowrap;

  @media (min-width: 768px) {
    font-size: 12px;
    padding: 8px 6px;
  }
`;

const MobileCustomRow = styled.div`
  margin-top: 8px;
  display: flex;
  gap: 6px;
  align-items: center;

  @media (min-width: 768px) {
    margin-top: 10px;
    gap: 8px;
  }
`;

const MobileCustomInput = styled.input`
  flex: 1;
  min-width: 0;
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.3);
  background: rgba(40, 40, 40, 0.95);
  color: #fff;
  font-size: 13px;
  padding: 8px 10px;

  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
`;

const MobileConfirmBtn = styled.button`
  flex-shrink: 0;
  border-radius: 8px;
  border: 0;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  color: #fff;
  background: linear-gradient(135deg, #d4af37 0%, #b8962e 100%);
  white-space: nowrap;
`;

const StyledBetBtn = ({ onClick, label }) => {
  return (
    <BetButton onClick={onClick} type="button" className="btn btn-danger">
      {label}
    </BetButton>
  );
};

const StyledActBtn = ({ className, onClick, label, active, disabled }) => {
  return (
    <ActionButton
      onClick={onClick}
      type="button"
      className={`btn ${className || ''}`}
      $active={active}
      disabled={disabled}
    >
      {label}
    </ActionButton>
  );
};

const TurnControl = () => {
  const { t } = useContext(contentContext);
  const { socket, playerId } = useContext(socketContext);
  const { tableId, ctrl, players, heroTurn, autoCheck, autoPlay, refreshSeats, roomInfo } =
    useContext(tableContext);

  const [enableSounds] = useState(true);
  const [raiseExpanded, setRaiseExpanded] = useState(false);
  const [customRaiseInput, setCustomRaiseInput] = useState('');

  useEffect(() => {
    if (socket) {
      socket.handle('autoPlayActionResult', (jsonData) => autoPlayActionResult(jsonData.data));
    }
  }, [autoPlayActionResult, socket, tableId]);

  useEffect(() => {
    const hero = heroTurn.data;
    if (autoCheck && hero && hero.isPlayerTurn) {
      checkBtnClick(hero);
    }
  }, [autoCheck, checkBtnClick, heroTurn]);

  // const autoPlayCommandRequested = useRef(null);

  useEffect(() => {
    const hero = heroTurn.data;
    if (autoPlay && hero && hero.isPlayerTurn) {
      getAutoPlayAction();
    }
  }, [autoPlay, getAutoPlayAction, heroTurn]);

  // If autoplay enabled, request action via this function
  function getAutoPlayAction() {
    if (socket) {
      // autoPlayCommandRequested.current = true;
      const data = JSON.stringify({
        key: 'autoPlayAction',
      });
      socket.send(data);
    }
  }

  // AutoPlay action result parser
  function autoPlayActionResult(aData) {
    // console.log(JSON.stringify(aData));
    // example {"action":"bot_call","amount":0}
    console.log('AutoPlay action: ' + aData.action);

    // autoPlayCommandRequested.current = false; // reset always

    switch (aData.action) {
      case 'bot_fold':
        setFold();
        break;
      case 'bot_check':
        setCheck();
        break;
      case 'bot_call':
        setCheck();
        break;
      case 'bot_raise':
        setRaise(aData.amount);
        break;
      case 'bot_discard_and_draw':
        discardSelectedCards(aData.cards);
        break;
      case 'remove_bot':
        toast.warn(t('INSUFFICIENT_FUNDS'));
        leaveTable();
        break;
      case 'bot_spin_bottle':
        spinBottle();
        break;
      default:
        setCheck();
        break;
    }
  }

  function leaveTable() {
    if (socket) {
      const data = JSON.stringify({
        key: 'leaveTable',
        tableId: tableId,
      });
      socket.send(data);
    }
  }

  const discardSelectedCards = (selected) => {
    console.log(`Auto play selected cards to discard ${selected}`);
    if (socket) {
      const data = JSON.stringify({
        key: 'discardAndDraw',
        tableId: tableId,
        cardsToDiscard: selected,
      });
      socket.send(data);
    } else {
      toast.error(t('INVALID_SOCKET'));
    }
  };

  function setFold() {
    if (socket) {
      const data = JSON.stringify({
        key: 'setFold',
        tableId: tableId,
      });
      socket.send(data);
    }
  }

  function setCheck() {
    if (socket) {
      const data = JSON.stringify({
        key: 'setCheck',
        tableId: tableId,
      });
      socket.send(data);
    }
  }

  function setRaise(amount) {
    if (socket && amount > 0) {
      const data = JSON.stringify({
        key: 'setRaise',
        tableId: tableId,
        amount: amount,
      });
      socket.send(data);
    }
  }

  function spinBottle() {
    const hero = heroTurn.data;
    if (socket && hero && hero.isPlayerTurn) {
      const data = JSON.stringify({
        key: 'bottleSpin',
        tableId: tableId,
      });
      socket.send(data);
    }
  }

  function raiseHelper(amount, allIn) {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (player.playerId === playerId && player.isPlayerTurn && Number(player.playerMoney) > 0) {
        if (!allIn) {
          if (player.playerMoney + player.tempBet > 0) {
            const playerTotalBet = player.playerTotalBet + amount;
            const playerMoney = player.playerMoney - amount;
            player.tempBet = player.tempBet + amount;
            player.setPlayerMoney(playerMoney);
            player.setPlayerTotalBet(playerTotalBet);
          } else {
            toast.error(t('NOT_ENOUGH_MONEY_TO_RAISE'));
            return;
          }
        } else {
          const playerTotalBet = player.playerMoney + player.tempBet;
          const playerMoney = 0;
          player.tempBet = player.playerMoney + player.tempBet;
          player.setPlayerMoney(playerMoney);
          player.setPlayerTotalBet(playerTotalBet);
        }
        if (enableSounds) {
          playCardPlaceChipsOne.play();
        }
        refreshSeats();
      }
    }
  }

  function betChipClick(amount) {
    if (playerId) {
      raiseHelper(amount, false);
    }
  }

  function betAllInClick() {
    if (playerId) {
      raiseHelper(0, true);
    }
  }

  function myRaiseHelper() {
    const hero = heroTurn.data;
    if (hero) {
      const rTempBet = hero.tempBet;
      hero.tempBet = 0;
      return rTempBet;
    }
    return 0;
  }

  function foldBtnClick(hero) {
    if (hero && hero.isPlayerTurn) {
      setFold();
    }
  }

  function checkBtnClick(hero) {
    if (hero && hero.isPlayerTurn) {
      if (hero.tempBet > 0) {
        toast.info(t('ALREADY_THROWN_CHIPS'));
        const rTempBet = hero.tempBet;
        hero.tempBet = 0;
        setRaise(rTempBet);
      } else {
        setCheck();
      }
    }
  }

  function raiseBtnClick(hero) {
    if (hero && hero.isPlayerTurn) {
      const chips = myRaiseHelper();
      setRaise(chips);
    }
  }

  const view = useMemo(() => {
    const current = ctrl.data;
    const hero = heroTurn.data;
    const room = roomInfo.data;
    const minBet = Math.max(Number(room?.getMinBetValue?.() || 10), 10);
    const quickBetValues = [minBet, minBet * 2, minBet * 5, minBet * 10];
    const canAct = !autoCheck && !autoPlay && hero && hero.isPlayerTurn;
    const canFold = Boolean(canAct && hero.actionsAvailable.includes('FOLD'));
    const canCheckOrCall = Boolean(
      canAct && (hero.actionsAvailable.includes('CHECK') || hero.actionsAvailable.includes('CALL'))
    );
    const canRaise = Boolean(canAct && hero.actionsAvailable.includes('RAISE'));
    const canSpinBottle = Boolean(canAct && hero.actionsAvailable.includes('SPIN_BOTTLE'));
    const middleLabel = current.isCallSituation ? t('CALL') : t('CHECK');
    const rightLabel = canSpinBottle ? t('SPIN_BOTTLE') : t('RAISE');

    const onMobileRaiseClick = () => {
      if (canSpinBottle) {
        spinBottle();
      } else if (canRaise) {
        setRaiseExpanded((prev) => !prev);
      }
    };

    const onMobileQuickBet = (amount) => {
      setRaise(amount);
      setRaiseExpanded(false);
    };

    const onMobileAllIn = () => {
      const allInAmount = Number(hero?.playerMoney ?? 0) + Number(hero?.tempBet ?? 0);
      if (allInAmount > 0) {
        setRaise(allInAmount);
      }
      setRaiseExpanded(false);
    };

    const onMobileCustomConfirm = () => {
      const raw = customRaiseInput.trim().replace(/,/g, '');
      const num = Math.floor(Number(raw));
      const maxRaise = Number(hero?.playerMoney ?? 0) + Number(hero?.tempBet ?? 0);
      if (Number.isNaN(num) || num < minBet) {
        toast.error(t('NOT_ENOUGH_MONEY_TO_RAISE') || `至少加注 ${formatMoney(minBet)}`);
        return;
      }
      if (num > maxRaise) {
        toast.error(t('NOT_ENOUGH_MONEY_TO_RAISE') || '超出可用筹码');
        return;
      }
      setRaise(num);
      setCustomRaiseInput('');
      setRaiseExpanded(false);
    };

    return (
      <>
        <DesktopControls>
          <ControlCard className="card">
            <SectionLabel>快捷下注</SectionLabel>
            <QuickBetRow>
              {quickBetValues.map((amount) => (
                <StyledBetBtn
                  key={amount}
                  onClick={() => betChipClick(amount)}
                  label={`+${formatMoney(amount)}`}
                />
              ))}
              <StyledBetBtn onClick={betAllInClick} label={t('ALL_IN')} />
            </QuickBetRow>

            <SectionLabel style={{ marginTop: '14px' }}>当前操作</SectionLabel>
            <ActionRow>
              <StyledActBtn
                onClick={() => canFold && foldBtnClick(hero)}
                className={canFold && current.isFoldBtn ? 'ctrl-btn-visible' : ''}
                label={t('FOLD')}
                active={canFold}
                disabled={!canFold}
              />
              <StyledActBtn
                onClick={() => canCheckOrCall && checkBtnClick(hero)}
                className={canCheckOrCall && current.isCheckBtn ? 'ctrl-btn-visible' : ''}
                label={middleLabel}
                active={canCheckOrCall}
                disabled={!canCheckOrCall}
              />
              <StyledActBtn
                onClick={() => {
                  if (canSpinBottle) {
                    spinBottle();
                  } else if (canRaise) {
                    raiseBtnClick(hero);
                  }
                }}
                className={canRaise || canSpinBottle ? 'ctrl-btn-visible' : ''}
                label={rightLabel}
                active={canRaise || canSpinBottle}
                disabled={!(canRaise || canSpinBottle)}
              />
            </ActionRow>
          </ControlCard>
        </DesktopControls>

        <MobileControls>
          <MobileBarRow>
            <MobileBtn
              type="button"
              $active={canFold}
              disabled={!canFold}
              onClick={() => canFold && foldBtnClick(hero)}
            >
              {t('FOLD')}
            </MobileBtn>
            <MobileBtn
              type="button"
              className="btn-call"
              $active={canCheckOrCall}
              disabled={!canCheckOrCall}
              onClick={() => canCheckOrCall && checkBtnClick(hero)}
            >
              {middleLabel}
            </MobileBtn>
            <MobileBtn
              type="button"
              className="btn-raise"
              $active={canRaise || canSpinBottle}
              disabled={!(canRaise || canSpinBottle)}
              onClick={onMobileRaiseClick}
            >
              {rightLabel} {canRaise ? '▼' : ''}
            </MobileBtn>
          </MobileBarRow>
          {raiseExpanded && canRaise && (
            <>
              <MobileRaisePanel>
                {quickBetValues.map((amount) => (
                  <MobileQuickBetBtn
                    key={amount}
                    type="button"
                    onClick={() => onMobileQuickBet(amount)}
                  >
                    +{formatMoney(amount)}
                  </MobileQuickBetBtn>
                ))}
                <MobileQuickBetBtn type="button" onClick={onMobileAllIn}>
                  {t('ALL_IN')}
                </MobileQuickBetBtn>
              </MobileRaisePanel>
              <MobileCustomRow>
                <MobileCustomInput
                  type="number"
                  min={minBet}
                  max={Number(hero?.playerMoney ?? 0) + Number(hero?.tempBet ?? 0)}
                  placeholder={t('RAISE') || '加注金额'}
                  value={customRaiseInput}
                  onChange={(e) => setCustomRaiseInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onMobileCustomConfirm()}
                />
                <MobileConfirmBtn type="button" onClick={onMobileCustomConfirm}>
                  确定
                </MobileConfirmBtn>
              </MobileCustomRow>
            </>
          )}
        </MobileControls>
      </>
    );
  }, [ctrl, heroTurn, autoCheck, autoPlay, roomInfo, playerId, raiseExpanded, customRaiseInput]);

  return view;
};

export default TurnControl;
