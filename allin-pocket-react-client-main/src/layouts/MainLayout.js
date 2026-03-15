import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import Navbar from '@/components/navigation/Navbar';
import socketContext from '@/context/websocket/socketContext';

const StyledNoSocketWarn = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'isWsConnected',
})`
  background-color: #d9534f;
  text-align: center;
  color: white;
  font-size: 20px;
  padding-bottom: 4px;

  height: ${(props) => (props.isWsConnected ? '0' : 'auto')};
  visibility: ${(props) => (props.isWsConnected ? 'collapse' : 'visible')};
`;

const isGameTablePath = (pathname) =>
  pathname === '/holdem' || pathname === '/fivecarddraw' || pathname === '/bottlespin';

const MainLayout = ({ children }) => {
  const { pathname } = useLocation();
  const socketContextValue = useContext(socketContext);
  const socket = socketContextValue?.socket ?? null;
  const reconnect = socketContextValue?.reconnect ?? (() => {});
  const hideNavbar = isGameTablePath(pathname);

  return (
    <div id="layout-wrapper">
      {!hideNavbar && <Navbar className="blur-target" />}
      <StyledNoSocketWarn isWsConnected={socket != null} onClick={() => reconnect()} role="button">
        No connection, click here to try again
      </StyledNoSocketWarn>
      <main className="blur-target">{children}</main>
    </div>
  );
};

export default MainLayout;
