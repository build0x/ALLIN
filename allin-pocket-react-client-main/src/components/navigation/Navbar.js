import React, { useEffect, useContext, useRef } from 'react';
import styled from 'styled-components';
import contentContext from '@/context/content/contentContext';
import socketContext from '@/context/websocket/socketContext';
import authContext from '@/context/auth/authContext';
import tableContext from '@/context/table/tableContext';
import { useNavigate } from 'react-router-dom';
import { getAvatarOption } from '@/utils/avatar';

export const LS_ENABLE_SOUNDS_STATE = 'LS_ENABLE_SOUNDS_STATE';

const BrandButton = styled.button`
  display: inline-flex;
  align-items: center;
  background: transparent;
  border: 0;
  color: #ffffff;
  padding: 0;
  margin-right: 14px;
  text-decoration: none;

  &:hover {
    color: #ffffff;
  }

  @media (max-width: 768px) {
    margin-right: 8px;
  }
`;

const BrandLogoImg = styled.img`
  height: 36px;
  width: auto;
  margin-right: 10px;
  object-fit: contain;
  @media (max-width: 768px) {
    height: 30px;
    margin-right: 6px;
  }
`;

const BrandText = styled.span`
  display: inline-flex;
  align-items: baseline;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.14em;
  line-height: 0.95;
  text-transform: uppercase;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.28);
  font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;

  @media (max-width: 768px) {
    font-size: 19px;
    letter-spacing: 0.1em;
  }
`;

const BrandAll = styled.span`
  color: #f8f8f8;
`;

const BrandIn = styled.span`
  color: #d4af37;
  text-shadow: 0 0 16px rgba(212, 175, 55, 0.22);
`;

const NavbarInner = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
`;

const RightActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
`;

const LoginActionWrap = styled.div`
  display: flex;
  align-items: center;

  @media (max-width: 768px) {
    margin: 0;
  }
`;

const WalletActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 7px 12px;
  border-radius: 14px;
  border: 1px solid
    ${({ $connected }) => ($connected ? 'rgba(245, 217, 120, 0.42)' : 'rgba(212, 175, 55, 0.28)')};
  background: ${({ $connected }) =>
    $connected
      ? 'linear-gradient(135deg, rgba(245, 217, 120, 0.16), rgba(212, 175, 55, 0.08))'
      : 'rgba(212, 175, 55, 0.08)'};
  color: #f5f5f5;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(245, 217, 120, 0.5);
    box-shadow: 0 10px 22px rgba(212, 175, 55, 0.16);
  }

  @media (max-width: 768px) {
    min-height: 34px;
    padding: 6px 10px;
    gap: 8px;
    border-radius: 12px;
  }
`;

const WalletActionIcon = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ $image, $themeBackground }) => {
    if ($image) {
      return 'rgba(255, 255, 255, 0.95)';
    }

    return $themeBackground;
  }};
  color: ${({ $themeColor }) => $themeColor || '#0d0d0d'};
  font-size: 16px;
  font-weight: 900;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid ${({ $themeRing }) => $themeRing || 'rgba(212, 175, 55, 0.24)'};

  @media (max-width: 768px) {
    width: 24px;
    height: 24px;
    font-size: 13px;
  }
`;

const WalletActionAvatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const WalletActionText = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
  min-width: 0;
`;

const WalletActionTitle = styled.span`
  color: ${({ $connected }) => ($connected ? '#f5d978' : '#ffffff')};
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
`;

const WalletActionMeta = styled.span`
  color: #cfcfcf;
  font-size: 10px;
  margin-top: 2px;
  white-space: nowrap;

  @media (max-width: 768px) {
    display: none;
  }
`;

const Navbar = () => {
  const contentCtx = useContext(contentContext) ?? {};
  const t = contentCtx.t ?? ((key) => key);
  const navigate = useNavigate();

  const socketCtx = useContext(socketContext) ?? {};
  const socket = socketCtx.socket ?? null;
  const authCtx = useContext(authContext) ?? {};
  const isAuthed = authCtx.isAuthed ?? false;
  const economyOverview = authCtx.economyOverview ?? null;
  const myDashboardData = authCtx.myDashboardData ?? null;

  const tableCtx = useContext(tableContext) ?? {};
  const tableId = tableCtx.tableId ?? -1;
  const setTableId = tableCtx.setTableId ?? (() => {});
  const setEnableSounds = tableCtx.setEnableSounds ?? (() => {});

  const tableIdRef = useRef(tableId);

  useEffect(() => {
    tableIdRef.current = tableId;
  }, [tableId, setTableId]);

  const getEnableSoundsFromLocalStorage = () => {
    const sounds = localStorage.getItem(LS_ENABLE_SOUNDS_STATE);
    if (sounds === null || sounds === 'undefined') {
      return true;
    }

    return sounds === 'true';
  };

  useEffect(() => {
    const initialSoundsState = getEnableSoundsFromLocalStorage();
    setEnableSounds(initialSoundsState);
  }, [setEnableSounds]);

  function leaveTable() {
    if (socket) {
      console.info('Leave table called from navbar');
      const data = JSON.stringify({
        key: 'leaveTable',
        tableId: tableId,
      });
      socket.send(data);
    }
  }

  const navigateGames = () => {
    if (tableIdRef.current > -1) {
      leaveTable();
    }
    setTableId(-1);
    navigate('/games');
  };

  const [logoError, setLogoError] = React.useState(false);
  const logoUrl = `${process.env.PUBLIC_URL || ''}/logo.png`;
  const walletAddress = economyOverview?.userWallet?.walletAddress || '';
  const avatarOption = getAvatarOption(myDashboardData?.userStats?.avatarIcon);
  const shortWallet =
    walletAddress && walletAddress.length > 12
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : walletAddress;

  return (
    <>
      <nav className="navbar navbar-expand-md navbar-dark custom-navbar">
        <NavbarInner>
          <BrandButton className="navbar-brand ms-2" type="button" onClick={navigateGames}>
            {!logoError && logoUrl ? (
              <BrandLogoImg
                src={logoUrl}
                alt="ALLIN"
                onError={() => setLogoError(true)}
              />
            ) : null}
            <BrandText>
              <BrandAll>ALL</BrandAll>
              <BrandIn>IN</BrandIn>
            </BrandText>
          </BrandButton>

          <RightActions>
            <LoginActionWrap className="d-flex mt-1 my-md-0 me-2">
              {!isAuthed ? (
                <WalletActionButton type="button" onClick={() => navigate('/login')}>
                  <WalletActionIcon>♦</WalletActionIcon>
                  <WalletActionText>
                    <WalletActionTitle>{t('LOGIN') || '连接钱包'}</WalletActionTitle>
                    <WalletActionMeta>连接钱包后开始游戏</WalletActionMeta>
                  </WalletActionText>
                </WalletActionButton>
              ) : (
                <WalletActionButton type="button" $connected onClick={() => navigate('/account')}>
                  <WalletActionIcon
                    $image={avatarOption?.type === 'image'}
                    $themeBackground={avatarOption?.theme?.background}
                    $themeColor={avatarOption?.theme?.color}
                    $themeRing={avatarOption?.theme?.ring}
                  >
                    {avatarOption?.type === 'image' ? (
                      <WalletActionAvatar src={avatarOption.src} alt={avatarOption.label} />
                    ) : (
                      avatarOption?.text || '♠'
                    )}
                  </WalletActionIcon>
                  <WalletActionText>
                    <WalletActionTitle $connected>
                      {t('MY_ACCOUNT') || '我的账户'}
                    </WalletActionTitle>
                    <WalletActionMeta>{shortWallet || '钱包已连接'}</WalletActionMeta>
                  </WalletActionText>
                </WalletActionButton>
              )}
            </LoginActionWrap>
          </RightActions>
        </NavbarInner>
      </nav>
    </>
  );
};

export default Navbar;
