import React, { useContext, useMemo } from 'react';
import styles from '../SeatSlot.module.css';
import globalContext from '@/context/global/globalContext';
import tableContext from '@/context/table/tableContext';
import { formatMoney } from '@/utils/Money';
import { getCardResource } from '@/utils/CardRes';

const HoldemSeatSlot = ({
  pos,
  className,
  playerId,
  seat,
  betLeft,
  betRight,
  betClassName = '',
}) => {
  const { cardStyle } = useContext(globalContext);
  const { roundSettlement, settlementEffectVisible } = useContext(tableContext);
  const isCurrentPlayer = Number(seat.playerId) === Number(playerId);
  const isCompactMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const isHeroCompactMobile = isCompactMobile && isCurrentPlayer;

  const isWinnerSeat =
    settlementEffectVisible &&
    roundSettlement?.winnerPlayerId != null &&
    Number(seat.playerId) === Number(roundSettlement.winnerPlayerId);
  const showFloatAmount =
    isWinnerSeat && roundSettlement?.winnerAmount != null && roundSettlement.winnerAmount > 0;

  const actionView = useMemo(() => {
    const seatLastAction = seat.seatLastAction;

    return (
      <div className="container player-action-pos">
        {seatLastAction ? (
          <div className="lastActionTexts magictime puffIn action-animation">{seatLastAction}</div>
        ) : null}
      </div>
    );
  }, [seat, seat.refreshLastAction]);

  const cardsView = useMemo(() => {
    let path0 = null;
    let path1 = null;
    const cardWidth = isCompactMobile ? (isCurrentPlayer ? '42px' : '34px') : '50px';
    const cardHeight = isCompactMobile ? (isCurrentPlayer ? '62px' : '50px') : '70px';
    const overlap = isCompactMobile ? (isCurrentPlayer ? '-10px' : '-8px') : '-12px';

    if (seat.playerId === playerId || seat.seatShowCards) {
      // show cards
      if (seat.seatCard0) {
        path0 = getCardResource(seat.seatCard0, cardStyle);
      }
      if (seat.seatCard1) {
        path1 = getCardResource(seat.seatCard1, cardStyle);
      }
    }

    if (seat.seatCard0 === undefined || seat.seatCard0 === null) {
      path0 = '';
    }
    if (seat.seatCard1 === undefined || seat.seatCard1 === null) {
      path1 = '';
    }

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 0,
          width: '100%',
          marginBottom: isCompactMobile ? '2px' : '4px',
        }}
      >
        <div
          className={`cardOne ${
            path0 !== null && seat.puffInFastEnabled ? 'magicFast puffIn' : ''
          } ${seat.seatWinningGlowCard0 ? 'card-glow' : ''}`}
          style={{
            visibility: path0 === null ? 'hidden' : 'visible',
            backgroundImage: seat.seatCard0 ? `url(${path0})` : seat.seatIsFold ? 'url()' : '',
            width: cardWidth,
            height: cardHeight,
            marginLeft: 0,
          }}
        ></div>
        <div
          className={`cardTwo ${
            path1 !== null && seat.puffInFastEnabled ? 'magicFast puffIn' : ''
          } ${seat.seatWinningGlowCard1 ? 'card-glow' : ''}`}
          style={{
            visibility: path1 === null ? 'hidden' : 'visible',
            backgroundImage: seat.seatCard1 ? `url(${path1})` : seat.seatIsFold ? 'url()' : '',
            width: cardWidth,
            height: cardHeight,
            marginLeft: overlap,
          }}
        ></div>
      </div>
    );
  }, [
    cardStyle,
    seat.seatCard0,
    seat.seatCard1,
    seat.seatWinningGlowCard0,
    seat.seatWinningGlowCard1,
    seat.puffInFastEnabled,
    isCompactMobile,
    isCurrentPlayer,
    playerId,
  ]);

  const betFrameView = useMemo(() => {
    return seat.seatBetFrame ? (
      <div
        id="BetFrame"
        className={`container ${seat.seatDoBet ? 'magictime puffIn' : ''} bet-pos ${
          betLeft ? 'bet-left' : ''
        } ${betRight ? 'bet-right' : ''}
            ${betClassName}
            `}
        style={{
          animation: seat.seatCollectChips ? pos + 'ChipsToPot 0.5s alternate forwards' : '',
        }}
      >
        <div className="moneyView"></div>
        <div id="TotalBet" className="betTexts">
          {formatMoney(seat.seatTotalBet)}
        </div>
      </div>
    ) : (
      ''
    );
  }, [seat.seatBetFrame, seat.seatDoBet, seat.seatCollectChips, seat.seatTotalBet]);

  return (
    <div className={styles.root}>
      <div
        id={'S-' + seat.id}
        className={`SeatFrame seat-pos-${pos} ${className} ${isWinnerSeat ? 'seat-winner-glow' : ''}`}
      >
        {showFloatAmount ? (
          <div className="settlement-float-amount">
            +{formatMoney(roundSettlement.winnerAmount)}
          </div>
        ) : null}
        {actionView}
        <div
          className="container"
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {cardsView}
        </div>
        <div
          className="container"
          style={{
            width: '100%',
            marginTop: isCompactMobile ? '-12px' : '-20px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            id="CardView"
            className={`card ${seat.cardAnimation ? 'card-animation' : ''}`}
            style={{
              width: isCompactMobile ? (isCurrentPlayer ? '112px' : '94px') : '110px',
              maxWidth: isCompactMobile ? (isCurrentPlayer ? '112px' : '94px') : '110px',
              padding: isCompactMobile ? '4px 5px 3px' : '4px 8px 3px',
              border: isCurrentPlayer ? '2px solid #d4af37' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isCurrentPlayer
                ? '0 0 0 2px rgba(212, 175, 55, 0.2), 0 0 18px rgba(212, 175, 55, 0.45)'
                : 'none',
              background: isCurrentPlayer
                ? 'linear-gradient(180deg, rgba(52,52,64,0.98) 0%, rgba(37,37,49,0.98) 100%)'
                : undefined,
            }}
          >
            <div id="Name" className="seatTexts">
              {seat.seatName}
              {isCurrentPlayer ? (
                <span
                  style={{
                    marginLeft: '6px',
                    padding: isCompactMobile ? '1px 4px' : '1px 6px',
                    borderRadius: '999px',
                    background: '#d4af37',
                    color: '#111',
                    fontSize: isCompactMobile ? '9px' : '11px',
                    fontWeight: 700,
                  }}
                >
                  我
                </span>
              ) : null}
            </div>
            <div id="Money" className="seatTexts">
              {formatMoney(seat.seatMoney)}
            </div>
            {isCurrentPlayer &&
            roundSettlement?.tone === 'win' &&
            Number(roundSettlement.amount || 0) > 0 ? (
              <div
                className="seatTexts"
                style={{
                  color: 'rgba(245, 217, 120, 0.96)',
                  fontSize: isCompactMobile ? '10px' : '12px',
                  fontWeight: 700,
                  marginTop: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: isCompactMobile ? '1px 6px' : '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(18, 18, 18, 0.46)',
                  border: '1px solid rgba(212, 175, 55, 0.16)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                赢 {formatMoney(roundSettlement.amount)}
              </div>
            ) : null}
            <div className="progress">
              <div
                className="progress-bar"
                role="progressbar"
                id="TimeBar"
                aria-valuemin="0"
                aria-valuemax="100"
                style={
                  seat.seatTimeBar > 0
                    ? {
                        width: '100%',
                        animation: `lineburn ${seat.seatTimeBar / 1000}s linear forwards`,
                      }
                    : {}
                }
              ></div>
            </div>
          </div>
        </div>
        {betFrameView}
        {seat.seatDealerChip ? <div id="DealerChip" className="dealerChipView"></div> : ''}
      </div>
    </div>
  );
};

export default HoldemSeatSlot;
