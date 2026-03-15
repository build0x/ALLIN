import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import adminContext from '@/admin/adminContext';
import { connectWallet, getAvailableWallets } from '@/utils/wallet';

const cardStyle = {
  width: '100%',
  maxWidth: '520px',
  padding: '28px',
  borderRadius: '18px',
  border: '1px solid rgba(212,175,55,0.28)',
  background: 'linear-gradient(180deg, rgba(22,22,22,0.97) 0%, rgba(8,8,8,0.97) 100%)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
};

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { requestNonce, verifyWalletLogin, isAdminAuthed } = useContext(adminContext);
  const [busyWallet, setBusyWallet] = useState('');
  const wallets = useMemo(() => getAvailableWallets(), []);

  useEffect(() => {
    if (isAdminAuthed) {
      navigate('/admin/dashboard');
    }
  }, [isAdminAuthed, navigate]);

  const handleLogin = async (walletId) => {
    try {
      setBusyWallet(walletId);
      const walletConnection = await connectWallet(walletId);
      const noncePayload = await requestNonce(walletConnection.address);
      const signature = await walletConnection.signer.signMessage(noncePayload.message);
      await verifyWalletLogin({
        walletAddress: walletConnection.address,
        signature,
      });
      navigate('/admin/dashboard');
    } catch (error) {
      toast.error(error.message || '管理员登录失败');
    } finally {
      setBusyWallet('');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        color: '#f5f5f5',
        padding: '24px',
      }}
    >
      <div style={cardStyle}>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 900,
            letterSpacing: '0.12em',
          }}
        >
          ALLIN 后台
        </div>
        <div style={{ marginTop: '8px', color: '#cccccc', lineHeight: 1.6 }}>
          使用管理员白名单钱包登录，仅支持 BSC 主网。未加入白名单的钱包无法进入后台。
        </div>
        <div style={{ marginTop: '24px', display: 'grid', gap: '12px' }}>
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              className="btn btn-outline-warning"
              disabled={!wallet.provider || busyWallet === wallet.id}
              onClick={() => handleLogin(wallet.id)}
              style={{ padding: '12px 16px', textAlign: 'left' }}
            >
              {busyWallet === wallet.id ? '连接中...' : `使用 ${wallet.name} 登录（自动切换 BSC）`}
              {!wallet.provider ? '（未检测到）' : ''}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '20px', color: '#8f8f8f', fontSize: '13px', lineHeight: 1.7 }}>
          后台地址默认通过 `ADMIN_WALLETS` 白名单控制。
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
