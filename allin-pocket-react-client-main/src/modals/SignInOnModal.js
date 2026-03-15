import React, { useEffect, useContext, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import contentContext from '@/context/content/contentContext';
import { LS_TOKEN, LS_WALLET_ADDRESS } from '@/context/auth/AuthState';
import { connectWallet, getAvailableWallets } from '@/utils/wallet';

const WalletPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 4px;
`;

const WalletButton = styled.button`
  width: 100%;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 14px;
  background: linear-gradient(145deg, #171717 0%, #101010 100%);
  color: #f5f5f5;
  text-align: left;
  padding: 14px 16px;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const SignInOnModal = ({ mode, context, closeModal }) => {
  const { t } = useContext(contentContext);
  const { socketCtx, authCtx } = context;
  const { socket } = socketCtx;
  const { setIsLoggedIn } = authCtx;
  const [loadingWalletId, setLoadingWalletId] = useState('');
  const pendingWalletRef = useRef(null);

  const regAuthHandler = (socket) => {
    socket.handle('walletNonce', (jsonData) => walletNonceResult(jsonData.data));
    socket.handle('walletLogin', (jsonData) => loginResult(jsonData.data));
    socket.handle('authenticationError', (jsonData) => console.log(jsonData.data));
  };

  useEffect(() => {
    if (socket) {
      regAuthHandler(socket);
    }
  }, [socket]);

  function loginResult(lData) {
    if (lData.success) {
      toast.success('钱包登录成功');
      localStorage.setItem(LS_TOKEN, lData.token);
      if (lData.walletAddress) {
        localStorage.setItem(LS_WALLET_ADDRESS, lData.walletAddress);
      }
      setIsLoggedIn({
        token: lData.token,
        walletAddress: lData.walletAddress,
      });
      setLoadingWalletId('');
      pendingWalletRef.current = null;
      closeModal();
    } else {
      setLoadingWalletId('');
      toast.error(t(lData.translationKey) || lData.message || '登录失败');
    }
  }

  async function walletNonceResult(data) {
    if (!data.success) {
      setLoadingWalletId('');
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
      setLoadingWalletId('');
      toast.error('签名已取消或失败');
    }
  }

  async function connectAndLogin(walletId) {
    if (!socket) {
      toast.error('连接尚未就绪');
      return;
    }

    try {
      setLoadingWalletId(walletId);
      const walletConnection = await connectWallet(walletId);
      pendingWalletRef.current = walletConnection;
      socket.send(
        JSON.stringify({
          key: 'walletNonce',
          walletAddress: walletConnection.address,
        })
      );
    } catch (error) {
      setLoadingWalletId('');
      toast.error(t(error.message) || '钱包连接失败');
    }
  }

  return (
    <WalletPanel>
      <div style={{ color: '#f5f5f5', fontSize: '14px', lineHeight: 1.6 }}>
        仅支持 BSC 主网登录。连接时会自动请求切换到 BSC，签名仅用于身份验证，不会触发链上转账。
      </div>
      {getAvailableWallets().map((wallet) => (
        <WalletButton
          key={wallet.id}
          type="button"
          onClick={() => connectAndLogin(wallet.id)}
          disabled={!wallet.provider || Boolean(loadingWalletId)}
        >
          <div style={{ fontWeight: 700, color: '#d4af37' }}>{wallet.name}</div>
          <div style={{ fontSize: '12px', opacity: 0.85 }}>
            {!wallet.provider
              ? '未检测到插件'
              : loadingWalletId === wallet.id
                ? '正在连接并请求签名...'
                : '点击连接钱包，自动切换到 BSC'}
          </div>
        </WalletButton>
      ))}
    </WalletPanel>
  );
};

export default SignInOnModal;

