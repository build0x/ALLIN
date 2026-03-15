import React, { useContext, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';

const broadcastScroll = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;
import { toast } from 'react-toastify';
import tableContext from '@/context/table/tableContext';
import socketContext from '@/context/websocket/socketContext';
import globalContext from '@/context/global/globalContext';

const stripPrefix = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(/^♦\s*/, '').trim();
};

const HeaderWrap = styled.header`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(160deg, rgba(28, 28, 28, 0.98) 0%, rgba(18, 18, 18, 0.98) 100%);
  border-bottom: 1px solid rgba(212, 175, 55, 0.12);
  padding: 12px 12px 10px;
  position: relative;
  z-index: 13001;
`;

const Row1 = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
`;

const LeftGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const BackBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.25);
  background: rgba(40, 40, 40, 0.95);
  color: #f5f5f5;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    background: rgba(55, 55, 55, 0.95);
    border-color: rgba(212, 175, 55, 0.4);
  }
`;

const Brand = styled.span`
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #f8f8f8;
  font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
  & span.gold {
    color: #d4af37;
  }
`;

const CenterGroup = styled.div`
  display: none;
  @media (min-width: 768px) {
    display: flex;
    flex: 1;
    min-width: 0;
    max-width: 420px;
    align-items: center;
    margin: 6px 12px 0;
  }
`;

const HeaderBroadcastBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  overflow: hidden;
`;

const HeaderBroadcastLabel = styled.span`
  flex-shrink: 0;
  color: #f5d978;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
`;

const HeaderBroadcastViewport = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
`;

const HeaderBroadcastTrack = styled.div`
  display: inline-flex;
  min-width: max-content;
  will-change: transform;
  animation: ${broadcastScroll} 22s linear infinite;
`;

const HeaderBroadcastText = styled.span`
  display: inline-block;
  padding-right: 40px;
  color: rgba(245, 245, 245, 0.92);
  font-size: 12px;
`;

const RightIcons = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const IconBtn = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(40, 40, 40, 0.95);
  color: #f5f5f5;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  &:hover {
    background: rgba(55, 55, 55, 0.95);
    border-color: rgba(212, 175, 55, 0.35);
  }
`;

const ChatIconBtn = styled(IconBtn)`
  position: relative;
  ${(p) =>
    p.$hasUnread
      ? `
    background: rgba(60, 50, 20, 0.95);
    border-color: rgba(212, 175, 55, 0.6);
    color: #d4af37;
  `
      : ''}
`;

const ChatUnreadNum = styled.span`
  margin-left: 1px;
  font-size: 0.65em;
  font-weight: 700;
  vertical-align: 0.35em;
  line-height: 1;
`;

const Row2 = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  min-height: 28px;
`;

const RoomLine = styled.div`
  color: #f5f5f5;
  font-size: 13px;
  font-weight: 600;
  min-width: 0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BlindChip = styled.span`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.25);
  color: #f5d978;
  font-size: 11px;
  font-weight: 700;
`;

const TurnChip = styled.span`
  flex-shrink: 0;
  color: rgba(245, 245, 245, 0.9);
  font-size: 12px;
  font-weight: 600;
`;

const TurnChipHighlight = styled(TurnChip)`
  color: #ff6b6b;
  font-weight: 700;
  animation: pulse 1.2s ease-in-out infinite;
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }
`;

const SpectatorBadge = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.12);
  border: 1px solid rgba(212, 175, 55, 0.22);
  color: rgba(245, 245, 245, 0.9);
  font-size: 12px;
  font-weight: 600;
`;

const parseSpectatorCount = (str) => {
  if (str == null || typeof str !== 'string') return 0;
  const m = str.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

const LOBBY_BROADCAST =
  'ALLIN 广播：公平发牌基于服务器端加密安全随机数与 Fisher-Yates 洗牌算法，每局全新牌组、无人为干预，确保公正。';

/** 本局是否已进行中：有公共牌或有人处于行动回合 */
const isHandInProgress = (board, players) => {
  const hasCommunityCards =
    board?.data?.middleCards?.some((c) => c != null && c !== '') ?? false;
  const hasCurrentTurn = (players ?? []).some((p) => !!p?.isPlayerTurn);
  return hasCommunityCards || hasCurrentTurn;
};

const GameTableHeader = ({ onBack }) => {
  const navigate = useNavigate();
  const { roomInfo, seats, heroTurn, board, players, roundSettlement } =
    useContext(tableContext);
  const { socket, playerId } = useContext(socketContext) ?? {};
  const { requestOpenChat, requestOpenSettings, unreadChatCount } = useContext(globalContext) ?? {};

  const tableCtx = useContext(tableContext);
  const setTableId = tableCtx?.setTableId ?? (() => {});
  const current = roomInfo?.data;
  const tableId = tableCtx?.tableId ?? -1;

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
    } else {
      if (socket && tableId > -1) {
        socket.send(
          JSON.stringify({
            key: 'leaveTable',
            tableId,
          })
        );
      }
      setTableId(-1);
      navigate('/games', { replace: true });
    }
  };

  const roomName = current ? stripPrefix(current.getTableName?.() ?? '') : '';
  const tournamentBlind = current?.getTournamentBlind?.() ?? '';
  const minBetVal = current?.getMinBetValue?.() ?? 0;
  const blindStr =
    tournamentBlind || (minBetVal > 0 ? `${Math.floor(Number(minBetVal) / 2)}/${minBetVal}` : '');
  const turnTextRaw = current?.getRoomTurnText?.() ?? '';
  const turnName = turnTextRaw
    .replace(/^当前行动[：:]\s*/i, '')
    .replace(/^.*[：:]\s*/, '')
    .replace(/^♦\s*/, '')
    .trim() || '—';

  const spectatorCountStr = current?.getRoomSpectatorCount?.() ?? '';
  const spectatorCount = parseSpectatorCount(spectatorCountStr);

  const seatList = seats?.data ?? [];
  const isSpectating =
    !seatList.some(
      (seat) => seat?.seatFrame && Number(seat.playerId) === Number(playerId)
    );

  const playerList = Array.isArray(players) ? players : [];
  const heroPlayer = playerList.find(
    (p) => p && Number(p.playerId) === Number(playerId)
  );
  const heroFolded = !!(heroPlayer?.isFold);
  const isMyTurn = !!(heroTurn?.data?.isPlayerTurn);
  const handInProgress = isHandInProgress(board, playerList);

  const hasShownWaitToast = useRef(false);
  useEffect(() => {
    if (tableId < 0) {
      hasShownWaitToast.current = false;
      return;
    }
    if (isSpectating && handInProgress && !hasShownWaitToast.current) {
      hasShownWaitToast.current = true;
      toast.info('本局进行中，请等待下局开始后入座');
    }
  }, [tableId, isSpectating, handInProgress]);

  let statusText = '—';
  let statusHighlight = false;
  if (isSpectating) {
    if (handInProgress) {
      statusText = '⏳ 请等待下局开始';
    } else {
      statusText = `👁️ ${spectatorCount}人观战`;
    }
  } else if (roundSettlement) {
    statusText = '⏳ 等待下局';
  } else if (heroFolded) {
    statusText = '👁️ 观战本局';
  } else if (isMyTurn) {
    statusText = '🔴 轮到你！';
    statusHighlight = true;
  } else {
    statusText = turnName ? `▸ ${turnName}的回合` : '—';
  }

  return (
    <HeaderWrap>
      <Row1>
        <LeftGroup>
          <BackBtn type="button" onClick={handleBack} aria-label="返回大厅">
            ←
          </BackBtn>
          <Brand>
            ALL<span className="gold">IN</span>
          </Brand>
        </LeftGroup>
        <CenterGroup>
          <HeaderBroadcastBar>
            <HeaderBroadcastLabel>广播</HeaderBroadcastLabel>
            <HeaderBroadcastViewport>
              <HeaderBroadcastTrack>
                <HeaderBroadcastText>{LOBBY_BROADCAST}</HeaderBroadcastText>
                <HeaderBroadcastText aria-hidden="true">{LOBBY_BROADCAST}</HeaderBroadcastText>
              </HeaderBroadcastTrack>
            </HeaderBroadcastViewport>
          </HeaderBroadcastBar>
        </CenterGroup>
        <RightIcons>
          <SpectatorBadge title="观战人数">👁️ {spectatorCount}</SpectatorBadge>
          <IconBtn type="button" onClick={() => requestOpenSettings?.()} aria-label="设置">
            ⚙️
          </IconBtn>
          <ChatIconBtn
            type="button"
            onClick={() => requestOpenChat?.()}
            aria-label={unreadChatCount > 0 ? `实时聊天室，${unreadChatCount}条未读` : '实时聊天室'}
            $hasUnread={unreadChatCount > 0}
          >
            💬
            {unreadChatCount > 0 ? (
              <ChatUnreadNum>{unreadChatCount > 99 ? '99+' : unreadChatCount}</ChatUnreadNum>
            ) : null}
          </ChatIconBtn>
        </RightIcons>
      </Row1>
      <Row2>
        <RoomLine title={roomName}>
          {roomName}
          {blindStr ? ' · ' : ''}
          {blindStr ? <BlindChip>{blindStr}</BlindChip> : null}
        </RoomLine>
        {statusHighlight ? (
          <TurnChipHighlight>{statusText}</TurnChipHighlight>
        ) : (
          <TurnChip>{statusText}</TurnChip>
        )}
      </Row2>
    </HeaderWrap>
  );
};

export default GameTableHeader;
