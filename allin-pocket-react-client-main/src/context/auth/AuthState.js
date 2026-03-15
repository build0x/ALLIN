import React, { useState, useEffect, useContext, useRef } from 'react';
import { toast } from 'react-toastify';
import AuthContext from './authContext';
import socketContext from '@/context/websocket/socketContext';
import contentContext from '@/context/content/contentContext';
import { clearWalletSession, restoreWalletSession, LS_CONNECTED_WALLET_ID } from '@/utils/wallet';

export const LS_TOKEN = 'TOKEN';
export const LS_WALLET_ADDRESS = 'WALLET_ADDRESS';

const AuthState = ({ children }) => {
  const { socket } = useContext(socketContext);
  const { t } = useContext(contentContext);

  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [myDashboardRefresh, setMyDashboardDataRefresh] = useState(null);
  const [myDashboardData, setMyDashboardData] = useState(null);
  const [xpNeededForNextMedal, setXpNeededForNextMedal] = useState(null);
  const [economyOverview, setEconomyOverview] = useState(null);
  const [tournamentList, setTournamentList] = useState([]);
  const [walletSession, setWalletSession] = useState(null);

  const isLoggedInRef = useRef(false);
  const pendingOnchainSyncRef = useRef(null);
  const pendingConfirmDepositRef = useRef(null);
  const registerTournamentOnCompleteRef = useRef(null);
  /** 最近一次由兑换/换回更新的时间；用于避免晚到的 getEconomyOverview 响应覆盖刚刷新的余额 */
  const lastCashierWalletUpdateAtRef = useRef(0);
  const CASHIER_UPDATE_GRACE_MS = 3000;

  useEffect(() => {
    const token = localStorage.getItem(LS_TOKEN);
    if (token) {
      if (socket) {
        socket.send(
          JSON.stringify({
            key: 'userParams',
            token: token,
          })
        );
      }
    }
  }, [socket]);

  useEffect(() => {
    if (socket) {
      regAuthHandler(socket);
    }
  }, [socket]);

  useEffect(() => {
    if (!isAuthed) {
      setWalletSession(null);
      return;
    }

    restorePersistedWalletSession();
  }, [isAuthed]);

  const regAuthHandler = (socket) => {
    socket.handle('userParams', userParams);
    socket.handle('userStatistics', (jsonData) => userStatisticsResults(jsonData.data));
    socket.handle('economyOverview', (jsonData) => {
      const nextEconomy = jsonData.data.economy || null;
      setEconomyOverview((prev) => {
        if (!nextEconomy || !prev?.userWallet) return nextEconomy;
        const recentlyUpdatedFromCashier =
          Date.now() - lastCashierWalletUpdateAtRef.current < CASHIER_UPDATE_GRACE_MS;
        if (recentlyUpdatedFromCashier) {
          return { ...nextEconomy, userWallet: prev.userWallet };
        }
        return nextEconomy;
      });
    });
    socket.handle('syncOnchainState', (jsonData) => syncOnchainStateResult(jsonData.data));
    socket.handle('confirmDeposit', (jsonData) => confirmDepositResult(jsonData.data));
    socket.handle('tournamentList', (jsonData) =>
      setTournamentList(jsonData.data.tournaments || [])
    );
    socket.handle('createCashTierTable', (jsonData) => createCashTierTableResult(jsonData.data));
    socket.handle('registerTournament', (jsonData) => registerTournamentResult(jsonData.data));
    // 兑换/换回成功后立即用返回的 wallet 更新资产，保证大厅和账户页的筹码、钱包 ALLIN 实时刷新
    socket.handle('exchangeAllinToChips', (jsonData) => {
      const data = jsonData.data;
      if (data?.success && data?.wallet) {
        lastCashierWalletUpdateAtRef.current = Date.now();
        setEconomyOverview((prev) => (prev ? { ...prev, userWallet: data.wallet } : null));
      }
    });
    socket.handle('redeemChipsToAllin', (jsonData) => {
      const data = jsonData.data;
      if (data?.success && data?.wallet) {
        lastCashierWalletUpdateAtRef.current = Date.now();
        setEconomyOverview((prev) => (prev ? { ...prev, userWallet: data.wallet } : null));
      }
    });
  };

  useEffect(() => {
    if (isLoggedIn) {
      isLoggedInRef.current = true;
      setLoggedInUserParams(isLoggedIn);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isAuthed) {
      getLoggedInUserStatistics();
      getEconomyOverviewRequest();
      getTournamentListRequest();
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      getTournamentListRequest();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthed, socket]);

  useEffect(() => {
    if (!isAuthed) {
      return;
    }

    getLoggedInUserStatistics();
    getEconomyOverviewRequest();
  }, [myDashboardRefresh]);

  function setLoggedInUserParams(isLoggedIn) {
    const token = isLoggedIn.token;
    localStorage.setItem(LS_TOKEN, token);
    if (isLoggedIn.walletAddress) {
      localStorage.setItem(LS_WALLET_ADDRESS, isLoggedIn.walletAddress);
    }
    if (socket) {
      socket.send(
        JSON.stringify({
          key: 'userParams',
          token: token,
        })
      );
    }
  }

  async function restorePersistedWalletSession() {
    try {
      const session = await restoreWalletSession();
      setWalletSession(
        session
          ? {
              walletId: session.wallet?.id,
              walletName: session.wallet?.name,
              address: session.address,
            }
          : null
      );
      if (session?.address) {
        localStorage.setItem(LS_WALLET_ADDRESS, session.address);
      }
    } catch (error) {
      setWalletSession(null);
    }
  }

  function userParams(jsonData) {
    const lData = jsonData.data;
    if (!lData.success) {
      localStorage.removeItem(LS_TOKEN);
      setIsLoggedIn(null);
      setIsAuthed(false);
      setMyDashboardData(null);
      setEconomyOverview(null);
      setTournamentList([]);
      setWalletSession(null);
      toast.error('你的账号已在其他设备登录，当前连接已被禁止。');
    } else {
      setIsAuthed(true);
    }
  }

  function getLoggedInUserStatistics() {
    const token = localStorage.getItem(LS_TOKEN);
    if (socket && isAuthed && token) {
      const data = JSON.stringify({
        key: 'userStatistics',
        token: token,
      });
      socket.send(data);
    }
  }

  function userStatisticsResults(uData) {
    setMyDashboardData(uData);
  }

  function updateMyDashboardUserStats(nextUserStats) {
    if (!nextUserStats) {
      return;
    }

    setMyDashboardData((prev) => {
      if (!prev) {
        return {
          success: true,
          userStats: nextUserStats,
        };
      }

      return {
        ...prev,
        userStats: {
          ...(prev.userStats || {}),
          ...nextUserStats,
        },
      };
    });
  }

  function getEconomyOverviewRequest() {
    const token = localStorage.getItem(LS_TOKEN);
    if (socket && isAuthed && token) {
      socket.send(
        JSON.stringify({
          key: 'getEconomyOverview',
          token,
        })
      );
    }
  }

  function getTournamentListRequest() {
    const token = localStorage.getItem(LS_TOKEN);
    if (socket && isAuthed && token) {
      socket.send(
        JSON.stringify({
          key: 'getTournamentList',
          token,
        })
      );
    }
  }

  function syncOnchainStateRequest() {
    const token = localStorage.getItem(LS_TOKEN);
    if (!socket || !isAuthed || !token) {
      return Promise.reject(new Error('连接尚未就绪'));
    }

    return new Promise((resolve, reject) => {
      pendingOnchainSyncRef.current = { resolve, reject };
      socket.send(
        JSON.stringify({
          key: 'syncOnchainState',
          token,
        })
      );
    });
  }

  function syncOnchainStateResult(data) {
    if (data?.economy) {
      setEconomyOverview(data.economy);
    }

    if (!pendingOnchainSyncRef.current) {
      return;
    }

    const pending = pendingOnchainSyncRef.current;
    pendingOnchainSyncRef.current = null;

    if (data?.success) {
      pending.resolve(data);
      return;
    }

    pending.reject(new Error(data?.message || '链上同步失败'));
  }

  function confirmDepositRequest(txHash) {
    const token = localStorage.getItem(LS_TOKEN);
    if (!socket || !isAuthed || !token) {
      return Promise.reject(new Error('连接尚未就绪'));
    }
    return new Promise((resolve, reject) => {
      pendingConfirmDepositRef.current = { resolve, reject };
      socket.send(
        JSON.stringify({
          key: 'confirmDeposit',
          token,
          txHash,
        })
      );
    });
  }

  function confirmDepositResult(data) {
    if (data?.economy) {
      setEconomyOverview(data.economy);
    }
    if (!pendingConfirmDepositRef.current) {
      return;
    }
    const pending = pendingConfirmDepositRef.current;
    pendingConfirmDepositRef.current = null;
    if (data?.success) {
      pending.resolve(data);
      return;
    }
    pending.reject(new Error(data?.message || '充值确认失败'));
  }

  /** 兑换/提现成功后立即用返回的 wallet 更新资产展示，无需等刷新 */
  function updateEconomyUserWallet(wallet) {
    if (!wallet) return;
    lastCashierWalletUpdateAtRef.current = Date.now();
    setEconomyOverview((prev) => (prev ? { ...prev, userWallet: wallet } : null));
  }

  function registerTournament(tournamentId, options) {
    registerTournamentOnCompleteRef.current = options?.onComplete ?? null;
    const token = localStorage.getItem(LS_TOKEN);
    if (socket && isAuthed && token) {
      socket.send(
        JSON.stringify({
          key: 'registerTournament',
          token,
          tournamentId,
          txHash: options?.txHash ?? undefined,
        })
      );
    }
  }

  function createCashTierTable(tierCode) {
    const token = localStorage.getItem(LS_TOKEN);
    if (socket && isAuthed && token) {
      socket.send(
        JSON.stringify({
          key: 'createCashTierTable',
          token,
          tierCode,
        })
      );
    }
  }

  function createCashTierTableResult(data) {
    if (!data.success) {
      toast.error(t(data.translationKey) || data.message || '创建房间失败');
      return;
    }

    getEconomyOverviewRequest();
    getLoggedInUserStatistics();
    toast.success('已按档位创建房间');
  }

  function registerTournamentResult(data) {
    const onComplete = registerTournamentOnCompleteRef.current;
    registerTournamentOnCompleteRef.current = null;
    if (!data.success) {
      toast.error(t(data.translationKey) || data.message || '赛事报名失败');
      onComplete?.();
      return;
    }
    setEconomyOverview(data.economy || null);
    toast.success('报名成功');
    getTournamentListRequest();
    getLoggedInUserStatistics();
    onComplete?.();
  }

  function logout() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_WALLET_ADDRESS);
    localStorage.removeItem(LS_CONNECTED_WALLET_ID);
    clearWalletSession();
    setIsLoggedIn(null);
    setIsAuthed(false);
    setMyDashboardData(null);
    setEconomyOverview(null);
    setTournamentList([]);
    setWalletSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        isAuthed,
        setIsAuthed,
        myDashboardData,
        myDashboardRefresh,
        setMyDashboardDataRefresh,
        updateMyDashboardUserStats,
        xpNeededForNextMedal,
        setXpNeededForNextMedal,
        economyOverview,
        tournamentList,
        walletSession,
        refreshWalletSession: restorePersistedWalletSession,
        refreshEconomyOverview: getEconomyOverviewRequest,
        updateEconomyUserWallet,
        syncOnchainState: syncOnchainStateRequest,
        confirmDeposit: confirmDepositRequest,
        refreshTournamentList: getTournamentListRequest,
        registerTournament,
        createCashTierTable,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthState;
