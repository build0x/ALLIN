import React, { useState, useEffect, useContext, useRef } from 'react';
import styled from 'styled-components';
import HoldemRoom from '@/components/game/holdem/HoldemRoom';
import GameTableHeader from '@/components/game/GameTableHeader';
import SettingsModal from '@/components/game/SettingsModal';
import Chat from '@/components/chat/Chat';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const HoldemPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socket, socketConnected } = useContext(socketContext);
  const { tableId, setTableId } = useContext(tableContext);
  const globalCtx = useContext(globalContext) ?? {};
  const openChatTrigger = globalCtx.openChatTrigger ?? 0;
  const openSettingsTrigger = globalCtx.openSettingsTrigger ?? 0;
  const setUnreadChatCount = globalCtx.setUnreadChatCount ?? (() => {});
  const queryTableId = Number(searchParams.get('tableId') || -1);
  const queryTournamentId = Number(searchParams.get('tournamentId') || -1);
  const isLeavingTableRef = useRef(false);

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  const leaveTable = () => {
    isLeavingTableRef.current = true;
    if (socket && tableId > -1) {
      const data = JSON.stringify({
        key: 'leaveTable',
        tableId,
      });
      socket.send(data);
    }
    setTableId(-1);
    navigate('/games', { replace: true });
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

  // 聊天关闭时收到新消息则未读数+1，图标变色并显示数量
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

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.handle('enterTournamentTable', (jsonData) => {
      const enterData = jsonData.data;
      if (!enterData.success) {
        navigate('/games', { replace: true });
        return;
      }

      setTableId(enterData.tableId);
      socket.send(
        JSON.stringify({
          key: 'getTableParams',
          tableId: enterData.tableId,
        })
      );
      navigate(
        `/holdem?tableId=${enterData.tableId}${
          queryTournamentId > -1 ? `&tournamentId=${queryTournamentId}` : ''
        }`,
        {
          replace: true,
        }
      );
    });
  }, [socket, navigate, setTableId, queryTournamentId]);

  useEffect(() => {
    if (!socketConnected) {
      return;
    }

    if (isLeavingTableRef.current) {
      return;
    }

    if (queryTournamentId > -1 && tableId === -1 && socket) {
      const token = localStorage.getItem('TOKEN');
      if (!token) {
        navigate('/games');
        return;
      }

      socket.send(
        JSON.stringify({
          key: 'enterTournamentTable',
          token,
          tournamentId: queryTournamentId,
        })
      );
      return;
    }

    if (queryTableId > -1 && tableId === -1 && socket) {
      setTableId(queryTableId);

      socket.send(
        JSON.stringify({
          key: 'selectSpectateTable',
          tableId: queryTableId,
          password: '',
        })
      );

      socket.send(
        JSON.stringify({
          key: 'getTableParams',
          tableId: queryTableId,
        })
      );
      return;
    }
    if (queryTableId === -1 && tableId === -1) {
      navigate('/games');
    }
  }, [socket, socketConnected, queryTableId, queryTournamentId, tableId, setTableId, navigate]);

  return (
    <>
      <StyledContainer>
        <GameTableHeader onBack={leaveTable} />
        <ContentRow>
          <MainColumn>
            <HoldemRoom />
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

export default HoldemPage;
