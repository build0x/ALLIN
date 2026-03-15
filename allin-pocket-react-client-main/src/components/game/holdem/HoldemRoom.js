import React, { useContext, useMemo } from 'react';
import HoldemTable from '@/components/game/holdem/HoldemTable';
import BoardCards from '@/components/game/BoardCards';
import TurnControl from '@/components/game/TurnControl';
import Overlay from '@/components/Overlay';
import tableContext from '@/context/table/tableContext';
import globalContext from '@/context/global/globalContext';
import { formatMoney } from '@/utils/Money';
import { getCardResource } from '@/utils/CardRes';
import styled from 'styled-components';

// 牌型英文 -> 中文（结算弹窗用）
const HAND_NAME_ZH = {
  'high card': '高牌',
  'one pair': '一对',
  'two pairs': '两对',
  'three of a kind': '三条',
  straight: '顺子',
  flush: '同花',
  'full house': '葫芦',
  'four of a kind': '四条',
  'straight flush': '同花顺',
  'invalid hand': '无效牌',
};
function handNameToChinese(name) {
  if (!name || typeof name !== 'string') return name;
  let out = name.trim();
  const lower = out.toLowerCase();
  // 先处理带牌面的："Pair, K's" -> "一对 K"，"Three of a Kind, Q's" -> "三条 Q"（牌面含 10/T/J/Q/K/A/2-9）
  const rank = '(10|[2-9tjqka])';
  out = out.replace(new RegExp(`\\b(?:one\\s+)?pair,?\\s*${rank}'s?`, 'gi'), (_, r) => `一对 ${r.toUpperCase()}`);
  out = out.replace(new RegExp(`\\bthree of a kind,?\\s*${rank}'s?`, 'gi'), (_, r) => `三条 ${r.toUpperCase()}`);
  out = out.replace(new RegExp(`\\bfour of a kind,?\\s*${rank}'s?`, 'gi'), (_, r) => `四条 ${r.toUpperCase()}`);
  out = out.replace(new RegExp(`\\btwo pairs?,?\\s*${rank}'s?\\s*&\\s*${rank}'s?`, 'gi'), (_, a, b) => `两对 ${a.toUpperCase()} 和 ${b.toUpperCase()}`);
  out = out.replace(new RegExp(`\\bfull house,?\\s*${rank}'s?\\s*full of\\s*${rank}'s?`, 'gi'), (_, a, b) => `葫芦 ${a.toUpperCase()} 带 ${b.toUpperCase()}`);
  out = out.replace(new RegExp(`\\b${rank}'s\\b`, 'gi'), (_, r) => r.toUpperCase());
  // 再替换纯类型名：straight -> 顺子 等
  Object.keys(HAND_NAME_ZH).forEach((en) => {
    out = out.replace(new RegExp(en.replace(/\s+/g, '\\s+'), 'gi'), HAND_NAME_ZH[en]);
  });
  return out.trim() || name;
}

const RoomShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
`;

const TableSection = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  min-height: 0;

  @media (min-width: 768px) {
    padding-bottom: 100px;
  }

  @media (max-width: 768px) {
    padding-bottom: 120px;
  }
`;

const BoardWrap = styled.div`
  margin-top: 8px;
  display: flex;
  justify-content: center;

  @media (max-width: 768px) {
    margin-top: 0;
    width: 100%;
  }
`;

const ControlsSection = styled.div`
  flex-shrink: 0;

  @media (min-width: 768px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1100;
    padding: 12px 0 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    background: radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.08), transparent 40%),
      linear-gradient(180deg, #121212 0%, #0d0d0d 100%);
    border-top: 1px solid rgba(212, 175, 55, 0.12);
  }

  @media (max-width: 768px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1100;
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(0, 0, 0, 0.92);
    border-top: 1px solid rgba(212, 175, 55, 0.12);
  }
`;

// 结算底部横条：仅移动端显示；电脑端改用牌桌内动画
const SettlementBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(72px + env(safe-area-inset-bottom));
  z-index: 1099;
  pointer-events: none;
  padding: 8px 12px 10px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-top: 1px solid rgba(180, 140, 20, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 0;

  @media (min-width: 769px) {
    bottom: calc(68px + env(safe-area-inset-bottom));
  }

  @media (min-width: 768px) {
    display: none;
  }
`;

// 电脑端：牌桌顶部结算区（赢家手牌 + 放大字体），显示直到下局开始
const SettlementTopWrap = styled.div`
  display: none;
  @media (min-width: 768px) {
    display: flex;
    position: absolute;
    left: 50%;
    top: 12px;
    transform: translateX(-50%);
    z-index: 100;
    pointer-events: none;
    align-items: center;
    gap: 12px;
    padding: 8px 16px 10px;
    border-radius: 12px;
    border: 1px solid rgba(212, 175, 55, 0.35);
    background: linear-gradient(180deg, rgba(28, 26, 22, 0.88) 0%, rgba(18, 16, 14, 0.92) 100%);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    opacity: ${(p) => (p.$visible ? 1 : 0)};
    transition: opacity 0.35s ease;
  }
`;

const SettlementTopCards = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
`;

const SettlementTopCardImg = styled.div`
  width: 44px;
  height: 64px;
  border-radius: 6px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  border: 1px solid rgba(212, 175, 55, 0.4);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.25);
`;

const SettlementTopText = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: rgba(232, 224, 200, 0.98);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 420px;
`;

// 电脑端：筹码从底池飞向赢家的动画容器
const ChipFlyWrap = styled.div`
  display: none;
  @media (min-width: 768px) {
    display: block;
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 50;
  }
`;


const SettlementBarLine = styled.div`
  width: 100%;
  max-width: 560px;
  text-align: center;
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 769px) {
    font-size: 13px;
  }
`;

const SettlementBarLineMain = styled(SettlementBarLine)`
  font-weight: 700;
  font-size: 13px;

  @media (min-width: 769px) {
    font-size: 14px;
  }
`;

const HoldemRoom = () => {
  const { cardStyle } = useContext(globalContext);
  const { roundSettlement, settlementEffectVisible, seats } = useContext(tableContext);

  const winnerSeatIndex = useMemo(() => {
    if (!roundSettlement?.winnerPlayerId || !seats?.data) return -1;
    return seats.data.findIndex(
      (s) => s?.seatFrame && Number(s.playerId) === Number(roundSettlement.winnerPlayerId)
    );
  }, [roundSettlement?.winnerPlayerId, seats?.data]);

  const winnerCards = useMemo(() => {
    if (winnerSeatIndex < 0 || !seats?.data?.[winnerSeatIndex]) return [null, null];
    const seat = seats.data[winnerSeatIndex];
    return [
      seat.seatCard0 ? getCardResource(seat.seatCard0, cardStyle) : null,
      seat.seatCard1 ? getCardResource(seat.seatCard1, cardStyle) : null,
    ];
  }, [winnerSeatIndex, seats?.data, cardStyle]);

  const settlementTopText = useMemo(() => {
    if (!roundSettlement?.text) return '';
    const main = (roundSettlement.text || '').replace('，', ' ');
    const hand = roundSettlement.handName
      ? ` · ${handNameToChinese(roundSettlement.handName)}`
      : '';
    return main + hand;
  }, [roundSettlement]);

  return (
    <Overlay>
      {(showOverlay) => (
        <RoomShell>
          {roundSettlement ? (
            <SettlementBar
              style={{
                background:
                  roundSettlement.tone === 'win'
                    ? 'linear-gradient(180deg, rgba(42,36,18,0.72) 0%, rgba(28,26,20,0.68) 100%)'
                    : roundSettlement.tone === 'lose'
                      ? 'linear-gradient(180deg, rgba(48,28,30,0.72) 0%, rgba(28,24,24,0.68) 100%)'
                      : 'linear-gradient(180deg, rgba(36,36,36,0.7) 0%, rgba(26,26,26,0.65) 100%)',
              }}
            >
              <SettlementBarLineMain
                style={{
                  color:
                    roundSettlement.tone === 'win'
                      ? '#c9a227'
                      : roundSettlement.tone === 'lose'
                        ? '#d44f5c'
                        : '#e8e4d9',
                }}
              >
                {roundSettlement.tone === 'win' ? '🏆 ' : ''}
                {roundSettlement.text}
              </SettlementBarLineMain>
              {(roundSettlement.handName || (roundSettlement.pots && roundSettlement.pots.length > 0)) ? (
                <SettlementBarLine style={{ color: 'rgba(232,228,217,0.92)', fontWeight: 500 }}>
                  {roundSettlement.handName ? `牌型：${handNameToChinese(roundSettlement.handName)}` : ''}
                  {roundSettlement.handName && roundSettlement.pots?.length ? ' · ' : ''}
                  {roundSettlement.pots?.length
                    ? roundSettlement.pots
                        .map((pot) => `${pot.label} ${pot.type === 'refund' ? '返还 ' : ''}${formatMoney(pot.amount)}`)
                        .join(' · ')
                    : ''}
                </SettlementBarLine>
              ) : null}
              {roundSettlement.xpReward ? (
                <SettlementBarLine style={{ color: 'rgba(158,198,255,0.95)', fontSize: 11 }}>
                  经验奖励：{roundSettlement.xpReward.text}
                </SettlementBarLine>
              ) : null}
            </SettlementBar>
          ) : null}
          <TableSection>
            <SettlementTopWrap $visible={!!roundSettlement}>
              {(winnerCards[0] || winnerCards[1]) ? (
                <SettlementTopCards>
                  {winnerCards[0] && (
                    <SettlementTopCardImg style={{ backgroundImage: `url(${winnerCards[0]})` }} />
                  )}
                  {winnerCards[1] && (
                    <SettlementTopCardImg style={{ backgroundImage: `url(${winnerCards[1]})` }} />
                  )}
                </SettlementTopCards>
              ) : null}
              <SettlementTopText>{settlementTopText}</SettlementTopText>
            </SettlementTopWrap>
            {settlementEffectVisible &&
            roundSettlement?.winnerPlayerId != null &&
            winnerSeatIndex >= 0 ? (
              <ChipFlyWrap>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`chip-fly-dot chip-fly-to-seat-${winnerSeatIndex}`}
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </ChipFlyWrap>
            ) : null}
            <HoldemTable>
              <BoardWrap>
                <BoardCards />
              </BoardWrap>
            </HoldemTable>
          </TableSection>
          <ControlsSection>
            <TurnControl />
          </ControlsSection>
          {/*<button onClick={() => showOverlay('🎉 +10 XP WIN STREAK!')}>Overlay</button> */}
        </RoomShell>
      )}
    </Overlay>
  );
};

export default HoldemRoom;
