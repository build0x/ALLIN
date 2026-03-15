import React, { useState, useEffect, useRef, useContext } from 'react';
import styled from 'styled-components';
import socketContext from '@/context/websocket/socketContext';
import contentContext from '@/context/content/contentContext';
import { toast } from 'react-toastify';
import tableContext from '@/context/table/tableContext';

const ChatBackdrop = styled.button`
  display: none;

  @media (max-width: 767px) {
    display: block;
    position: fixed;
    inset: 0;
    border: 0;
    background: transparent;
    z-index: 1098;
  }
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  width: 100%;
  min-height: 0;

  @media (max-width: 767px) {
    position: fixed;
    left: 20px;
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
    min-width: 0;
    right: auto;
    bottom: calc(100px + env(safe-area-inset-bottom));
    max-height: 42vh;
    min-height: 160px;
    border-radius: 14px;
    overflow: hidden;
    z-index: 1099;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(212, 175, 55, 0.18);
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    transform: translateX(0);
    position: static;
    width: 100%;
    max-width: none;
    height: 48vh;
    min-height: 320px;
    max-height: 48vh;
  }
`;

const ChatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(160deg, rgba(38, 38, 38, 0.75) 0%, rgba(24, 24, 24, 0.72) 100%);
  border-bottom: 1px solid rgba(212, 175, 55, 0.15);
  color: #f5f5f5;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  flex-shrink: 0;

  @media (max-width: 767px) {
    padding: 10px 12px;
    font-size: 14px;
    font-weight: 700;
  }
`;

const CloseButton = styled.button`
  border: 0;
  background: rgba(212, 175, 55, 0.12);
  color: #f5f5f5;
  font-size: 20px;
  line-height: 1;
  padding: 4px 10px;
  border-radius: 8px;

  @media (min-width: 768px) {
    font-size: 16px;
    padding: 2px 8px;
    &:hover {
      background: rgba(212, 175, 55, 0.25);
    }
  }

  @media (max-width: 767px) {
    font-weight: 400;
    &:active {
      background: rgba(212, 175, 55, 0.25);
    }
  }
`;

const ChatCard = styled.div`
  display: flex;
  flex-direction: column;
  max-height: inherit;
  height: 100%;
  min-height: 0;
  min-width: 0;
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);

  @media (max-width: 767px) {
    overflow: hidden;
  }
`;

const MessageList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 8px;

  @media (max-width: 767px) {
    padding: 8px;
    gap: 6px;
  }
`;

const MessageWrapper = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow-y: auto;
  min-height: 0;
  background: linear-gradient(180deg, rgba(46, 46, 46, 0.18) 0%, rgba(28, 28, 28, 0.12) 100%);
  -webkit-overflow-scrolling: touch;

  @media (max-width: 767px) {
    min-height: 100px;
  }
`;

const MessageBubble = styled.div`
  padding: 10px 15px;
  border-radius: 15px;
  background-color: rgba(46, 46, 58, 0.78);
  color: white;
  align-self: flex-start;
  word-wrap: break-word;
  word-break: break-word;
  font-size: 13px;
  max-width: 86%;

  @media (max-width: 767px) {
    padding: 7px 10px;
    border-radius: 10px;
    font-size: 12px;
  }

  .username {
    font-size: 10px;
    font-weight: lighter;
    color: #ccc;

    @media (max-width: 767px) {
      font-size: 10px;
      margin-bottom: 2px;
    }
  }

  .message-content {
    font-size: 13px;

    @media (max-width: 767px) {
      font-size: 12px;
    }
  }
`;

const MOBILE_BREAK = 767;

const Chat = ({ toggleVisibility }) => {
  const { t } = useContext(contentContext);
  const { socket } = useContext(socketContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAK);
  const messageEndRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAK);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { tableId } = useContext(tableContext);

  useEffect(() => {
    getChatMessages();
  }, [socket, tableId]);

  function getChatMessages() {
    if (socket) {
      const data = JSON.stringify({
        key: 'getChatMessages',
      });
      socket.send(data);
    }
  }

  const scrollToBottom = () => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const regAuthHandler = (socket) => {
    socket.handle('getChatMessages', (jsonData) => handleMessages(jsonData.data));

    socket.handle('chatMessage', (jsonData) => newMessageData(jsonData.data));
  };

  function handleMessages(mData) {
    const messages = mData.messages;
    if (isMounted.current) {
      setMessages(messages);
    }
  }

  function newMessageData(mData) {
    if (mData.success) {
      const newMessage = mData.chatMessage;
      if (newMessage.message.trim() && isMounted.current) {
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      }
    } else {
      toast.error(t(mData.translationKey));
    }
  }

  useEffect(() => {
    if (socket) {
      regAuthHandler(socket);
    }
    return () => {
      if (socket) {
        // handler is removed to prevent memory leaks
        socket.removeHandler && socket.removeHandler('chatMessage');
      }
    };
  }, [socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleSendMessage = () => {
    if (!newMessage.trim()) {
      return;
    }
    if (socket) {
      const data = JSON.stringify({
        key: 'chatMessage',
        message: newMessage,
        // tableId: tableIdRef.current, // this is determined by back end for security reasons
      });
      socket.send(data);
      setNewMessage('');
    } else {
      toast.error(t('COULD_NOT_SEND_MESSAGE'));
    }
  };

  return (
    <>
      <ChatBackdrop type="button" aria-label="关闭聊天" onClick={toggleVisibility} />
      <ChatContainer>
        <ChatHeader>
          <span>消息</span>
          <CloseButton type="button" aria-label="关闭聊天" onClick={toggleVisibility}>
            ✕
          </CloseButton>
        </ChatHeader>
        <ChatCard
          className="card text-white"
          style={{
            background: 'linear-gradient(160deg, rgba(54,54,54,0.52) 0%, rgba(37,37,37,0.48) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.15)',
            borderRadius: 'inherit',
            overflow: 'hidden',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            className="card-body"
            style={{ padding: 0, overflow: 'hidden', flex: 1, minHeight: 0 }}
          >
            <MessageWrapper>
              <MessageList>
                {messages.map((message, index) => (
                  <MessageBubble key={index}>
                    <div className="username">{message.playerName}</div>
                    <div className="message-content">{message.message}</div>
                  </MessageBubble>
                ))}
                <div ref={messageEndRef}></div>
              </MessageList>
            </MessageWrapper>
          </div>
          <div
            className="card-footer d-flex align-items-center"
            style={{
              background: 'rgba(28, 28, 28, 0.65)',
              borderTop: '1px solid rgba(212, 175, 55, 0.15)',
              padding: isMobile ? '10px 12px' : '6px',
              flexShrink: 0,
              gap: isMobile ? 10 : undefined,
            }}
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              placeholder={isMobile ? '输入消息...' : t('MESSAGE')}
              className="form-control me-2"
              style={{
                flex: 1,
                fontSize: isMobile ? 14 : 12,
                background: 'rgba(255,255,255,0.88)',
                minWidth: 0,
                height: isMobile ? 40 : 34,
                padding: isMobile ? '10px 12px' : '6px 10px',
                borderRadius: isMobile ? 10 : undefined,
              }}
            />
            <button
              onClick={handleSendMessage}
              className="btn btn-danger"
              style={{
                fontSize: isMobile ? 14 : 12,
                minWidth: isMobile ? 64 : 56,
                padding: isMobile ? '10px 14px' : '6px 10px',
                borderRadius: isMobile ? 10 : undefined,
              }}
            >
              {t('SEND')}
            </button>
          </div>
        </ChatCard>
      </ChatContainer>
    </>
  );
};

export default Chat;
