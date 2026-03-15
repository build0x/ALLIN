import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import GlobalState from './global/GlobalState';
import LocaProvider from './localization/LocaProvider';
import ContentProvider from './content/ContentProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ModalProvider from './modal/ModalProvider';
import WebSocketProvider from './websocket/WebsocketProvider';
import AuthState from './auth/AuthState';
import GameState from './game/GameState';
import TableState from '@/context/table/TableState';
import AdminState from '@/admin/AdminState';

const Providers = ({ children }) => (
  <BrowserRouter>
    <GlobalState>
      <LocaProvider>
        <ContentProvider>
          <ToastContainer style={{ position: 'fixed', zIndex: 99999 }} />
          <ModalProvider>
            <WebSocketProvider>
              <AuthState>
                <AdminState>
                  <GameState>
                    <TableState>{children}</TableState>
                  </GameState>
                </AdminState>
              </AuthState>
            </WebSocketProvider>
          </ModalProvider>
        </ContentProvider>
      </LocaProvider>
    </GlobalState>
  </BrowserRouter>
);

export default Providers;
