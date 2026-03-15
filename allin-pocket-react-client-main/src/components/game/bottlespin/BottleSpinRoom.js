import React from 'react';
import TurnControl from '@/components/game/TurnControl';
import Overlay from '@/components/Overlay';
import BottleSpinTable from '@/components/game/bottlespin/BottleSpinTable';
import styled from 'styled-components';
import Bottle from '@/components/game/Bottle';

const CenteredBottleSpinTable = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const RoomShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
`;

const TableSection = styled.div`
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

const BottleSpinRoom = () => {
  return (
    <Overlay>
      {(showOverlay) => (
        <RoomShell>
          <TableSection>
            <CenteredBottleSpinTable>
              <BottleSpinTable>
                <Bottle />
              </BottleSpinTable>
            </CenteredBottleSpinTable>
          </TableSection>
          <ControlsSection>
            <TurnControl />
          </ControlsSection>
        </RoomShell>
      )}
    </Overlay>
  );
};

export default BottleSpinRoom;
