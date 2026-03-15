import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socketContext from '@/context/websocket/socketContext';
import tableContext from '@/context/table/tableContext';
import contentContext from '@/context/content/contentContext';
import authContext from '@/context/auth/authContext';
import { formatMoney } from '@/utils/Money';
import NavButton from '@/components/buttons/NavButton';
import GameIcon from '@/components/GameIcon';
import { toast } from 'react-toastify';
import modalContext from '@/context/modal/modalContext';
import TablePasswordModal from '@/modals/TablePasswordModal';
import CreateTableModal from '@/modals/CreateTableModal';
import LobbyGuideModal from '@/modals/LobbyGuideModal';
import PublicChat from '@/components/chat/PublicChat';
import styled, { keyframes } from 'styled-components';
import { getAvatarOption } from '@/utils/avatar';
import { callAllinGameRegisterTournament } from '@/utils/wallet';

const broadcastScroll = keyframes`
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
`;

const ChatButton = styled.button`
  position: fixed;
  right: 10px;
  bottom: 10px;
  background: linear-gradient(135deg, #f5d978 0%, #d4af37 55%, #8f6b14 100%);
  color: #0d0d0d;
  border: 1px solid rgba(212, 175, 55, 0.45);
  border-radius: 50%;
  padding: 15px;
  font-size: 18px;
  cursor: pointer;
  z-index: 9999;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 36px rgba(212, 175, 55, 0.2);
  }
`;

const LobbyHero = styled.div`
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.16), transparent 36%),
    linear-gradient(145deg, #171717 0%, #101010 100%);
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 20px;
  padding: 24px 28px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
`;

const LobbyTag = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 6px 12px;
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 999px;
  color: #d4af37;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: rgba(212, 175, 55, 0.08);
`;

const LobbyTitle = styled.h1`
  margin: 0 0 8px;
  color: #ffffff;
  font-size: 2rem;
  font-weight: 800;

  span {
    color: #d4af37;
  }
`;

const LobbySubtitle = styled.p`
  margin: 0;
  color: #d0d0d0;
  font-size: 0.98rem;
`;

const BroadcastBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`;

const BroadcastLabel = styled.div`
  flex-shrink: 0;
  color: #f5d978;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const BroadcastViewport = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
`;

const BroadcastTrack = styled.div`
  display: inline-flex;
  min-width: max-content;
  will-change: transform;
  animation: ${broadcastScroll} 18s linear infinite;
`;

const BroadcastText = styled.span`
  display: inline-block;
  padding-right: 56px;
  color: #f5f5f5;
  font-size: 13px;
  line-height: 1.4;
`;

const CompactStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
`;

const CompactStatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 6px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.14);
  text-align: center;
  min-height: 78px;
`;

const CompactStatIcon = styled.div`
  color: #d4af37;
  font-size: 16px;
  line-height: 1;
  margin-bottom: 6px;
`;

const CompactStatNumber = styled.div`
  color: #f5d978;
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1.1;
`;

const CompactStatLabel = styled.div`
  color: #f5f5f5;
  font-size: 11px;
  margin-top: 4px;
  line-height: 1.2;
`;

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RoomGatewayGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const RoomHubHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  @media (max-width: 768px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const RoomHubTitle = styled.h4`
  margin: 0;
  color: #d4af37;
`;

const RoomHubGuideButton = styled.button`
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 12px;
  padding: 9px 14px;
  background: rgba(212, 175, 55, 0.08);
  color: #f5d978;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;

  &:hover {
    background: rgba(212, 175, 55, 0.14);
  }
`;

const RoomGatewayCard = styled.div`
  text-align: left;
  padding: 20px;
  border-radius: 22px;
  border: 1px solid
    ${(props) => (props.$friendly ? 'rgba(180, 108, 255, 0.28)' : 'rgba(212, 175, 55, 0.22)')};
  background: ${(props) =>
    props.$friendly
      ? 'radial-gradient(circle at top right, rgba(180, 108, 255, 0.14), transparent 34%), linear-gradient(145deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%)'
      : 'radial-gradient(circle at top right, rgba(212, 175, 55, 0.14), transparent 34%), linear-gradient(145deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%)'};
  color: #f5f5f5;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
  cursor: pointer;
`;

const RoomGatewayTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const RoomGatewayTitleWrap = styled.div`
  min-width: 0;
`;

const RoomGatewayTitle = styled.div`
  color: #ffffff;
  font-size: 22px;
  font-weight: 800;
`;

const RoomGatewayMeta = styled.div`
  color: #bfbfbf;
  font-size: 14px;
  margin-top: 6px;
  line-height: 1.6;
`;

const RoomGatewayArrow = styled.div`
  color: #f5d978;
  font-size: 22px;
  line-height: 1;
`;

const RoomGatewayAction = styled.button`
  margin-top: 16px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 14px;
  padding: 10px 16px;
  background: rgba(212, 175, 55, 0.08);
  color: #f5d978;
  font-size: 14px;
  font-weight: 700;
`;

const RoomViewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 18px 0 12px;
`;

const RoomViewTitleWrap = styled.div`
  min-width: 0;
`;

const RoomViewTitle = styled.h4`
  margin: 0;
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 800;
`;

const RoomViewSubtitle = styled.div`
  margin-top: 6px;
  color: #bfbfbf;
  font-size: 13px;
`;

const RoomViewBackButton = styled.button`
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: 12px;
  padding: 9px 14px;
  background: rgba(255, 255, 255, 0.03);
  color: #f5d978;
  font-size: 13px;
  font-weight: 700;
`;

const RoomCard = styled.div`
  border-radius: 18px;
  padding: 14px 16px;
  background: ${(props) =>
    props.$friendly
      ? 'linear-gradient(135deg, rgba(117, 54, 188, 0.16) 0%, rgba(255, 255, 255, 0.03) 100%)'
      : 'rgba(255, 255, 255, 0.03)'};
  border: 1px solid ${(props) => props.$borderColor || 'rgba(212,175,55,0.18)'};
  box-shadow: ${(props) =>
    props.$hot
      ? `0 0 22px ${props.$glowColor || 'rgba(212,175,55,0.28)'}`
      : '0 10px 26px rgba(0,0,0,0.18)'};
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
`;

const RoomHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const RoomTierWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const RoomTierBadge = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.$bg || 'rgba(212,175,55,0.16)'};
  color: #111;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.2);
`;

const RoomTitle = styled.div`
  color: #f5f5f5;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
`;

const RoomMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d7d7d7;
  font-size: 13px;
  flex-shrink: 0;
`;

const HotTag = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.16);
  color: #f5d978;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
`;

const RoomKindTag = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${(props) =>
    props.$friendly ? 'rgba(180, 108, 255, 0.18)' : 'rgba(212, 175, 55, 0.16)'};
  color: ${(props) => (props.$friendly ? '#e7c8ff' : '#f5d978')};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
`;

const RoomSubline = styled.div`
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const RoomMinBet = styled.div`
  color: #bfbfbf;
  font-size: 13px;
`;

const RoomMetaLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

const RoomJoinButton = styled.button`
  border: none;
  border-radius: 12px;
  padding: 8px 14px;
  background: linear-gradient(135deg, #f5d978 0%, #d4af37 55%, #8f6b14 100%);
  color: #111;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
`;

const ProgressWrap = styled.div`
  margin-top: 12px;
`;

const ProgressTrack = styled.div`
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${(props) => props.$width || '0%'};
  border-radius: 999px;
  background: ${(props) => props.$color || 'linear-gradient(90deg, #f5d978 0%, #d4af37 100%)'};
`;

const RoomFooter = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const ExpandAction = styled.button`
  padding: 0;
  border: none;
  background: transparent;
  color: #bfbfbf;
  font-size: 12px;
`;

const SecondaryActionWrap = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
`;

const OverviewCardsGrid = styled.div`
  display: grid;
  gap: 14px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const OverviewPanel = styled.div`
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.12), transparent 36%),
    rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: 18px;
  padding: 18px;
  min-height: 100%;
`;

const OverviewPanelTitle = styled.div`
  color: #f5f5f5;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 18px;
`;

const OverviewMetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

const OverviewMetricCard = styled.div`
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
`;

const OverviewMetricValue = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  color: #f5d978;
  font-size: clamp(0.82rem, 2.35vw, 0.92rem);
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  word-break: normal;
  overflow: hidden;
`;

const OverviewMetricIcon = styled.span`
  flex: 0 0 auto;
  line-height: 1;
`;

const OverviewMetricText = styled.span`
  min-width: 0;
  white-space: nowrap;
  font-size: clamp(0.8rem, 2.25vw, 0.9rem);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: clip;
`;

const OverviewMetricLabel = styled.div`
  color: #e9e9e9;
  font-size: 13px;
  margin-top: 4px;
`;

const AssetTable = styled.div`
  display: grid;
  gap: 8px;
`;

const AssetTableRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
`;

const AssetTableHead = styled.div`
  color: #bfbfbf;
  font-size: 13px;
  text-align: center;
`;

const AssetTableValue = styled.div`
  color: #f5d978;
  font-size: 1.35rem;
  font-weight: 800;
  text-align: center;
  line-height: 1.2;
`;

const AssetActions = styled.div`
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 18px;
  flex-wrap: wrap;
`;

const AssetActionButton = styled.button`
  min-width: 110px;
  border: 0;
  border-radius: 12px;
  padding: 10px 20px;
  font-weight: 700;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const AssetStatusText = styled.div`
  color: #bfbfbf;
  font-size: 12px;
  text-align: center;
  margin-top: 12px;
`;

const CreateRoomHero = styled.div`
  position: relative;
  overflow: hidden;
  padding: 22px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.18), transparent 28%),
    radial-gradient(circle at bottom left, rgba(212, 175, 55, 0.08), transparent 36%),
    linear-gradient(145deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 20px 40px rgba(0, 0, 0, 0.28);

  &::after {
    content: '';
    position: absolute;
    top: -32px;
    right: -24px;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, transparent 68%);
    pointer-events: none;
  }
`;

const CreateRoomHeader = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
`;

const CreateRoomHeaderMain = styled.div`
  min-width: 0;
`;

const CreateRoomEyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.18);
  color: #f5d978;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const CreateRoomLead = styled.div`
  margin-top: 12px;
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.3;
`;

const CreateRoomAccent = styled.span`
  color: #f5d978;
`;

const CreateRoomHint = styled.div`
  position: relative;
  z-index: 1;
  max-width: 620px;
  color: #c7c7c7;
  font-size: 13px;
  line-height: 1.6;
  margin-top: 10px;
`;

const CreateRoomRules = styled.details`
  position: relative;
  z-index: 1;
  margin-top: 18px;
`;

const CreateRoomRulesSummary = styled.summary`
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.12);
  color: #f5d978;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &::-webkit-details-marker {
    display: none;
  }
`;

const CreateRoomRulesContent = styled.div`
  margin-top: 10px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(212, 175, 55, 0.1);
`;

const CreateRoomRulesList = styled.div`
  display: grid;
  gap: 8px;
`;

const CreateRoomRuleItem = styled.div`
  color: #d7d7d7;
  font-size: 13px;
  line-height: 1.6;

  span {
    color: #f5d978;
    font-weight: 700;
  }
`;

const CreateRoomActionRow = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 18px;

  @media (max-width: 768px) {
    justify-content: stretch;
  }
`;

const CreateRoomPrimaryButton = styled.button`
  min-width: 156px;
  border: none;
  border-radius: 14px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #ffe08c 0%, #d4af37 58%, #8f6b14 100%);
  color: #101010;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 14px 28px rgba(212, 175, 55, 0.18);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 34px rgba(212, 175, 55, 0.24);
  }
`;

const TournamentStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TournamentCard = styled.div`
  padding: 18px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.1), transparent 38%),
    rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.14);
`;

const TournamentHeader = styled.div`
  color: #d4af37;
  font-size: 1.2rem;
  font-weight: 800;
`;

const TournamentStatusRow = styled.div`
  margin-top: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: #f5f5f5;
  font-size: 14px;
`;

const TournamentStatusText = styled.div`
  color: #f5f5f5;
`;

const TournamentRegistrationText = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(212, 175, 55, 0.12) 100%);
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 10px 24px rgba(0, 0, 0, 0.18);
`;

const TournamentRegistrationCount = styled.div`
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
`;

const TournamentRegistrationLabel = styled.div`
  color: #d4af37;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const TournamentEliminatedLabel = styled.div`
  color: #ff6b6b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const TournamentPrizeBlock = styled.div`
  margin-top: 18px;
`;

const TournamentBlockLabel = styled.div`
  color: #bfbfbf;
  font-size: 13px;
  margin-bottom: 8px;
`;

const TournamentPrizeValue = styled.div`
  color: #f5d978;
  font-size: clamp(2rem, 5vw, 2.7rem);
  font-weight: 900;
  line-height: 1.05;
`;

const TournamentConditions = styled.div`
  margin-top: 20px;
`;

const TournamentConditionText = styled.div`
  color: #f5f5f5;
  font-size: 14px;
  line-height: 1.6;
`;

const TournamentRuleHighlight = styled.div`
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.14);
  color: #f5d978;
  font-size: 13px;
  line-height: 1.6;
`;

const TournamentActionRow = styled.div`
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 10px;
  }
`;

const TournamentPrimaryButton = styled.button`
  min-width: 126px;
  border: 0;
  border-radius: 14px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 800;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    min-width: 0;
    flex: 1 1 calc(50% - 5px);
    padding: 11px 12px;
  }
`;

const TournamentSecondaryButton = styled.button`
  min-width: 112px;
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 700;

  @media (max-width: 768px) {
    min-width: 0;
    flex: 1 1 calc(50% - 5px);
    padding: 10px 12px;
  }
`;

const TournamentRulesModalCard = styled.div`
  width: min(92vw, 520px);
  padding: 20px 18px 18px;
  border-radius: 22px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.12), transparent 34%),
    linear-gradient(160deg, rgba(26, 26, 26, 0.98) 0%, rgba(12, 12, 12, 0.98) 100%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  color: #f5f5f5;
`;

const TournamentRulesModalTitle = styled.div`
  color: #d4af37;
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 14px;
`;

const TournamentRulesModalList = styled.div`
  display: grid;
  gap: 10px;
`;

const TournamentRulesModalItem = styled.div`
  color: #d7d7d7;
  font-size: 14px;
  line-height: 1.65;

  span {
    color: #f5d978;
    font-weight: 800;
  }
`;

const TournamentAssignmentText = styled.div`
  margin-top: 12px;
  color: #bfbfbf;
  font-size: 13px;
  line-height: 1.6;
`;

const TournamentBlindRow = styled.div`
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
`;

const TournamentBlindItem = styled.div`
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.12);
`;

const TournamentBlindLabel = styled.div`
  color: #bfbfbf;
  font-size: 11px;
  margin-bottom: 4px;
`;

const TournamentBlindValue = styled.div`
  color: #f5d978;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.35;
`;

const TournamentSpectateSection = styled.div`
  margin-top: 18px;
`;

const TournamentSpectateHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #f5f5f5;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
`;

const TournamentSpectateToggle = styled.button`
  flex-shrink: 0;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: #f5d978;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
`;

const TournamentSpectateScroll = styled.div`
  max-height: 360px;
  overflow-y: auto;
  padding-right: 6px;
`;

const TournamentSpectateGrid = styled.div`
  display: grid;
  gap: 10px;
`;

const TournamentSpectateCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.12);

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const TournamentSpectateMeta = styled.div`
  min-width: 0;
`;

const TournamentSpectateTitle = styled.div`
  color: #f5f5f5;
  font-size: 14px;
  font-weight: 700;
`;

const TournamentSpectateSubline = styled.div`
  margin-top: 4px;
  color: #bfbfbf;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
`;

const TournamentSpectateButton = styled.button`
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid rgba(212, 175, 55, 0.24);
  background: rgba(212, 175, 55, 0.08);
  color: #f5d978;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 700;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const TournamentPrizeRow = styled.div`
  display: grid;
  grid-template-columns: 54px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
`;

const TournamentPrizeRank = styled.div`
  color: #f5d978;
  font-size: 14px;
  font-weight: 800;
`;

const TournamentPrizePercent = styled.div`
  color: #f5f5f5;
  font-size: 14px;
  font-weight: 700;
`;

const TournamentPrizeAmount = styled.div`
  color: #d4af37;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
`;

const ChampionEmpty = styled.div`
  color: #bfbfbf;
  font-size: 14px;
`;

const AwardHistoryScroll = styled.div`
  margin-top: 12px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 6px;
`;

const AwardEditionBlock = styled.div`
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const AwardEditionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f5f5f5;
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 10px;
`;

const AwardEditionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.16);
  color: #f5d978;
  font-size: 11px;
  font-weight: 800;
`;

const AwardEditionCard = styled.div`
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.12);
`;

const AwardWinnerRow = styled.div`
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  &:last-of-type {
    border-bottom: 0;
  }
`;

const AwardWinnerRank = styled.div`
  color: #f5d978;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.4;
`;

const AwardWinnerContent = styled.div`
  min-width: 0;
`;

const AwardWinnerTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const AwardWinnerAddress = styled.div`
  color: #f5f5f5;
  font-size: 12px;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AwardWinnerPayout = styled.div`
  color: #f5d978;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
`;

const AwardWinnerActionRow = styled.div`
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const AwardWinnerActionButton = styled.button`
  padding: 0;
  border: none;
  background: transparent;
  color: #bfbfbf;
  font-size: 11px;
  line-height: 1.4;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const AwardPoolText = styled.div`
  margin-top: 10px;
  color: #bfbfbf;
  font-size: 13px;
  line-height: 1.6;

  span {
    color: #f5d978;
    font-weight: 800;
  }
`;

const Games = () => {
  const [searchParams] = useSearchParams();
  const queryStrTableId = searchParams.get('tableId');
  const roomView = searchParams.get('roomView') || 'hub';

  const { t } = useContext(contentContext);
  const { openView, openModal, closeModal } = useContext(modalContext);
  const socketCtx = useContext(socketContext);
  const { socket, socketConnected } = useContext(socketContext);
  const { tableId, setTableId } = useContext(tableContext);
  const {
    isAuthed,
    economyOverview,
    tournamentList,
    registerTournament,
    createCashTierTable,
    refreshEconomyOverview,
    walletSession,
  } = useContext(authContext);

  const navigate = useNavigate();

  const [tablesData, setTablesData] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [tournamentAssignment, setTournamentAssignment] = useState(null);
  const [tournamentClock, setTournamentClock] = useState(Date.now());
  const [isTournamentSpectateExpanded, setIsTournamentSpectateExpanded] = useState(false);
  const [isRegisteringTournament, setIsRegisteringTournament] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState(null);
  const currentTournament = useMemo(
    () => (tournamentList && tournamentList.length ? tournamentList[0] : null),
    [tournamentList]
  );
  const formatTokenAmount = (value) => Number(value || 0).toLocaleString('zh-CN');
  const shortenWalletAddress = (value) => {
    const nextValue = String(value || '').trim();
    if (!nextValue) {
      return '';
    }
    if (nextValue.length <= 12) {
      return nextValue;
    }
    return `${nextValue.slice(0, 4)}...${nextValue.slice(-4)}`;
  };

  const getTxExplorerUrl = (txHash) => {
    const normalizedHash = String(txHash || '').trim();
    if (!normalizedHash) {
      return '';
    }

    const chainId = Number(economyOverview?.chainId || 56);
    const baseUrl = chainId === 97 ? 'https://testnet.bscscan.com/tx/' : 'https://bscscan.com/tx/';
    return `${baseUrl}${normalizedHash}`;
  };

  const copyText = async (value, successText = '已复制') => {
    if (!value) {
      toast.error('没有可复制的内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(successText);
    } catch (error) {
      toast.error('复制失败，请手动复制');
    }
  };

  const getTables = (socket) => {
    if (socket) {
      const data = JSON.stringify({
        key: 'getTables',
        tableId: -1,
      });
      socket.send(data);
    }
  };

  useEffect(() => {
    if (socket && socketConnected) {
      socket.handle('getTables', (jsonData) => parseData(jsonData.data));

      socket.handle('invalidTablePassword', (jsonData) =>
        invalidTablePasswordResult(jsonData.data)
      );

      socket.handle('selectTable', (jsonData) => selectTableResult(jsonData.data));

      socket.handle('selectSpectateTable', (jsonData) => selectSpectateTableResult(jsonData.data));
      socket.handle('myTournamentTable', (jsonData) => handleTournamentAssignment(jsonData.data));
      socket.handle('enterTournamentTable', (jsonData) =>
        handleEnterTournamentTable(jsonData.data)
      );

      getTables(socket);
    }
  }, [socket, socketConnected]);

  useEffect(() => {
    if (socket && socketConnected && isAuthed && currentTournament?.id) {
      requestTournamentAssignment(currentTournament.id);
    }
  }, [socket, socketConnected, isAuthed, currentTournament?.id, tournamentList]);

  useEffect(() => {
    if (!currentTournament?.nextBlindAt) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTournamentClock(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentTournament?.nextBlindAt]);

  const parseData = (data) => {
    setTablesData(data.tables);
    setStatistics(data.stats);
  };

  const handleCreateTierTable = (tier) => {
    if (!isAuthed) {
      toast.error('请先连接钱包后再创建房间');
      return;
    }

    const holdAmount = Number(
      economyOverview?.userWallet?.walletAllinBalance ??
        economyOverview?.userWallet?.holdAmount ??
        0
    );
    if (holdAmount < Number(tier.minHoldAmount || 0)) {
      toast.error(`持仓不足，需要至少 ${tier.minHoldAmount} ALLIN`);
      return;
    }

    createCashTierTable(tier.code);
    setTimeout(() => {
      getTables(socket);
      refreshEconomyOverview();
    }, 500);
  };

  const openCreateTableModal = () => {
    if (!isAuthed) {
      toast.error('请先连接钱包后再创建房间');
      return;
    }

    openView(() => (
      <CreateTableModal
        closeModal={closeModal}
        context={{ socketCtx }}
        economyOverview={economyOverview}
        walletSession={walletSession}
        refreshEconomyOverview={refreshEconomyOverview}
        onSuccess={() => {
          setTimeout(() => {
            getTables(socket);
            refreshEconomyOverview();
          }, 300);
        }}
      />
    ));
  };

  const openLobbyGuideModal = () => {
    openView(() => <LobbyGuideModal closeModal={closeModal} />);
  };

  const openTournamentRulesModal = () => {
    openView(() => (
      <TournamentRulesModalCard>
        <TournamentRulesModalTitle>锦标赛规则</TournamentRulesModalTitle>
        <TournamentRulesModalList>
          <TournamentRulesModalItem>
            <span>报名条件：</span>
            持仓达到门槛后才可报名，并支付报名费进入本届赛事。
          </TournamentRulesModalItem>
          <TournamentRulesModalItem>
            <span>淘汰规则：</span>
            比赛采用淘汰制，玩家当前筹码降为 0 即淘汰出局。
          </TournamentRulesModalItem>
          <TournamentRulesModalItem>
            <span>分桌推进：</span>
            系统会按赛事进度自动分桌，桌内决出胜者后继续推进到下一轮。
          </TournamentRulesModalItem>
          <TournamentRulesModalItem>
            <span>报名时机：</span>
            当前赛事进行中时，会暂停下一轮报名，必须等待本轮全部结算完成后才开启下一轮。
          </TournamentRulesModalItem>
          <TournamentRulesModalItem>
            <span>获奖名次：</span>
            最终按第 1、2、3 名结算奖励，奖金记录会展示钱包地址与链上交易。
          </TournamentRulesModalItem>
          <TournamentRulesModalItem>
            <span>发奖方式：</span>
            奖池按当届配置比例发放，结算完成后可在历届获奖者区域查看发奖地址和交易。
          </TournamentRulesModalItem>
        </TournamentRulesModalList>
      </TournamentRulesModalCard>
    ));
  };

  const openRoomView = (view) => {
    navigate(`/games?roomView=${view}`);
  };

  const returnToRoomHub = () => {
    navigate('/games');
  };

  const beforeSelectTable = (tableId, passwordProtected) => {
    if (passwordProtected) {
      openView(() => (
        <TablePasswordModal
          closeModal={closeModal}
          onProceed={(password) => selectTable(tableId, password)}
        />
      ));
    } else {
      selectTable(tableId, '');
    }
  };

  const selectTable = (tableId, password) => {
    if (socket) {
      const data = JSON.stringify({
        key: 'selectTable',
        tableId: tableId,
        password: password,
      });
      socket.send(data);
    }
  };

  const invalidTablePasswordResult = (data) => {
    toast.error(t(data.translationKey));
  };

  const selectTableResult = (data) => {
    const data2 = JSON.stringify({
      key: 'getTableParams',
      tableId: data.tableId,
    });
    socket.send(data2);
    setTableId(data.tableId);
    handleNavigation(data.game, data.tableId);
  };

  const beforeSelectSpectateTable = (tableId, passwordProtected) => {
    if (passwordProtected) {
      openView(() => (
        <TablePasswordModal
          closeModal={closeModal}
          onProceed={(password) => selectSpectateTable(tableId, password)}
        />
      ));
    } else {
      selectSpectateTable(tableId, '');
    }
  };

  const selectSpectateTable = (tableId, password) => {
    if (socket) {
      const token = localStorage.getItem('TOKEN');
      const data = JSON.stringify({
        key: 'selectSpectateTable',
        tableId: tableId,
        password: password,
        token,
      });
      socket.send(data);
    }
  };

  const selectSpectateTableResult = (data) => {
    if (!data.success) {
      toast.error(
        data.translationKey === 'TOURNAMENT_SPECTATE_NOT_ALLOWED'
          ? '当前身份不可观战锦标赛牌桌'
          : t(data.translationKey) || data.message || '观战失败'
      );
      return;
    }

    const data2 = JSON.stringify({
      key: 'getTableParams',
      tableId: data.tableId,
    });
    socket.send(data2);
    setTableId(data.tableId);
    handleNavigation(data.game, data.tableId);
  };

  const handleNavigation = (game, nextTableId) => {
    switch (game) {
      case 'HOLDEM':
        navigate(`/holdem?tableId=${nextTableId}`);
        break;
      default:
        navigate('/games');
        break;
    }
  };

  const toggleChatVisibility = () => {
    setIsChatVisible(!isChatVisible);
  };

  const requestTournamentAssignment = (tournamentId) => {
    const token = localStorage.getItem('TOKEN');
    if (socket && token && tournamentId) {
      socket.send(
        JSON.stringify({
          key: 'getMyTournamentTable',
          token,
          tournamentId,
        })
      );
    }
  };

  const enterTournamentTable = (tournamentId) => {
    const token = localStorage.getItem('TOKEN');
    if (socket && token && tournamentId) {
      socket.send(
        JSON.stringify({
          key: 'enterTournamentTable',
          token,
          tournamentId,
        })
      );
    }
  };

  const handleTournamentAssignment = (data) => {
    if (!data.success) {
      setTournamentAssignment(null);
      return;
    }

    setTournamentAssignment(data.assignment || null);
  };

  const handleEnterTournamentTable = (data) => {
    if (!data.success) {
      toast.error(t(data.translationKey) || data.message || '进入锦标赛牌桌失败');
      return;
    }

    setTableId(data.tableId);
    navigate(`/holdem?tableId=${data.tableId}&tournamentId=${currentTournament?.id || ''}`);
  };

  const holdemTables = useMemo(
    () => (tablesData ? tablesData.filter((table) => table.game === 'HOLDEM') : []),
    [tablesData]
  );

  const systemHoldemTables = useMemo(
    () =>
      holdemTables.filter((table) => !['private_friendly', 'tournament'].includes(table.roomType)),
    [holdemTables]
  );

  const friendlyHoldemTables = useMemo(
    () => holdemTables.filter((table) => table.roomType === 'private_friendly'),
    [holdemTables]
  );

  const tierByMinBet = useMemo(() => {
    const entries = (economyOverview?.cashTiers || []).map((tier) => [Number(tier.minBet), tier]);
    return new Map(entries);
  }, [economyOverview]);

  const fullTiers = useMemo(
    () =>
      (economyOverview?.cashTiers || []).filter((tier) => {
        const tierTables = systemHoldemTables.filter(
          (table) => Number(table.tableMinBet || 0) === Number(tier.minBet)
        );

        if (!tierTables.length) {
          return false;
        }

        return tierTables.every(
          (table) => Number(table.playerCount || 0) >= Number(table.maxSeats || 0)
        );
      }),
    [economyOverview, systemHoldemTables]
  );

  const lobbyStats = useMemo(
    () => ({
      totalGames: holdemTables.length,
      totalPlayers: holdemTables.reduce((sum, table) => sum + Number(table.playerCount || 0), 0),
      totalBots: statistics?.totalBots || 0,
    }),
    [holdemTables, statistics]
  );
  const tierThemeByCode = {
    bronze: {
      icon: '🥉',
      borderColor: 'rgba(166, 108, 59, 0.58)',
      glowColor: 'rgba(166, 108, 59, 0.26)',
      badgeBg: 'linear-gradient(135deg, #d6a477 0%, #a66c3b 100%)',
    },
    silver: {
      icon: '🥈',
      borderColor: 'rgba(175, 182, 191, 0.58)',
      glowColor: 'rgba(175, 182, 191, 0.24)',
      badgeBg: 'linear-gradient(135deg, #e4e7eb 0%, #aeb6bf 100%)',
    },
    gold: {
      icon: '🥇',
      borderColor: 'rgba(212, 175, 55, 0.58)',
      glowColor: 'rgba(212, 175, 55, 0.28)',
      badgeBg: 'linear-gradient(135deg, #f5d978 0%, #d4af37 100%)',
    },
    diamond: {
      icon: '💎',
      borderColor: 'rgba(108, 193, 255, 0.58)',
      glowColor: 'rgba(108, 193, 255, 0.24)',
      badgeBg: 'linear-gradient(135deg, #9be8ff 0%, #54b9ff 100%)',
    },
    master: {
      icon: '👑',
      borderColor: 'rgba(196, 134, 255, 0.58)',
      glowColor: 'rgba(196, 134, 255, 0.26)',
      badgeBg: 'linear-gradient(135deg, #ffd978 0%, #b96dff 100%)',
    },
  };

  const formatAllinShort = (value, decimals = 2) => {
    if (value === null || value === undefined || value === '') {
      return '--';
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return `${value}`;
    }

    const formatCompact = (nextValue, unit) => {
      const rounded =
        nextValue >= 100
          ? nextValue.toFixed(0)
          : nextValue >= 10
            ? nextValue.toFixed(1)
            : nextValue.toFixed(decimals);
      return `${Number(rounded)}${unit}`;
    };

    if (Math.abs(numeric) >= 1000000) {
      return formatCompact(numeric / 1000000, 'M');
    }

    if (Math.abs(numeric) >= 1000) {
      return formatCompact(numeric / 1000, 'K');
    }

    if (Number.isInteger(numeric)) {
      return `${numeric}`;
    }

    return `${Number(numeric.toFixed(decimals))}`;
  };

  const displayOverviewValue = (value, decimals = 2) => formatAllinShort(value, decimals);
  const formatRoomExpiryLabel = (value) => {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return `至 ${date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`;
  };

  const normalizeTierTitle = (title) =>
    String(title || '')
      .replace(/德州扑克/g, '')
      .replace(/常规场/g, '场')
      .replace(/\s+/g, '')
      .trim();

  const renderRoomCards = (roomTables) => {
    if (!roomTables.length) return null;

    return roomTables.map((table) => {
      const {
        tableId,
        tableName,
        playerCount,
        maxSeats,
        tableMinBet = 10,
        passwordProtected,
        roomType,
        expiresAt,
      } = table;
      const isPrivateFriendly = roomType === 'private_friendly';
      const tier = tierByMinBet.get(Number(tableMinBet || 0));
      const tierCode = tier?.code || 'gold';
      const tierTheme = tierThemeByCode[tierCode] || tierThemeByCode.gold;
      const displayTableName = isPrivateFriendly
        ? tableName
        : normalizeTierTitle(
            tableName && !/^Table\s+\d+$/i.test(tableName) ? tableName : tier?.title || tableName
          );
      const numericPlayerCount = Number(playerCount || 0);
      const numericMaxSeats = Number(maxSeats || 0);
      const seatRatio = numericMaxSeats > 0 ? numericPlayerCount / numericMaxSeats : 0;
      const isHot = seatRatio >= 0.8;
      const isHighlighted = tableId === Number(queryStrTableId || -1);
      const expiryLabel = formatRoomExpiryLabel(expiresAt);
      const progressColor = isHot
        ? 'linear-gradient(90deg, #ffdf7a 0%, #ff8f5a 100%)'
        : 'linear-gradient(90deg, #f5d978 0%, #d4af37 100%)';

      return (
        <RoomCard
          key={tableId}
          $borderColor={isHighlighted ? '#f5d978' : tierTheme.borderColor}
          $glowColor={tierTheme.glowColor}
          $hot={isHot}
          $friendly={isPrivateFriendly}
        >
          <RoomHeader>
            <RoomTierWrap>
              <RoomTierBadge
                $bg={isPrivateFriendly ? 'rgba(180, 108, 255, 0.22)' : tierTheme.badgeBg}
              >
                {isPrivateFriendly ? '友' : tierTheme.icon}
              </RoomTierBadge>
              <RoomTitle>{displayTableName}</RoomTitle>
            </RoomTierWrap>
            <RoomMeta>
              {isHot ? <HotTag>热门</HotTag> : null}
              {isPrivateFriendly ? <RoomKindTag $friendly>亲友房</RoomKindTag> : null}
              <span>
                {numericPlayerCount}/{numericMaxSeats}
              </span>
            </RoomMeta>
          </RoomHeader>

          <RoomSubline>
            <RoomMetaLine>
              <RoomMinBet>最低 {formatAllinShort(tableMinBet)} ALLIN</RoomMinBet>
              {isPrivateFriendly && expiryLabel ? (
                <RoomKindTag $friendly>{expiryLabel}</RoomKindTag>
              ) : null}
            </RoomMetaLine>
            <RoomJoinButton onClick={() => beforeSelectTable(tableId, passwordProtected)}>
              加入 ▶
            </RoomJoinButton>
          </RoomSubline>

          <ProgressWrap>
            <ProgressTrack>
              <ProgressFill $width={`${Math.min(seatRatio * 100, 100)}%`} $color={progressColor} />
            </ProgressTrack>
          </ProgressWrap>

          <RoomFooter>
            <div style={{ color: '#bfbfbf', fontSize: '12px' }}>
              {'█'.repeat(Math.max(0, Math.min(numericPlayerCount, 6)))}
              {'░'.repeat(Math.max(0, 6 - Math.min(numericPlayerCount, 6)))} {numericPlayerCount}/
              {numericMaxSeats}
            </div>
            <ExpandAction
              type="button"
              onClick={() =>
                setExpandedRoomId((previousId) => (previousId === tableId ? null : tableId))
              }
            >
              {expandedRoomId === tableId ? '收起操作' : '更多操作'}
            </ExpandAction>
          </RoomFooter>

          {expandedRoomId === tableId ? (
            <SecondaryActionWrap>
              <NavButton onClick={() => beforeSelectSpectateTable(tableId, passwordProtected)}>
                观战
              </NavButton>
            </SecondaryActionWrap>
          ) : null}
        </RoomCard>
      );
    });
  };

  const systemRoomCards = useMemo(
    () => renderRoomCards(systemHoldemTables),
    [systemHoldemTables, tierByMinBet, queryStrTableId, expandedRoomId]
  );

  const friendlyRoomCards = useMemo(
    () => renderRoomCards(friendlyHoldemTables),
    [friendlyHoldemTables, tierByMinBet, queryStrTableId, expandedRoomId]
  );

  const getTournamentActionLabel = (tournament) => {
    if (tournament.registrationStatus === 'eliminated') {
      return '本轮已淘汰';
    }

    if (['registered', 'active', 'winner', 'settled'].includes(tournament.registrationStatus)) {
      return '已报名';
    }

    if (Number(tournament.registrationCount || 0) >= Number(tournament.maxPlayers || 0)) {
      return '赛事已满员';
    }

    if (tournament.status !== 'scheduled') {
      return '赛事进行中';
    }

    return '报名参赛';
  };

  const getTournamentStatusText = (status) => {
    switch (status) {
      case 'scheduled':
        return '报名中';
      case 'active':
        return '赛事正在进行中，暂停下一轮报名';
      case 'settled':
        return '已结算';
      case 'completed':
        return '已结束';
      default:
        return status || '--';
    }
  };

  const formatBnbAmount = (value) =>
    Number(value || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });

  const tournamentPrizePoolText = formatBnbAmount(currentTournament?.bnbPrizeAmount);
  const tournamentStatusText = getTournamentStatusText(currentTournament?.status);
  const tournamentBlindText =
    currentTournament?.currentSmallBlind && currentTournament?.currentBigBlind
      ? `${formatTokenAmount(currentTournament.currentSmallBlind)}/${formatTokenAmount(
          currentTournament.currentBigBlind
        )}`
      : '--';
  const tournamentNextBlindText = (() => {
    if (!currentTournament?.nextBlindAt) {
      return '已到最高盲注';
    }

    const diffMs = new Date(currentTournament.nextBlindAt).getTime() - tournamentClock;
    if (diffMs <= 0) {
      return '即将升级';
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}分${String(seconds).padStart(2, '0')}秒后`;
  })();
  const tournamentSpectateTables = Array.isArray(currentTournament?.currentTables)
    ? currentTournament.currentTables.filter((table) => Number(table.tableId || 0) > 0)
    : [];
  const isTournamentEliminated =
    tournamentAssignment?.registrationStatus === 'eliminated' ||
    (tournamentAssignment &&
      Number(tournamentAssignment.currentStack || 0) <= 0 &&
      currentTournament?.status === 'active');
  const tournamentRegistrationDisabled =
    !isAuthed ||
    !currentTournament ||
    ['registered', 'active', 'winner', 'settled', 'eliminated'].includes(
      currentTournament.registrationStatus
    ) ||
    currentTournament.status !== 'scheduled' ||
    Number(currentTournament.registrationCount || 0) >= Number(currentTournament.maxPlayers || 0);
  const awardHistoryEntries = useMemo(() => {
    const historyEntries = currentTournament?.historyTop3 || [];
    const totalEditions = historyEntries.length;
    return historyEntries.map((edition, index) => ({
      ...edition,
      displayTitle: `第${Math.max(totalEditions - index, 1)}届`,
      isLatest: index === 0,
    }));
  }, [currentTournament]);
  const lobbyBroadcast =
    '欢迎来到ALLIN · 合约已上线：0xbe3fd46ca68dc40be81ee30a866ae5592ed07777 · 锦标赛火热报名中 · 冠军赢BNB · 你准备好梭哈了吗？';

  return (
    <div className="container allin-lobby-page" style={{ maxWidth: '980px' }}>
      <LobbyHero className="mt-4">
        <LobbyTag>
          <span>♠</span>
          ALLIN LOBBY
        </LobbyTag>
        <LobbyTitle>
          <span>ALLIN</span> 德州扑克大厅
        </LobbyTitle>
        <LobbySubtitle>
          大厅主页现已整合钱包登录、持仓门槛、常规场管理及锦标赛奖池信息。
        </LobbySubtitle>
        <BroadcastBar>
          <BroadcastLabel>广播</BroadcastLabel>
          <BroadcastViewport>
            <BroadcastTrack>
              <BroadcastText>{lobbyBroadcast}</BroadcastText>
              <BroadcastText aria-hidden="true">{lobbyBroadcast}</BroadcastText>
            </BroadcastTrack>
          </BroadcastViewport>
        </BroadcastBar>
      </LobbyHero>

      <div className="card allin-section-card mt-4">
        <div className="card-body">
          <h4 style={{ color: '#d4af37', marginBottom: '12px' }}>大厅总览</h4>
          <div style={{ color: '#f5f5f5', opacity: 0.88, marginBottom: '14px' }}>
            {isAuthed
              ? '已连接钱包，可查看个人持仓与赛事资格。'
              : '连接钱包后可查看 ALLIN 持仓和锦标赛报名状态。'}
          </div>
          <OverviewCardsGrid>
            <OverviewPanel>
              <OverviewPanelTitle>平台概览</OverviewPanelTitle>
              <OverviewMetricGrid>
                <OverviewMetricCard>
                  <OverviewMetricValue>
                    <OverviewMetricIcon>🏆</OverviewMetricIcon>
                    <OverviewMetricText>
                      {displayOverviewValue(economyOverview?.prizePoolBnb)} BNB
                    </OverviewMetricText>
                  </OverviewMetricValue>
                  <OverviewMetricLabel>奖池总额</OverviewMetricLabel>
                </OverviewMetricCard>
                <OverviewMetricCard>
                  <OverviewMetricValue>
                    <OverviewMetricIcon>🔥</OverviewMetricIcon>
                    <OverviewMetricText>
                      {displayOverviewValue(economyOverview?.totalBurnedAllin)} 销毁
                    </OverviewMetricText>
                  </OverviewMetricValue>
                  <OverviewMetricLabel>累计销毁</OverviewMetricLabel>
                </OverviewMetricCard>
                <OverviewMetricCard>
                  <OverviewMetricValue>
                    <OverviewMetricIcon>👥</OverviewMetricIcon>
                    <OverviewMetricText>
                      {displayOverviewValue(lobbyStats.totalPlayers)} 在线
                    </OverviewMetricText>
                  </OverviewMetricValue>
                  <OverviewMetricLabel>大厅在线人数</OverviewMetricLabel>
                </OverviewMetricCard>
                <OverviewMetricCard>
                  <OverviewMetricValue>
                    <OverviewMetricIcon>🎮</OverviewMetricIcon>
                    <OverviewMetricText>
                      {displayOverviewValue(lobbyStats.totalGames)} 活跃牌桌
                    </OverviewMetricText>
                  </OverviewMetricValue>
                  <OverviewMetricLabel>当前活跃房间</OverviewMetricLabel>
                </OverviewMetricCard>
              </OverviewMetricGrid>
            </OverviewPanel>

            <OverviewPanel>
              <OverviewPanelTitle>资产中心</OverviewPanelTitle>
              <AssetTable>
                <AssetTableRow>
                  <AssetTableHead>钱包 ALLIN</AssetTableHead>
                  <AssetTableHead>筹码</AssetTableHead>
                </AssetTableRow>
                <AssetTableRow>
                  <AssetTableValue>
                    {isAuthed
                      ? displayOverviewValue(
                          economyOverview?.userWallet?.walletAllinBalance ??
                            economyOverview?.userWallet?.allinBalance
                        )
                      : '--'}
                  </AssetTableValue>
                  <AssetTableValue>
                    {isAuthed
                      ? displayOverviewValue(economyOverview?.userWallet?.chipBalance)
                      : '--'}
                  </AssetTableValue>
                </AssetTableRow>
              </AssetTable>
              <AssetActions>
                <AssetActionButton
                  type="button"
                  className="btn allin-gold-btn"
                  disabled={!isAuthed}
                  onClick={() => navigate('/account?tab=exchange')}
                >
                  充值
                </AssetActionButton>
                <AssetActionButton
                  type="button"
                  className="btn allin-gold-btn"
                  disabled={!isAuthed}
                  onClick={() => navigate('/account?tab=redeem')}
                >
                  换回代币
                </AssetActionButton>
              </AssetActions>
              {!isAuthed ? (
                <AssetStatusText>连接钱包后可查看链上 ALLIN 余额并充值到金库。</AssetStatusText>
              ) : (
                <AssetStatusText>
                  钱包中的 ALLIN 充值到金库后，会由后端同步并按 1:1 自动增加筹码。
                </AssetStatusText>
              )}
            </OverviewPanel>
          </OverviewCardsGrid>
        </div>
      </div>

      {roomView === 'hub' ? (
        <div className="card allin-section-card mt-4">
          <div className="card-body">
            <RoomHubHeader>
              <RoomHubTitle>房间入口</RoomHubTitle>
              <RoomHubGuideButton type="button" onClick={openLobbyGuideModal}>
                玩法说明
              </RoomHubGuideButton>
            </RoomHubHeader>
            <RoomGatewayGrid>
              <RoomGatewayCard onClick={() => openRoomView('system')}>
                <RoomGatewayTop>
                  <RoomGatewayTitleWrap>
                    <RoomGatewayTitle>🎮 系统房间</RoomGatewayTitle>
                    <RoomGatewayMeta>
                      官方牌桌 · {(economyOverview?.cashTiers || []).length} 个等级场
                    </RoomGatewayMeta>
                  </RoomGatewayTitleWrap>
                  <RoomGatewayArrow>▶</RoomGatewayArrow>
                </RoomGatewayTop>
              </RoomGatewayCard>

              <RoomGatewayCard $friendly onClick={() => openRoomView('friendly')}>
                <RoomGatewayTop>
                  <RoomGatewayTitleWrap>
                    <RoomGatewayTitle>👥 亲友房</RoomGatewayTitle>
                    <RoomGatewayMeta>
                      私人牌桌 · {friendlyHoldemTables.length} 个房间在线
                    </RoomGatewayMeta>
                  </RoomGatewayTitleWrap>
                  <RoomGatewayArrow>▶</RoomGatewayArrow>
                </RoomGatewayTop>
                <RoomGatewayAction
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCreateTableModal();
                  }}
                >
                  + 创建房间
                </RoomGatewayAction>
              </RoomGatewayCard>
            </RoomGatewayGrid>
          </div>
        </div>
      ) : null}

      {roomView === 'system' ? (
        <>
          <RoomViewHeader>
            <RoomViewTitleWrap>
              <RoomViewTitle>🎮 系统房间</RoomViewTitle>
              <RoomViewSubtitle>官方牌桌 · {systemHoldemTables.length} 个房间在线</RoomViewSubtitle>
            </RoomViewTitleWrap>
            <RoomViewBackButton type="button" onClick={returnToRoomHub}>
              返回入口
            </RoomViewBackButton>
          </RoomViewHeader>

          {tablesData ? (
            <div className="mt-2">
              <CompactStatsRow>
                <CompactStatItem>
                  <CompactStatIcon>🎮</CompactStatIcon>
                  <CompactStatNumber>{systemHoldemTables.length}</CompactStatNumber>
                  <CompactStatLabel>{t('TOTAL_GAME')}</CompactStatLabel>
                </CompactStatItem>
                <CompactStatItem>
                  <CompactStatIcon>👥</CompactStatIcon>
                  <CompactStatNumber>
                    {systemHoldemTables.reduce(
                      (sum, table) => sum + Number(table.playerCount || 0),
                      0
                    )}
                  </CompactStatNumber>
                  <CompactStatLabel>{t('TOTAL_PLAYERS')}</CompactStatLabel>
                </CompactStatItem>
                <CompactStatItem>
                  <CompactStatIcon>🤖</CompactStatIcon>
                  <CompactStatNumber>{lobbyStats.totalBots}</CompactStatNumber>
                  <CompactStatLabel>AI 机器人</CompactStatLabel>
                </CompactStatItem>
              </CompactStatsRow>
            </div>
          ) : null}

          {fullTiers.length ? (
            <div className="card allin-section-card mt-4">
              <div className="card-body">
                <div className="row g-3">
                  {fullTiers.map((tier) => (
                    <div className="col-md-6" key={tier.code}>
                      <div
                        className="p-3 rounded"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(212,175,55,0.14)',
                        }}
                      >
                        <div style={{ color: '#d4af37', fontWeight: 700 }}>{tier.title}</div>
                        <div style={{ color: '#f5f5f5', marginTop: '6px', fontSize: '14px' }}>
                          当前该档房间已满，也可一键补建同档规则房间
                        </div>
                        <div style={{ color: '#bfbfbf', marginTop: '4px', fontSize: '13px' }}>
                          最低下注 {tier.minBet} | 持仓门槛 {tier.minHoldAmount} ALLIN
                        </div>
                        <button
                          type="button"
                          className="btn allin-gold-btn mt-3"
                          onClick={() => handleCreateTierTable(tier)}
                        >
                          创建{tier.title}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div
            className="card allin-section-card"
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '10px',
            }}
          >
            <RoomList>
              {systemRoomCards || (
                <div style={{ textAlign: 'center', color: '#f5f5f5', padding: '18px 10px' }}>
                  {tablesData ? '暂无系统房间' : t('LOADING')}
                </div>
              )}
            </RoomList>
          </div>
        </>
      ) : null}

      {roomView === 'friendly' ? (
        <>
          <RoomViewHeader>
            <RoomViewTitleWrap>
              <RoomViewTitle>👥 亲友房</RoomViewTitle>
              <RoomViewSubtitle>
                私人牌桌 · {friendlyHoldemTables.length} 个房间在线
              </RoomViewSubtitle>
            </RoomViewTitleWrap>
            <RoomViewBackButton type="button" onClick={returnToRoomHub}>
              返回入口
            </RoomViewBackButton>
          </RoomViewHeader>

          <div className="card allin-section-card mt-2">
            <div className="card-body">
              <h4 style={{ color: '#d4af37', marginBottom: '14px' }}>创建房间</h4>
              <CreateRoomHero>
                <CreateRoomHeader>
                  <CreateRoomHeaderMain>
                    <CreateRoomEyebrow>
                      <span>♠</span>
                      PRIVATE ROOM
                    </CreateRoomEyebrow>
                    <CreateRoomLead>
                      和朋友开一桌 <CreateRoomAccent>更自由的亲友房</CreateRoomAccent>
                    </CreateRoomLead>
                  </CreateRoomHeaderMain>
                </CreateRoomHeader>
                <CreateRoomHint>
                  支持自定义好友房，可自由设置房名、密码和最低下注。创建后会立即出现在大厅列表中，
                  朋友输入密码即可加入。
                </CreateRoomHint>
                <CreateRoomRules>
                  <CreateRoomRulesSummary>
                    <span>展开查看完整规则</span>
                    <span>＋</span>
                  </CreateRoomRulesSummary>
                  <CreateRoomRulesContent>
                    <CreateRoomRulesList>
                      <CreateRoomRuleItem>
                        <span>房间时长：</span>可选 1 / 2 / 3 / 6 / 12 / 24 小时。
                      </CreateRoomRuleItem>
                      <CreateRoomRuleItem>
                        <span>燃烧规则：</span>按小时扣费，1 小时 = 10000
                        ALLIN，创建成功后立即扣除并燃烧。
                      </CreateRoomRuleItem>
                      <CreateRoomRuleItem>
                        <span>房间设置：</span>支持自定义房名、房间密码、最低下注和 2 到 6 个座位。
                      </CreateRoomRuleItem>
                      <CreateRoomRuleItem>
                        <span>加入方式：</span>
                        创建后会立即出现在大厅列表，其他玩家输入密码即可加入。
                      </CreateRoomRuleItem>
                      <CreateRoomRuleItem>
                        <span>关闭规则：</span>到时后会在当前牌局结算完成后自动关闭，不会中途断局。
                      </CreateRoomRuleItem>
                    </CreateRoomRulesList>
                  </CreateRoomRulesContent>
                </CreateRoomRules>
                <CreateRoomActionRow>
                  <CreateRoomPrimaryButton type="button" onClick={openCreateTableModal}>
                    创建好友房
                  </CreateRoomPrimaryButton>
                </CreateRoomActionRow>
              </CreateRoomHero>
            </div>
          </div>

          <div
            className="card allin-section-card"
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '10px',
            }}
          >
            <RoomList>
              {friendlyRoomCards || (
                <div style={{ textAlign: 'center', color: '#f5f5f5', padding: '18px 10px' }}>
                  {tablesData ? '暂无亲友房' : t('LOADING')}
                </div>
              )}
            </RoomList>
          </div>
        </>
      ) : null}
      <div className="card allin-section-card shadow-sm mt-4 mb-4">
        <div className="card-body">
          <TournamentStack>
            {isAuthed && currentTournament ? (
              <>
                <TournamentCard>
                  <TournamentHeader>
                    🏆 {currentTournament.title || 'ALLIN 总锦标赛'}
                  </TournamentHeader>
                  <TournamentStatusRow>
                    <TournamentStatusText>⏰ 状态: {tournamentStatusText}</TournamentStatusText>
                    <TournamentRegistrationText>
                      <TournamentRegistrationCount>
                        {currentTournament.registrationCount || 0}/
                        {currentTournament.maxPlayers || 0}
                      </TournamentRegistrationCount>
                      {isTournamentEliminated ? (
                        <TournamentEliminatedLabel>已淘汰</TournamentEliminatedLabel>
                      ) : (
                        <TournamentRegistrationLabel>已报名</TournamentRegistrationLabel>
                      )}
                    </TournamentRegistrationText>
                  </TournamentStatusRow>

                  <TournamentPrizeBlock>
                    <TournamentBlockLabel>💰 本届奖池</TournamentBlockLabel>
                    <TournamentPrizeValue>{tournamentPrizePoolText} BNB</TournamentPrizeValue>
                  </TournamentPrizeBlock>

                  <TournamentConditions>
                    <TournamentBlockLabel>📋 参赛条件</TournamentBlockLabel>
                    <TournamentConditionText>
                      持仓 ≥ {formatTokenAmount(currentTournament.requiredHoldAmount)} ALLIN
                    </TournamentConditionText>
                    <TournamentConditionText>
                      报名费 {formatTokenAmount(currentTournament.buyInAllin)} ALLIN
                    </TournamentConditionText>
                    <TournamentRuleHighlight>
                      {currentTournament.status === 'active'
                        ? '赛事正在进行中，暂停下一轮报名，必须等待本轮结束后才开启下一轮。'
                        : '淘汰规则：比赛采用淘汰制，当前筹码降为 0 即淘汰出局。'}
                    </TournamentRuleHighlight>
                  </TournamentConditions>

                  <TournamentBlindRow>
                    <TournamentBlindItem>
                      <TournamentBlindLabel>当前级别</TournamentBlindLabel>
                      <TournamentBlindValue>
                        {currentTournament?.blindLevel
                          ? `Level ${currentTournament.blindLevel}`
                          : '--'}
                      </TournamentBlindValue>
                    </TournamentBlindItem>
                    <TournamentBlindItem>
                      <TournamentBlindLabel>当前盲注</TournamentBlindLabel>
                      <TournamentBlindValue>{tournamentBlindText}</TournamentBlindValue>
                    </TournamentBlindItem>
                    <TournamentBlindItem>
                      <TournamentBlindLabel>下次升盲</TournamentBlindLabel>
                      <TournamentBlindValue>{tournamentNextBlindText}</TournamentBlindValue>
                    </TournamentBlindItem>
                  </TournamentBlindRow>

                  <TournamentActionRow>
                    <TournamentPrimaryButton
                      type="button"
                      className="btn allin-gold-btn"
                      disabled={tournamentRegistrationDisabled || isRegisteringTournament}
                      onClick={async () => {
                        const tokenAddress = economyOverview?.onchain?.allinTokenAddress;
                        const allinGameAddress = economyOverview?.onchain?.allinGameAddress;
                        if (!tokenAddress || !allinGameAddress) {
                          setIsRegisteringTournament(true);
                          registerTournament(currentTournament.id, {
                            onComplete: () => setIsRegisteringTournament(false),
                          });
                          return;
                        }
                        if (!walletSession?.walletId) {
                          toast.error('请先连接钱包');
                          return;
                        }
                        try {
                          setIsRegisteringTournament(true);
                          await callAllinGameRegisterTournament({
                            walletId: walletSession.walletId,
                            tokenAddress,
                            allinGameAddress,
                            expectedWalletAddress: economyOverview?.userWallet?.walletAddress,
                          });
                          registerTournament(currentTournament.id, {
                            onComplete: () => setIsRegisteringTournament(false),
                          });
                        } catch (err) {
                          setIsRegisteringTournament(false);
                          const msg = err?.message || '报名失败';
                          if (!msg.includes('取消') && !msg.includes('拒绝')) {
                            toast.error(msg);
                          }
                        }
                      }}
                    >
                      🎯{' '}
                      {isRegisteringTournament
                        ? '正在燃烧代币报名中'
                        : getTournamentActionLabel(currentTournament)}
                    </TournamentPrimaryButton>
                    <TournamentSecondaryButton
                      type="button"
                      className="btn btn-outline-warning"
                      onClick={openTournamentRulesModal}
                    >
                      查看规则
                    </TournamentSecondaryButton>
                    {tournamentAssignment?.canEnter && !isTournamentEliminated ? (
                      <TournamentSecondaryButton
                        type="button"
                        className="btn btn-outline-warning"
                        onClick={() => enterTournamentTable(currentTournament.id)}
                      >
                        进入牌桌
                      </TournamentSecondaryButton>
                    ) : null}
                  </TournamentActionRow>

                  {tournamentAssignment ? (
                    <TournamentAssignmentText>
                      {isTournamentEliminated
                        ? `我的分桌：${tournamentAssignment.tableLabel || '待分桌'} | 座位 ${
                            tournamentAssignment.seatNo || '-'
                          } | 当前筹码 0 | 你已被淘汰，等待下一轮的好运。`
                        : `我的分桌：${tournamentAssignment.tableLabel || '待分桌'} | 座位 ${
                            tournamentAssignment.seatNo || '-'
                          } | 当前筹码 ${formatTokenAmount(tournamentAssignment.currentStack || 0)}`}
                    </TournamentAssignmentText>
                  ) : null}

                  {currentTournament.status === 'active' && tournamentSpectateTables.length ? (
                    <TournamentSpectateSection>
                      <TournamentSpectateHeader>
                        <span>当前分桌观战</span>
                        <TournamentSpectateToggle
                          type="button"
                          onClick={() => setIsTournamentSpectateExpanded((previous) => !previous)}
                        >
                          {isTournamentSpectateExpanded ? '收起' : '展开'}
                        </TournamentSpectateToggle>
                      </TournamentSpectateHeader>
                      {isTournamentSpectateExpanded ? (
                        <TournamentSpectateScroll>
                          <TournamentSpectateGrid>
                            {tournamentSpectateTables.map((table) => (
                              <TournamentSpectateCard key={`tournament-table-${table.tableNo}`}>
                                <TournamentSpectateMeta>
                                  <TournamentSpectateTitle>
                                    第 {table.tableNo} 桌
                                  </TournamentSpectateTitle>
                                  <TournamentSpectateSubline>
                                    {table.playerCount || 0} 人在桌上 | 观战{' '}
                                    {table.spectatorsCount || 0} 人
                                  </TournamentSpectateSubline>
                                  <TournamentSpectateSubline>
                                    {Array.isArray(table.players)
                                      ? table.players
                                          .map(
                                            (player) => player.username || `玩家${player.userId}`
                                          )
                                          .slice(0, 6)
                                          .join(' / ')
                                      : '暂无分桌信息'}
                                  </TournamentSpectateSubline>
                                </TournamentSpectateMeta>
                                <TournamentSpectateButton
                                  type="button"
                                  disabled={!table.canSpectate}
                                  onClick={() => beforeSelectSpectateTable(table.tableId, false)}
                                >
                                  {table.canSpectate ? '观战此桌' : '当前不可观战'}
                                </TournamentSpectateButton>
                              </TournamentSpectateCard>
                            ))}
                          </TournamentSpectateGrid>
                        </TournamentSpectateScroll>
                      ) : null}
                    </TournamentSpectateSection>
                  ) : null}
                </TournamentCard>

                <TournamentCard>
                  <TournamentHeader>🥇🥈🥉 奖金分配</TournamentHeader>
                  <div style={{ marginTop: '12px' }}>
                    {(currentTournament.prizeDistribution || []).length ? (
                      currentTournament.prizeDistribution.slice(0, 3).map((item, index) => (
                        <TournamentPrizeRow key={`${item.label}-${index}`}>
                          <TournamentPrizeRank>
                            {item.label || `${index + 1}st`}
                          </TournamentPrizeRank>
                          <TournamentPrizePercent>
                            {Math.round(Number(item.percent || 0) * 100)}%
                          </TournamentPrizePercent>
                          <TournamentPrizeAmount>
                            {formatBnbAmount(item.amount)} BNB
                          </TournamentPrizeAmount>
                        </TournamentPrizeRow>
                      ))
                    ) : (
                      <ChampionEmpty>暂无奖金分配数据</ChampionEmpty>
                    )}
                  </div>
                </TournamentCard>

                <TournamentCard>
                  <TournamentHeader>👑 历届获奖者</TournamentHeader>
                  {awardHistoryEntries.length ? (
                    <AwardHistoryScroll>
                      {awardHistoryEntries.map((edition) => (
                        <AwardEditionBlock key={edition.editionKey || edition.displayTitle}>
                          <AwardEditionTitle>
                            <span>📍 {edition.displayTitle}</span>
                            {edition.isLatest ? <AwardEditionBadge>最新</AwardEditionBadge> : null}
                          </AwardEditionTitle>
                          <AwardEditionCard>
                            {(edition.top3 || []).map((entry, index) => {
                              const walletAddress = String(entry.walletAddress || '').trim();
                              const winnerAddress =
                                walletAddress || entry.username || `用户${entry.userId || ''}`;
                              const displayAddress = walletAddress
                                ? shortenWalletAddress(walletAddress)
                                : winnerAddress;
                              const txExplorerUrl = getTxExplorerUrl(entry.txHash);
                              const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                              return (
                                <AwardWinnerRow
                                  key={`${edition.editionKey || edition.displayTitle}-${entry.rank || index}`}
                                >
                                  <AwardWinnerRank>{rankIcon}</AwardWinnerRank>
                                  <AwardWinnerContent>
                                    <AwardWinnerTop>
                                      <AwardWinnerAddress title={winnerAddress}>
                                        {displayAddress}
                                      </AwardWinnerAddress>
                                      <AwardWinnerPayout>
                                        {formatBnbAmount(entry.payoutBnb)} BNB
                                      </AwardWinnerPayout>
                                    </AwardWinnerTop>
                                    <AwardWinnerActionRow>
                                      <AwardWinnerActionButton
                                        type="button"
                                        onClick={() => copyText(walletAddress, '钱包地址已复制')}
                                        disabled={!walletAddress}
                                      >
                                        复制地址
                                      </AwardWinnerActionButton>
                                      {txExplorerUrl ? (
                                        <AwardWinnerActionButton
                                          as="a"
                                          href={txExplorerUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          点击查看交易 ↗
                                        </AwardWinnerActionButton>
                                      ) : null}
                                    </AwardWinnerActionRow>
                                  </AwardWinnerContent>
                                </AwardWinnerRow>
                              );
                            })}
                            <AwardPoolText>
                              奖池 <span>{formatBnbAmount(edition.prizePoolBnb)} BNB</span>
                            </AwardPoolText>
                          </AwardEditionCard>
                        </AwardEditionBlock>
                      ))}
                    </AwardHistoryScroll>
                  ) : (
                    <div style={{ marginTop: '12px' }}>
                      <ChampionEmpty>暂无记录</ChampionEmpty>
                    </div>
                  )}
                </TournamentCard>
              </>
            ) : null}
            {isAuthed && !currentTournament ? (
              <div style={{ color: '#f5f5f5' }}>暂无赛事数据</div>
            ) : null}
            {!isAuthed ? (
              <div
                style={{
                  color: '#bfbfbf',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.14)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                }}
              >
                未登录状态下不显示锦标赛数据，请先连接钱包。
              </div>
            ) : null}
          </TournamentStack>
        </div>
      </div>
      <PublicChat isVisible={isChatVisible} toggleVisibility={toggleChatVisibility} />
      <ChatButton onClick={() => toggleChatVisibility()}>💬</ChatButton>
    </div>
  );
};

export default Games;
