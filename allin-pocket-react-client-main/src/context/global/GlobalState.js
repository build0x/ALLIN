import React, { useState } from 'react';
import GlobalContext from './globalContext';
import { parserCardStyle } from '@/utils/CardRes';

const LS_USE_BLACK_CARDS = 'LS_USE_BLACK_CARDS';

const cards_style = localStorage.getItem(LS_USE_BLACK_CARDS);

const GlobalState = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [cardStyle, setCardStyle] = useState(parserCardStyle(cards_style));
  const [openChatTrigger, setOpenChatTrigger] = useState(0);
  const [openSettingsTrigger, setOpenSettingsTrigger] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const requestOpenChat = () => {
    setOpenChatTrigger((n) => n + 1);
    setUnreadChatCount(0);
  };

  const requestOpenSettings = () => {
    setOpenSettingsTrigger((n) => n + 1);
  };

  return (
    <GlobalContext.Provider
      value={{
        isLoading,
        setIsLoading,
        cardStyle,
        setCardStyle,
        openChatTrigger,
        requestOpenChat,
        openSettingsTrigger,
        requestOpenSettings,
        unreadChatCount,
        setUnreadChatCount,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export default GlobalState;
