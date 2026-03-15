import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import contentContext from '@/context/content/contentContext';
import socketContext from '@/context/websocket/socketContext';
import authContext from '@/context/auth/authContext';
import { LS_TOKEN, LS_WALLET_ADDRESS } from '@/context/auth/AuthState';
import { connectWallet, getAvailableWallets } from '@/utils/wallet';

// 与大厅同款黑色背景 + 金色光晕
const floatParticle = keyframes`
  0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.15; }
  25% { transform: translate(8px, -12px) rotate(5deg); opacity: 0.25; }
  50% { transform: translate(-6px, -20px) rotate(-3deg); opacity: 0.2; }
  75% { transform: translate(10px, -8px) rotate(2deg); opacity: 0.22; }
`;

const breatheGlow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 12px rgba(212, 175, 55, 0.35)); }
  50% { filter: drop-shadow(0 0 28px rgba(212, 175, 55, 0.55)); }
`;

const PageShell = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px 16px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212, 175, 55, 0.12), transparent 50%),
    radial-gradient(circle at 20% 80%, rgba(212, 175, 55, 0.08), transparent 35%),
    radial-gradient(circle at 80% 70%, rgba(212, 175, 55, 0.06), transparent 35%),
    linear-gradient(145deg, #0d0d0d 0%, #080808 100%);
`;

const Particle = styled.div`
  position: absolute;
  width: 24px;
  height: 32px;
  font-size: 22px;
  opacity: 0.15;
  pointer-events: none;
  animation: ${floatParticle} 8s ease-in-out infinite;
  animation-delay: ${(props) => props.$delay || 0}s;
  left: ${(props) => props.$left ?? '10%'};
  top: ${(props) => props.$top ?? '20%'};
`;

const LoginCard = styled.section`
  width: min(100%, 440px);
  padding: 48px 32px 36px;
  text-align: center;
  position: relative;
  z-index: 1;
  border-radius: 24px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  background: linear-gradient(
    145deg,
    rgba(23, 23, 23, 0.85) 0%,
    rgba(12, 12, 12, 0.9) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 0 0 1px rgba(212, 175, 55, 0.1),
    0 24px 64px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);

  @media (max-width: 768px) {
    padding: 40px 24px 32px;
    border-radius: 20px;
  }
`;

const BrandLogo = styled.img`
  display: block;
  width: 88px;
  height: 88px;
  margin: 0 auto 16px;
  object-fit: contain;
  animation: ${breatheGlow} 2.5s ease-in-out infinite;
  filter: drop-shadow(0 0 16px rgba(212, 175, 55, 0.4));

  @media (max-width: 768px) {
    width: 72px;
    height: 72px;
  }
`;

const BrandLogoFallback = styled.div`
  width: 88px;
  height: 88px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, #f5d978 0%, #d4af37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${breatheGlow} 2.5s ease-in-out infinite;

  @media (max-width: 768px) {
    width: 72px;
    height: 72px;
    font-size: 1.5rem;
  }
`;

const BrandTitle = styled.h1`
  margin: 0 0 8px;
  font-size: 1.85rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  background: linear-gradient(135deg, #f5d978 0%, #d4af37 48%, #b8960f 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const Subtitle = styled.p`
  margin: 0 0 32px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.95rem;
  letter-spacing: 0.06em;
`;

const WalletRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-bottom: 20px;
`;

const WalletBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 120px;
  padding: 14px 20px;
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 14px;
  background: rgba(212, 175, 55, 0.08);
  color: #e8e8e8;
  font-size: 0.95rem;
  font-weight: 700;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(212, 175, 55, 0.18);
    border-color: rgba(212, 175, 55, 0.55);
    box-shadow: 0 0 20px rgba(212, 175, 55, 0.25);
    color: #f5d978;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ConnectPrimaryBtn = styled.button`
  width: 100%;
  padding: 16px 24px;
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 14px;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0d0d0d;
  background: linear-gradient(135deg, #f5d978 0%, #d4af37 55%, #8f6b14 100%);
  box-shadow: 0 8px 24px rgba(212, 175, 55, 0.28);
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 32px rgba(212, 175, 55, 0.35);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LiveDataStrip = styled.div`
  margin-top: 24px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(212, 175, 55, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
`;

const StatusText = styled.p`
  min-height: 22px;
  margin: 14px 0 0;
  color: ${(props) => (props.$warning ? '#ffb86b' : 'rgba(255, 255, 255, 0.65)')};
  font-size: 0.84rem;
`;

const SupportText = styled.p`
  margin: 12px 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
`;

const FooterWrap = styled.footer`
  margin-top: auto;
  padding-top: 32px;
  width: 100%;
  max-width: 440px;
  text-align: center;
  position: relative;
  z-index: 1;
`;

const ChainBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(212, 175, 55, 0.25);
  background: rgba(212, 175, 55, 0.06);
  color: #d4af37;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
`;

const FooterLinks = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.8rem;

  a {
    color: rgba(212, 175, 55, 0.8);
    text-decoration: none;
  }
  a:hover {
    color: #d4af37;
  }
`;

const WalletLoginPage = () => {
  const navigate = useNavigate();
  const { t } = useContext(contentContext);
  const { socket } = useContext(socketContext);
  const { setIsLoggedIn, isAuthed } = useContext(authContext);
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState(null);
  const [wallets, setWallets] = useState(() => getAvailableWallets());
  const [publicStats, setPublicStats] = useState({ prizePoolBnb: null, onlineCount: null, tournamentReg: null });
  const [logoError, setLogoError] = useState(false);
  const pendingWalletRef = useRef(null);

  useEffect(() => {
    const syncWallets = () => setWallets(getAvailableWallets());
    syncWallets();
    window.addEventListener('focus', syncWallets);
    return () => window.removeEventListener('focus', syncWallets);
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }
    socket.handle('walletNonce', (jsonData) => walletNonceResult(jsonData.data));
    socket.handle('walletLogin', (jsonData) => loginResult(jsonData.data));
    socket.handle('authenticationError', (jsonData) => console.log(jsonData.data));
    socket.handle('publicLobbyStats', (jsonData) => {
      const d = jsonData?.data || {};
      setPublicStats({
        prizePoolBnb: d.prizePoolBnb,
        onlineCount: d.totalPlayers,
        totalGames: d.totalGames,
      });
    });
    return undefined;
  }, [socket]);

  useEffect(() => {
    if (socket) {
      socket.send(JSON.stringify({ key: 'getPublicLobbyStats' }));
    }
  }, [socket]);

  useEffect(() => {
    if (isAuthed) {
      navigate('/games', { replace: true });
    }
  }, [isAuthed, navigate]);

  const primaryWallet = useMemo(() => wallets.find((w) => w.provider) || null, [wallets]);
  const availableWallets = useMemo(() => wallets.filter((w) => w.provider), [wallets]);

  const statusText = !socket
    ? '正在连接服务器...'
    : !primaryWallet
      ? '未检测到钱包插件，请先安装 MetaMask、OKX 或币安钱包。'
      : `已检测到 ${primaryWallet.name}，连接时会自动切换到 BSC 主网`;

  function loginResult(data) {
    if (data.success) {
      localStorage.setItem(LS_TOKEN, data.token);
      if (data.walletAddress) {
        localStorage.setItem(LS_WALLET_ADDRESS, data.walletAddress);
      }
      setIsLoggedIn({ token: data.token, walletAddress: data.walletAddress });
      pendingWalletRef.current = null;
      setLoading(false);
      setConnectingId(null);
      toast.success('钱包登录成功');
      navigate('/games', { replace: true });
      return;
    }
    setLoading(false);
    setConnectingId(null);
    toast.error(t(data.translationKey) || data.message || '登录失败');
  }

  async function walletNonceResult(data) {
    if (!data.success) {
      setLoading(false);
      setConnectingId(null);
      toast.error(t(data.translationKey) || data.message || '获取签名消息失败');
      return;
    }
    try {
      const pendingWallet = pendingWalletRef.current;
      if (!pendingWallet?.signer) {
        throw new Error('WALLET_SIGNER_NOT_READY');
      }
      const signature = await pendingWallet.signer.signMessage(data.signatureMessage);
      socket.send(
        JSON.stringify({
          key: 'walletLogin',
          walletAddress: pendingWallet.address,
          signature,
        })
      );
    } catch (error) {
      setLoading(false);
      setConnectingId(null);
      toast.error('签名已取消或失败');
    }
  }

  async function handleConnect(walletId) {
    if (!socket) {
      toast.error('连接尚未就绪');
      return;
    }
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet?.provider) {
      toast.error('未检测到该钱包插件');
      return;
    }
    try {
      setLoading(true);
      setConnectingId(walletId);
      const walletConnection = await connectWallet(walletId);
      pendingWalletRef.current = walletConnection;
      socket.send(
        JSON.stringify({
          key: 'walletNonce',
          walletAddress: walletConnection.address,
        })
      );
    } catch (error) {
      setLoading(false);
      setConnectingId(null);
      toast.error(t(error.message) || '钱包连接失败');
    }
  }

  const liveDataLabel = [
    publicStats.prizePoolBnb != null && `🔥 ${Number(publicStats.prizePoolBnb).toFixed(2)} BNB 奖池`,
    publicStats.onlineCount != null && `👥 ${publicStats.onlineCount} 人在线`,
    publicStats.totalGames != null && publicStats.totalGames > 0 && `🎮 ${publicStats.totalGames} 活跃牌桌`,
  ]
    .filter(Boolean)
    .join(' · ');
  const showLiveStrip = liveDataLabel.length > 0;

  return (
    <PageShell>
      {/* 微光粒子 */}
      <Particle $left="12%" $top="18%" $delay="0">🃏</Particle>
      <Particle $left="85%" $top="25%" $delay="1.5">♠</Particle>
      <Particle $left="8%" $top="65%" $delay="3">♥</Particle>
      <Particle $left="88%" $top="70%" $delay="2">♦</Particle>
      <Particle $left="50%" $top="12%" $delay="0.5">♣</Particle>

      <LoginCard>
        {logoError ? (
          <BrandLogoFallback>ALLIN</BrandLogoFallback>
        ) : (
          <BrandLogo
            src={`${process.env.PUBLIC_URL || ''}/logo.png`}
            alt="ALLIN"
            onError={() => setLogoError(true)}
          />
        )}
        <BrandTitle>ALLIN 德州扑克</BrandTitle>
        <Subtitle>连接钱包进入大厅 · 仅支持 BSC 主网</Subtitle>

        {availableWallets.length > 0 ? (
          <WalletRow>
            {availableWallets.map((w) => (
              <WalletBtn
                key={w.id}
                type="button"
                onClick={() => handleConnect(w.id)}
                disabled={loading || connectingId !== null}
              >
                <span>{w.id === 'metamask' ? '🦊' : w.id === 'okx' ? '🔶' : '🔷'}</span>
                {w.name}
              </WalletBtn>
            ))}
          </WalletRow>
        ) : (
          <ConnectPrimaryBtn
            type="button"
            onClick={() => primaryWallet && handleConnect(primaryWallet.id)}
            disabled={loading || !socket || !primaryWallet}
          >
            {loading ? '连接中...' : '🔗 连接钱包'}
          </ConnectPrimaryBtn>
        )}

        <StatusText $warning={!socket || !primaryWallet}>{statusText}</StatusText>
        <SupportText>支持 MetaMask / OKX / 币安 Web3 钱包</SupportText>

        {showLiveStrip && (
          <LiveDataStrip>{liveDataLabel}</LiveDataStrip>
        )}
      </LoginCard>

      <FooterWrap>
        <ChainBadge>🔗 BNB Smart Chain (BSC)</ChainBadge>
        <FooterLinks>
          <a href="https://bscscan.com" target="_blank" rel="noopener noreferrer">
            BscScan
          </a>
          <span>·</span>
          <a href="https://www.binance.org" target="_blank" rel="noopener noreferrer">
            BNB Chain
          </a>
        </FooterLinks>
      </FooterWrap>
    </PageShell>
  );
};

export default WalletLoginPage;
