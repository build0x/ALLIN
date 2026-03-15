import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import FiveCardDrawRoom from '@/components/game/fiveCardDraw/FiveCardDrawRoom';
import GameTableHeader from '@/components/game/GameTableHeader';
import SettingsModal from '@/components/game/SettingsModal';
import Chat from '@/components/chat/Chat';
import { useNavigate } from 'react-router-dom';
import socketContext from '@/context/websocket/socketContext';
import tableContext from '@/context/table/tableContext';
import globalContext from '@/context/global/globalContext';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  min-height: calc(100vh - 58px);
  padding: 12px 16px 18px;
  box-sizing: border-box;

  @media (min-width: 768px) {
    background: radial-gradient(circle at top, rgba(212, 175, 55, 0.10), transparent 25%),
      linear-gradient(180deg, #121212 0%, #0d0d0d 100%);
  }
`;

const ContentRow = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;

  @media (min-width: 768px) {
    gap: 18px;
    align-items: stretch;
  }
`;

const MainColumn = styled.div`
  flex: 1;
  width: 100%;
  max-width: none;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const ChatColumn = styled.div`
  display: none;

  @media (min-width: 768px) {
    display: flex;
    width: 240px;
    min-width: 240px;
    max-width: 240px;
    height: 48vh;
    min-height: 320px;
    max-height: 48vh;
    align-self: center;
    flex-shrink: 0;
  }
`;

const FiveCardDrawPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { socket } = useContext(socketContext);
  const { tableId, setTableId } = useContext(tableContext);
  const globalCtx = useContext(globalContext) ?? {};
  const openChatTrigger = globalCtx.openChatTrigger ?? 0;
  const openSettingsTrigger = globalCtx.openSettingsTrigger ?? 0;
  const setUnreadChatCount = globalCtx.setUnreadChatCount ?? (() => {});

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  const leaveTable = () => {
    if (socket && tableId > -1) {
      const data = JSON.stringify({
        key: 'leaveTable',
        tableId,
      });
      socket.send(data);
    }
    setTableId(-1);
    navigate('/games');
  };

  useEffect(() => {
    if (openChatTrigger > 0) {
      setIsChatOpen(true);
    }
  }, [openChatTrigger]);

  useEffect(() => {
    if (openSettingsTrigger > 0) {
      setIsSettingsOpen(true);
    }
  }, [openSettingsTrigger]);

  useEffect(() => {
    if (!socket || isChatOpen) return;
    const handler = () => setUnreadChatCount((n) => n + 1);
    socket.handle('chatMessage', handler);
    return () => {
      if (typeof socket.removeHandler === 'function') socket.removeHandler('chatMessage');
    };
  }, [socket, isChatOpen, setUnreadChatCount]);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = window.innerWidth < 768;
      setIsMobile(nextIsMobile);
      if (nextIsMobile) setIsChatOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <StyledContainer>
        <GameTableHeader onBack={leaveTable} />
        <ContentRow>
          <MainColumn>
            <FiveCardDrawRoom />
          </MainColumn>
          {!isMobile && isChatOpen ? (
            <ChatColumn>
              <Chat toggleVisibility={toggleChat} />
            </ChatColumn>
          ) : null}
        </ContentRow>
        {isMobile && isChatOpen ? <Chat toggleVisibility={toggleChat} /> : null}
      </StyledContainer>
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

export default FiveCardDrawPage;
