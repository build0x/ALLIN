import React, { useContext, useMemo } from 'react';
import styled from 'styled-components';
import tableContext from '@/context/table/tableContext';

const stripPrefix = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/^♦\s*/, '').trim();
};

const StyledCard = styled.div`
  background: linear-gradient(160deg, rgba(37, 37, 37, 0.96) 0%, rgba(24, 24, 24, 0.96) 100%);
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 16px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
  width: 100%;
  padding: 12px 14px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(212, 175, 55, 0.08) 0%, transparent 34%);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    padding: 6px 8px;
    border-radius: 12px;
  }
`;

const DesktopOnly = styled.div`
  display: block;

  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileOnly = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
    z-index: 1;
  }
`;

const HeaderGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
`;

const StatusChip = styled.div`
  padding: 10px 12px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(212, 175, 55, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

  @media (max-width: 768px) {
    padding: 6px 8px;
    border-radius: 10px;
  }
`;

const Label = styled.div`
  font-size: 11px;
  letter-spacing: 0.04em;
  color: rgba(212, 175, 55, 0.88);
  margin-bottom: 4px;

  @media (max-width: 768px) {
    font-size: 10px;
    margin-bottom: 2px;
    letter-spacing: 0.04em;
  }
`;

const Value = styled.div`
  color: #f4f4f4;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 600;
  word-break: break-word;

  @media (max-width: 768px) {
    font-size: 12px;
    line-height: 1.2;
  }
`;

const ActionStrip = styled.div`
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    gap: 6px;
    margin-top: 6px;
  }
`;

const HighlightCard = styled.div`
  padding: 12px 14px;
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0.04) 100%);
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);

  @media (max-width: 768px) {
    padding: 7px 9px;
    border-radius: 10px;
  }
`;

const MobileTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
`;

const MobileRoomName = styled.div`
  color: #f5f5f5;
  font-size: 13px;
  font-weight: 700;
  min-width: 0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MobileMinBet = styled.div`
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.12);
  border: 1px solid rgba(212, 175, 55, 0.18);
  color: #f5d978;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
`;

const MobileActionRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
`;

const MobileActionChip = styled.div`
  min-width: 0;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(212, 175, 55, 0.1);
`;

const MobileChipLabel = styled.div`
  color: rgba(212, 175, 55, 0.86);
  font-size: 10px;
  line-height: 1.1;
  margin-bottom: 2px;
`;

const MobileChipValue = styled.div`
  color: #f5f5f5;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RoomStatus = ({ mobileMode = 'full' }) => {
  const { roomInfo } = useContext(tableContext);

  const view = useMemo(() => {
    const current = roomInfo.data;
    const summaryItems = current.getTournamentBlind()
      ? [
          { label: '房间', value: current.getTableName() },
          { label: '当前盲注', value: current.getTournamentBlind() },
          { label: '下次升盲', value: current.getTournamentNextBlind() },
          { label: '观战人数', value: current.getRoomSpectatorCount() },
        ]
      : [
          { label: '房间', value: current.getTableName() },
          { label: '最低下注', value: current.getMinBet() },
          { label: '观战人数', value: current.getRoomSpectatorCount() },
          { label: '等待中', value: current.getRoomWaitingPlayersCount() },
        ];

    return (
      <StyledCard className="card">
        {mobileMode !== 'actions' ? (
          <DesktopOnly>
            <HeaderGrid>
              {summaryItems.map((item) => (
                <StatusChip key={item.label}>
                  <Label>{item.label}</Label>
                  <Value className="roomStatusText">{item.value}</Value>
                </StatusChip>
              ))}
            </HeaderGrid>
            <ActionStrip>
              <HighlightCard>
                <Label>状态</Label>
                <Value id="roomStatusText" className="roomStatusText">
                  {current.getRoomStatusText()}
                </Value>
              </HighlightCard>
              <HighlightCard>
                <Label>当前行动</Label>
                <Value id="roomTurnText" className="roomStatusText">
                  {current.getRoomTurnText()}
                </Value>
              </HighlightCard>
            </ActionStrip>
          </DesktopOnly>
        ) : null}

        <MobileOnly>
          {mobileMode !== 'actions' ? (
            <MobileTopRow>
              <MobileRoomName title={stripPrefix(current.getTableName())}>
                {stripPrefix(current.getTableName())}
              </MobileRoomName>
              <MobileMinBet>{stripPrefix(current.getMinBet())}</MobileMinBet>
            </MobileTopRow>
          ) : null}

          {mobileMode !== 'top' ? (
            <MobileActionRow>
              <MobileActionChip>
                <MobileChipLabel>状态</MobileChipLabel>
                <MobileChipValue id="roomStatusText" className="roomStatusText">
                  {current.getRoomStatusText()}
                </MobileChipValue>
              </MobileActionChip>
              <MobileActionChip>
                <MobileChipLabel>当前行动</MobileChipLabel>
                <MobileChipValue id="roomTurnText" className="roomStatusText">
                  {current.getRoomTurnText()}
                </MobileChipValue>
              </MobileActionChip>
            </MobileActionRow>
          ) : null}
        </MobileOnly>
      </StyledCard>
    );
  }, [roomInfo, mobileMode]);

  return view;
};

export default RoomStatus;
