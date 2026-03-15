import React, { useContext, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socketContext from '@/context/websocket/socketContext';
import authContext from '@/context/auth/authContext';
import { formatMoney } from '@/utils/Money';
import StatsChart from '@/components/StatsChart';
import { LS_TOKEN } from '@/context/auth/AuthState';
import { toast } from 'react-toastify';
import Achievements from '@/components/Achievements';
import {
  AVATAR_OPTIONS,
  AVATAR_THEMES,
  DEFAULT_AVATAR_ID,
  DEFAULT_AVATAR_THEME_ID,
  getAvatarOption,
  parseAvatarSelection,
  serializeAvatarSelection,
} from '@/utils/avatar';
import {
  depositAllinToTreasury,
  getFriendlyWalletErrorMessage,
  LS_CONNECTED_WALLET_ID,
} from '@/utils/wallet';

const PageWrap = styled.div`
  max-width: 980px;
  padding-top: 18px;
  padding-bottom: 28px;
`;

const GoldCard = styled.div`
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.14), transparent 35%),
    linear-gradient(160deg, #1a1a1a 0%, #121212 100%);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 22px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
`;

const SectionCard = styled(GoldCard)`
  padding: 22px;

  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 18px;
  }
`;

const HeroCard = styled(GoldCard)`
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 18px;

  @media (max-width: 768px) {
    padding: 18px;
    flex-direction: column;
    align-items: flex-start;
  }
`;

const AvatarFrame = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $image, $themeBackground }) => {
    if ($image) {
      return 'rgba(255, 255, 255, 0.95)';
    }

    return $themeBackground;
  }};
  color: ${({ $themeColor }) => $themeColor || '#0d0d0d'};
  font-size: 38px;
  font-weight: 800;
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.28),
    0 0 0 1px ${({ $themeRing }) => $themeRing || 'rgba(212, 175, 55, 0.18)'};
  overflow: hidden;
  border: 1px solid ${({ $themeRing }) => $themeRing || 'rgba(212, 175, 55, 0.18)'};

  @media (max-width: 768px) {
    width: 88px;
    height: 88px;
    border-radius: 24px;
    font-size: 34px;
  }
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const HeroInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const HeroTitle = styled.div`
  color: #ffffff;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.15;
`;

const HeroSubline = styled.div`
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: #d6d6d6;
  font-size: 14px;
`;

const WalletText = styled.span`
  color: #f5f5f5;
  word-break: break-all;
`;

const MiniButton = styled.button`
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.08);
  color: #d4af37;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
`;

const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
`;

const ProfileEditorCard = styled(GoldCard)`
  margin-top: 14px;
  padding: 18px;
`;

const EditorTitle = styled.div`
  color: #d4af37;
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 14px;
`;

const AvatarPickerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const AvatarOptionButton = styled.button`
  min-height: 78px;
  border-radius: 18px;
  border: 1px solid
    ${({ $active }) => ($active ? 'rgba(245, 217, 120, 0.55)' : 'rgba(212, 175, 55, 0.16)')};
  background: ${({ $active }) =>
    $active
      ? 'linear-gradient(135deg, rgba(245, 217, 120, 0.22), rgba(212, 175, 55, 0.1))'
      : 'rgba(255,255,255,0.03)'};
  color: #f5f5f5;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
`;

const AvatarOptionImage = styled.img`
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 12px;
  display: block;
`;

const AvatarThemeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const AvatarThemeButton = styled.button`
  min-height: 56px;
  border-radius: 16px;
  border: 1px solid ${({ $active, $ring }) => ($active ? $ring : 'rgba(212, 175, 55, 0.16)')};
  background: rgba(255, 255, 255, 0.03);
  color: #f5f5f5;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
`;

const AvatarThemeSwatch = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 10px;
  flex-shrink: 0;
  background: ${({ $background }) => $background};
  box-shadow: 0 0 0 1px ${({ $ring }) => $ring};
`;

const AvatarThemeText = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: #f5f5f5;
`;

const EditorLabel = styled.div`
  color: #d4af37;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
`;

const EditorInput = styled.input`
  width: 100%;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  caret-color: #f5d978;
  padding: 0 14px;
  outline: none;
  font-size: 15px;
  line-height: 1.4;
  font-family: inherit;

  &::placeholder {
    color: rgba(255, 255, 255, 0.42);
    -webkit-text-fill-color: rgba(255, 255, 255, 0.42);
  }

  &:focus {
    border-color: rgba(245, 217, 120, 0.55);
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
  }

  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus {
    -webkit-text-fill-color: #ffffff;
    box-shadow: 0 0 0 1000px rgba(24, 24, 24, 0.98) inset;
    transition: background-color 9999s ease-in-out 0s;
  }
`;

const EditorHint = styled.div`
  color: #9f9f9f;
  font-size: 12px;
  margin-top: 8px;
`;

const EditorActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
`;

const SectionTitle = styled.div`
  color: #d4af37;
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 16px;
`;

const AssetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 992px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 768px) {
    gap: 10px;
  }
`;

const AssetItem = styled.div`
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(212, 175, 55, 0.14);

  @media (max-width: 768px) {
    padding: 14px 12px;
    border-radius: 14px;
  }
`;

const AssetItemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AssetIconBadge = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(245, 217, 120, 0.18), rgba(212, 175, 55, 0.06));
  border: 1px solid rgba(212, 175, 55, 0.14);
  color: #f5d978;
  font-size: 20px;

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    font-size: 17px;
  }
`;

const AssetMeta = styled.div`
  min-width: 0;
`;

const AssetValue = styled.div`
  color: #d4af37;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.15;

  @media (max-width: 768px) {
    font-size: 22px;
  }
`;

const AssetLabel = styled.div`
  color: rgba(255, 255, 255, 0.84);
  font-size: 13px;
  margin-top: 6px;

  @media (max-width: 768px) {
    font-size: 12px;
    margin-top: 4px;
  }
`;

const CashierCard = styled.div`
  margin-top: 16px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(212, 175, 55, 0.14);
`;

const CashierTabs = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const CashierTabButton = styled.button`
  border: 1px solid
    ${({ $active }) => ($active ? 'rgba(245, 217, 120, 0.48)' : 'rgba(212, 175, 55, 0.18)')};
  border-radius: 999px;
  padding: 8px 14px;
  background: ${({ $active }) =>
    $active
      ? 'linear-gradient(135deg, rgba(245, 217, 120, 0.22), rgba(212, 175, 55, 0.1))'
      : 'rgba(255, 255, 255, 0.03)'};
  color: ${({ $active }) => ($active ? '#f5d978' : '#f5f5f5')};
  font-size: 13px;
  font-weight: 700;
`;

const CashierHint = styled.div`
  color: #bfbfbf;
  font-size: 13px;
  margin-top: 14px;
  line-height: 1.6;
`;

const CashierBalanceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
`;

const CashierBalanceTag = styled.div`
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.14);
  color: #f5f5f5;
  font-size: 12px;
`;

const CashierQuickRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const CashierQuickBtn = styled.button`
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 10px;
  background: rgba(212, 175, 55, 0.1);
  color: #d4af37;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;

  &:hover {
    background: rgba(212, 175, 55, 0.2);
  }
`;

const CashierInputRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 16px;

  @media (min-width: 769px) {
    max-width: 420px;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const CashierAmountInput = styled(EditorInput)`
  flex: 1;
  min-width: 0;

  @media (min-width: 769px) {
    max-width: 280px;
  }

  @media (max-width: 768px) {
    min-height: 52px;
    padding: 0 16px;
    font-size: 16px;
    border-radius: 14px;

    &::placeholder {
      font-size: 15px;
    }
  }
`;

const CashierMaxButton = styled.button`
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 12px;
  background: rgba(212, 175, 55, 0.08);
  color: #d4af37;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;

  @media (max-width: 768px) {
    min-height: 48px;
    width: 100%;
    font-size: 15px;
    border-radius: 14px;
  }
`;

const CashierSubmitButton = styled.button`
  min-width: 120px;
  border-radius: 12px;
  font-weight: 700;

  @media (min-width: 769px) {
    flex-shrink: 0;
    padding: 10px 20px;
  }

  @media (max-width: 768px) {
    min-height: 52px;
    width: 100%;
    font-size: 16px;
    border-radius: 14px;
  }
`;

const CashierSummary = styled.div`
  margin-top: 12px;
  color: #f5d978;
  font-size: 13px;
`;

const StatsIconGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 768px) {
    gap: 12px;
  }
`;

const StatsIconItem = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0;

  @media (max-width: 768px) {
    gap: 10px;
  }
`;

const StatsIconBadge = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(245, 217, 120, 0.18), rgba(212, 175, 55, 0.06));
  border: 1px solid rgba(212, 175, 55, 0.16);
  color: #f5d978;
  font-size: 24px;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);

  @media (max-width: 768px) {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    font-size: 20px;
  }
`;

const StatsIconContent = styled.div`
  min-width: 0;
`;

const StatsIconValue = styled.div`
  color: #d4af37;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;

  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const StatsIconLabel = styled.div`
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;

  @media (max-width: 768px) {
    margin-top: 4px;
    font-size: 12px;
  }
`;

const QuickActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const QuickActionCard = styled.button`
  width: 100%;
  text-align: left;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 14px;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(212, 175, 55, 0.3);
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.24);
  }
`;

const QuickIcon = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(212, 175, 55, 0.12);
  color: #d4af37;
  font-size: 20px;
  flex-shrink: 0;
`;

const QuickTextWrap = styled.div`
  min-width: 0;
`;

const QuickTitle = styled.div`
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
`;

const QuickDesc = styled.div`
  color: #bfbfbf;
  font-size: 13px;
  margin-top: 4px;
`;

const ChartCard = styled(SectionCard)`
  overflow: hidden;
`;

const RoomsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RoomItem = styled.div`
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  display: flex;
  justify-content: space-between;
  gap: 14px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const RoomTitle = styled.div`
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
`;

const RoomMeta = styled.div`
  color: #bfbfbf;
  font-size: 13px;
  margin-top: 6px;
`;

const RoomActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const EmptyState = styled.div`
  color: #bfbfbf;
  font-size: 14px;
  padding: 8px 0;
`;

const formatCompactAmount = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return `${value}`;
  }

  const formatUnit = (nextValue, unit) => {
    const rounded =
      nextValue >= 100
        ? nextValue.toFixed(0)
        : nextValue >= 10
          ? nextValue.toFixed(1)
          : nextValue.toFixed(decimals);
    return `${Number(rounded)}${unit}`;
  };

  if (Math.abs(numeric) >= 1000000) {
    return formatUnit(numeric / 1000000, 'M');
  }

  if (Math.abs(numeric) >= 1000) {
    return formatUnit(numeric / 1000, 'K');
  }

  if (Number.isInteger(numeric)) {
    return `${numeric}`;
  }

  return `${Number(numeric.toFixed(decimals))}`;
};

const MyAccount = () => {
  const [searchParams] = useSearchParams();
  const queryStrToken = searchParams.get('token');
  const queryStrTab = searchParams.get('tab');
  const authCtx = useContext(authContext);
  const {
    setIsLoggedIn,
    logout,
    refreshEconomyOverview,
    refreshWalletSession,
    setMyDashboardDataRefresh,
    syncOnchainState,
    confirmDeposit,
    updateEconomyUserWallet,
    updateMyDashboardUserStats,
    walletSession,
  } = authCtx;

  const { socket } = useContext(socketContext);
  const navigate = useNavigate();
  const { myDashboardData, economyOverview } = useContext(authContext);
  useEffect(() => {
    if (socket && queryStrToken) {
      localStorage.setItem(LS_TOKEN, queryStrToken);
      setIsLoggedIn({
        token: queryStrToken,
      });
    }
  }, [socket, queryStrToken]);

  useEffect(() => {
    if (socket) {
      regSocketMessageHandler(socket);
      getUserTables();
    }
  }, [socket]);

  const regSocketMessageHandler = (socket) => {
    socket.handle('getUserTables', (jsonData) => getUserTablesDataResult(jsonData.data));
    socket.handle('updateUserProfile', (jsonData) => updateUserProfileResult(jsonData.data));
    socket.handle('exchangeAllinToChips', handleExchangeCashierSocketResult);
    socket.handle('redeemChipsToAllin', handleRedeemCashierSocketResult);
  };

  const initUserStats = {
    username: '',
    avatarIcon: DEFAULT_AVATAR_ID,
    money: formatMoney(0),
    winCount: 0,
    loseCount: 0,
    xp: 0,
    walletAddress: '',
    allinBalance: 0,
    walletAllinBalance: 0,
    vaultAllinBalance: 0,
    holdAmount: 0,
    lifetimeBurned: 0,
    achievements: [],
  };
  const [userStats, setUserStats] = useState(initUserStats);
  const [userTables, setUserTables] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSubmittingCashier, setIsSubmittingCashier] = useState(false);
  const cashierTabs = ['exchange', 'redeem'];
  const defaultCashierTab = cashierTabs.includes(queryStrTab) ? queryStrTab : 'exchange';
  const [activeCashierTab, setActiveCashierTab] = useState(defaultCashierTab);
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [profileUsernameDraft, setProfileUsernameDraft] = useState('');
  const [profileAvatarDraft, setProfileAvatarDraft] = useState(DEFAULT_AVATAR_ID);
  const [profileAvatarThemeDraft, setProfileAvatarThemeDraft] = useState(DEFAULT_AVATAR_THEME_ID);

  useEffect(() => {
    setActiveCashierTab(cashierTabs.includes(queryStrTab) ? queryStrTab : 'exchange');
  }, [queryStrTab]);

  useEffect(() => {
    if (myDashboardData) {
      parseMyStats(myDashboardData);
    } else {
      setUserStats(initUserStats);
      if (!isEditingProfile) {
        setProfileUsernameDraft('');
        setProfileAvatarDraft(DEFAULT_AVATAR_ID);
        setProfileAvatarThemeDraft(DEFAULT_AVATAR_THEME_ID);
      }
    }
  }, [myDashboardData, isEditingProfile]);

  function parseMyStats(data) {
    const stats = data.userStats;
    const avatarSelection = parseAvatarSelection(stats.avatarIcon);
    setUserStats(stats);
    if (!isEditingProfile) {
      setProfileUsernameDraft(stats.username || '');
      setProfileAvatarDraft(avatarSelection.avatarId);
      setProfileAvatarThemeDraft(avatarSelection.themeId);
    }
  }

  function removeTable(tableId) {
    console.info('remove table ' + tableId);
    toast.warn('🙈 Removing user tables is not implemented yet', {
      autoClose: 5 * 1000,
      theme: 'dark',
    });
  }

  function getUserTables() {
    const token = localStorage.getItem(LS_TOKEN);
    socket.send(
      JSON.stringify({
        key: 'getUserTables',
        token: token,
      })
    );
  }

  function getUserTablesDataResult(data) {
    if (data.success) {
      setUserTables(data.tables);
    }
  }

  function updateUserProfileResult(data) {
    if (!data.success) {
      setIsSavingProfile(false);
      toast.error(data.message || '资料更新失败');
      return;
    }

    updateMyDashboardUserStats?.(data.userStats);
    const avatarSelection = parseAvatarSelection(data.userStats?.avatarIcon);
    setUserStats((prev) => ({
      ...prev,
      ...data.userStats,
    }));
    setProfileUsernameDraft(data.userStats?.username || '');
    setProfileAvatarDraft(avatarSelection.avatarId);
    setProfileAvatarThemeDraft(avatarSelection.themeId);
    setIsSavingProfile(false);
    setIsEditingProfile(false);
    toast.success(data.message || '资料更新成功');
  }

  function handleCashierResult(type, data) {
    setIsSubmittingCashier(false);

    if (!data?.success) {
      const errMsg = data?.message || (type === 'exchange' ? '兑换失败' : '换回失败');
      toast.error(errMsg);
      return;
    }

    const wallet = data.wallet || data.request;
    if (wallet) {
      updateEconomyUserWallet?.(wallet);
      // 已有最新 wallet，只做本地更新；不触发 setMyDashboardDataRefresh，避免触发 getEconomyOverview
      // 否则其响应（或之前未返回的旧响应）会覆盖刚刷新的余额
    } else {
      refreshEconomyOverview?.();
      setMyDashboardDataRefresh?.(Date.now());
    }

    if (type === 'exchange') setExchangeAmount('');
    else if (type === 'redeem') setRedeemAmount('');
    let successMsg = data?.message;
    if (!successMsg) {
      if (type === 'exchange') successMsg = '兑换成功';
      else successMsg = '换回成功，ALLIN 将转入链上钱包';
    }
    toast.success(successMsg);
  }

  function handleExchangeCashierSocketResult(jsonData) {
    handleCashierResult('exchange', jsonData.data);
  }

  function handleRedeemCashierSocketResult(jsonData) {
    handleCashierResult('redeem', jsonData.data);
  }

  function handleLogout() {
    logout();
    window.location.reload();
  }

  function submitProfile() {
    const token = localStorage.getItem(LS_TOKEN);
    const trimmedUsername = profileUsernameDraft.trim();

    if (!socket || !token) {
      toast.error('连接尚未就绪');
      return;
    }

    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      toast.error('昵称长度需在 2 到 20 个字符之间');
      return;
    }

    setIsSavingProfile(true);
    socket.send(
      JSON.stringify({
        key: 'updateUserProfile',
        token,
        username: trimmedUsername,
        avatarIcon: serializeAvatarSelection(profileAvatarDraft, profileAvatarThemeDraft),
      })
    );
  }

  const normalizeAmountInput = (value) => String(value || '').replace(/[^\d]/g, '');

  const handleExchangeAmountChange = (event) => {
    setExchangeAmount(normalizeAmountInput(event.currentTarget?.value));
  };

  const handleRedeemAmountChange = (event) => {
    setRedeemAmount(normalizeAmountInput(event.currentTarget?.value));
  };

  function submitCashier(type) {
    const rawAmount = type === 'exchange' ? exchangeAmount : redeemAmount;
    const amount = Number(rawAmount || 0);
    const sourceBalance = type === 'exchange' ? walletAllinBalanceValue : chipBalanceValue;

    if (!socket) {
      toast.error('连接尚未就绪');
      return;
    }

    if (!amount || amount <= 0) {
      toast.error('请输入有效数量');
      return;
    }

    const balanceErrorMsg = type === 'exchange' ? '钱包 ALLIN 余额不足' : '筹码余额不足';
    if (amount > sourceBalance) {
      toast.error(balanceErrorMsg);
      return;
    }

    if (type === 'exchange') {
      submitTreasuryDeposit(amount);
      return;
    }

    const token = localStorage.getItem(LS_TOKEN);
    if (!token) {
      toast.error('登录状态已失效，请重新连接钱包');
      return;
    }

    setIsSubmittingCashier(true);
    socket.send(
      JSON.stringify({
        key: 'redeemChipsToAllin',
        token,
        amount,
      })
    );
  }

  async function submitTreasuryDeposit(amount) {
    const walletId = walletSession?.walletId || localStorage.getItem(LS_CONNECTED_WALLET_ID);
    const onchainConfig = economyOverview?.onchain || {};
    const previousChipBalance = Number(economyOverview?.userWallet?.chipBalance || 0);

    if (!walletId) {
      toast.error('未找到已连接的钱包，请重新连接钱包');
      return;
    }

    if (!onchainConfig?.allinTokenAddress || !onchainConfig?.treasuryVaultAddress) {
      toast.error('金库或代币地址未配置');
      return;
    }

    const loggedInWallet =
      economyOverview?.userWallet?.walletAddress || userStats?.walletAddress || '';

    try {
      setIsSubmittingCashier(true);
      await refreshWalletSession?.();
      const { txHash } = await depositAllinToTreasury({
        walletId,
        tokenAddress: onchainConfig.allinTokenAddress,
        treasuryVaultAddress: onchainConfig.treasuryVaultAddress,
        amount,
        expectedWalletAddress: loggedInWallet,
      });

      let result = null;
      try {
        result = await confirmDeposit?.(txHash);
      } catch (err) {
        const msg = err?.message || '';
        if (msg.includes('TX_NOT_FOUND') || msg.includes('NOT_DEPOSIT')) {
          try {
            result = await syncOnchainState?.();
          } catch {
            toast.success('链上交易已确认，请稍后刷新页面查看筹码');
          }
        } else {
          toast.error(msg || '充值确认失败');
        }
      }

      setExchangeAmount('');
      if (result?.economy) {
        // 直接用返回的 economy 更新界面，不再请求 getEconomyOverview，避免旧响应覆盖导致筹码不刷新
        updateEconomyUserWallet?.(result.economy.userWallet);
      }
      setMyDashboardDataRefresh?.(Date.now());
      if (!result?.economy) {
        refreshEconomyOverview?.();
      }

      if (result?.economy) {
        const nextChipBalance = Number(result.economy?.userWallet?.chipBalance || 0);
        if (nextChipBalance >= previousChipBalance + amount) {
          toast.success('充值成功，已按 1:1 转为筹码');
        } else {
          toast.success('链上交易已确认，资产同步中');
        }
      }
    } catch (error) {
      const msg =
        getFriendlyWalletErrorMessage(error) || error?.message || '充值到金库失败';
      toast.error(msg);
    } finally {
      setIsSubmittingCashier(false);
    }
  }

  const walletAddress =
    userStats.walletAddress ||
    economyOverview?.userWallet?.walletAddress ||
    walletSession?.address ||
    '未连接';
  const shortWallet =
    walletAddress && walletAddress !== '未连接' && walletAddress.length > 12
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-5)}`
      : walletAddress;
  const displayName = userStats.username || 'ALLIN 玩家';
  const avatarOption = getAvatarOption(userStats.avatarIcon);
  const avatarPreviewOption = getAvatarOption(
    serializeAvatarSelection(profileAvatarDraft, profileAvatarThemeDraft)
  );
  const chipBalanceValue =
    typeof economyOverview?.userWallet?.chipBalance === 'number'
      ? economyOverview.userWallet.chipBalance
      : typeof userStats.money === 'number'
        ? userStats.money
        : 0;
  const walletAllinBalanceValue =
    typeof economyOverview?.userWallet?.walletAllinBalance === 'number'
      ? economyOverview.userWallet.walletAllinBalance
      : typeof economyOverview?.userWallet?.allinBalance === 'number'
        ? economyOverview.userWallet.allinBalance
        : Number(userStats.walletAllinBalance ?? userStats.allinBalance ?? 0);
  const vaultAllinBalanceValue =
    typeof economyOverview?.userWallet?.vaultAllinBalance === 'number'
      ? economyOverview.userWallet.vaultAllinBalance
      : Number(userStats.vaultAllinBalance || 0);
  const lifetimeBurnedValue =
    typeof economyOverview?.userWallet?.lifetimeBurned === 'number'
      ? economyOverview.userWallet.lifetimeBurned
      : Number(userStats.lifetimeBurned || 0);
  const lockedInTablesValue =
    typeof economyOverview?.userWallet?.lockedInTables === 'number'
      ? economyOverview.userWallet.lockedInTables
      : 0;
  const lockedInTournamentValue =
    typeof economyOverview?.userWallet?.lockedInTournament === 'number'
      ? economyOverview.userWallet.lockedInTournament
      : 0;
  const moneyValue =
    typeof chipBalanceValue === 'number' ? formatMoney(chipBalanceValue) : formatMoney(0);

  const quickActions = useMemo(
    () => [
      {
        key: 'games',
        icon: '🎰',
        title: '游戏大厅',
        description: '返回大厅继续创建或加入牌局',
        onClick: () => navigate('/games'),
      },
      {
        key: 'rankings',
        icon: '🏆',
        title: '排行榜',
        description: '查看当前玩家排名和对局表现',
        onClick: () => navigate('/rankings'),
      },
      {
        key: 'logout',
        icon: '🚪',
        title: '退出登录',
        description: '退出当前钱包会话',
        onClick: handleLogout,
      },
    ],
    [navigate]
  );

  const metricCards = [
    { key: 'xp', value: userStats.xp || 0, label: '经验值', icon: '📈' },
    { key: 'win', value: userStats.winCount || 0, label: '胜局', icon: '🏆' },
    { key: 'lose', value: userStats.loseCount || 0, label: '败局', icon: '📉' },
  ];
  const assetCards = [
    { key: 'chips', value: moneyValue, label: '筹码', icon: '🪙' },
    {
      key: 'allin',
      value: formatCompactAmount(walletAllinBalanceValue || 0),
      label: '钱包 ALLIN',
      icon: '💰',
    },
    {
      key: 'burned',
      value: formatCompactAmount(lifetimeBurnedValue || 0),
      label: '累计销毁',
      icon: '🔥',
    },
  ];
  const copyWallet = async () => {
    if (!walletAddress || walletAddress === '未连接') {
      toast.error('当前没有可复制的钱包地址');
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.success('钱包地址已复制');
    } catch (error) {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleEditProfile = () => {
    if (isEditingProfile) {
      setIsEditingProfile(false);
      return;
    }

    const avatarSelection = parseAvatarSelection(userStats.avatarIcon);
    setProfileUsernameDraft(displayName === 'ALLIN 玩家' ? '' : displayName);
    setProfileAvatarDraft(avatarSelection.avatarId);
    setProfileAvatarThemeDraft(avatarSelection.themeId);
    setIsEditingProfile(true);
  };

  const fillAllinMax = () => {
    setExchangeAmount(String(walletAllinBalanceValue || 0));
  };

  const fillChipMax = () => {
    setRedeemAmount(String(chipBalanceValue || 0));
  };

  return (
    <div className="container">
      <PageWrap>
        <HeroCard>
          <AvatarFrame
            $image={avatarOption?.type === 'image'}
            $themeBackground={avatarOption?.theme?.background}
            $themeColor={avatarOption?.theme?.color}
            $themeRing={avatarOption?.theme?.ring}
          >
            {avatarOption?.type === 'image' ? (
              <AvatarImage src={avatarOption.src} alt={avatarOption.label} />
            ) : (
              avatarOption?.text || displayName.slice(0, 1).toUpperCase()
            )}
          </AvatarFrame>
          <HeroInfo>
            <HeroTitle>{displayName}</HeroTitle>
            <HeroSubline>
              <WalletText>{shortWallet}</WalletText>
              <MiniButton type="button" onClick={copyWallet}>
                复制
              </MiniButton>
            </HeroSubline>
            <HeroActions>
              <MiniButton type="button" onClick={handleEditProfile}>
                编辑资料
              </MiniButton>
            </HeroActions>
          </HeroInfo>
        </HeroCard>

        {isEditingProfile ? (
          <ProfileEditorCard>
            <EditorTitle>编辑资料</EditorTitle>
            <div>
              <EditorLabel>选择头像</EditorLabel>
              <AvatarPickerGrid>
                {AVATAR_OPTIONS.map((option) => (
                  <AvatarOptionButton
                    key={option.id}
                    type="button"
                    $active={profileAvatarDraft === option.id}
                    onClick={() => setProfileAvatarDraft(option.id)}
                    title={option.label}
                  >
                    {option.type === 'image' ? (
                      <AvatarOptionImage src={option.src} alt={option.label} />
                    ) : (
                      option.text
                    )}
                  </AvatarOptionButton>
                ))}
              </AvatarPickerGrid>
            </div>

            <div style={{ marginTop: '16px' }}>
              <EditorLabel>头像配色</EditorLabel>
              <AvatarThemeGrid>
                {AVATAR_THEMES.map((theme) => (
                  <AvatarThemeButton
                    key={theme.id}
                    type="button"
                    $active={profileAvatarThemeDraft === theme.id}
                    $ring={theme.ring}
                    onClick={() => setProfileAvatarThemeDraft(theme.id)}
                    title={theme.label}
                  >
                    <AvatarThemeSwatch $background={theme.background} $ring={theme.ring} />
                    <AvatarThemeText>{theme.label}</AvatarThemeText>
                  </AvatarThemeButton>
                ))}
              </AvatarThemeGrid>
            </div>

            <div style={{ marginTop: '16px' }}>
              <EditorLabel>当前预览</EditorLabel>
              <AvatarFrame
                $image={avatarPreviewOption?.type === 'image'}
                $themeBackground={avatarPreviewOption?.theme?.background}
                $themeColor={avatarPreviewOption?.theme?.color}
                $themeRing={avatarPreviewOption?.theme?.ring}
              >
                {avatarPreviewOption?.type === 'image' ? (
                  <AvatarImage src={avatarPreviewOption.src} alt={avatarPreviewOption.label} />
                ) : (
                  avatarPreviewOption?.text || displayName.slice(0, 1).toUpperCase()
                )}
              </AvatarFrame>
            </div>

            <div style={{ marginTop: '16px' }}>
              <EditorLabel>昵称</EditorLabel>
              <EditorInput
                type="text"
                maxLength={20}
                autoComplete="off"
                value={profileUsernameDraft}
                onChange={(event) => setProfileUsernameDraft(event.target.value)}
                onInput={(event) => setProfileUsernameDraft(event.currentTarget.value)}
                placeholder="输入 2-20 位昵称"
              />
              <EditorHint>保存后聊天、牌桌昵称和账户页都会同步更新。</EditorHint>
            </div>

            <EditorActions>
              <button
                className="btn btn-sm allin-gold-btn"
                type="button"
                disabled={isSavingProfile}
                onClick={submitProfile}
              >
                {isSavingProfile ? '保存中...' : '保存资料'}
              </button>
              <button
                className="btn btn-sm btn-outline-light"
                type="button"
                disabled={isSavingProfile}
                onClick={() => setIsEditingProfile(false)}
              >
                取消
              </button>
            </EditorActions>
          </ProfileEditorCard>
        ) : null}

        <SectionCard className="mt-3">
          <SectionTitle>资产概览</SectionTitle>
          <AssetGrid>
            {assetCards.map((item) => (
              <AssetItem key={item.key}>
                <AssetItemHeader>
                  <AssetIconBadge>{item.icon}</AssetIconBadge>
                  <AssetMeta>
                    <AssetValue>{item.value}</AssetValue>
                    <AssetLabel>{item.label}</AssetLabel>
                  </AssetMeta>
                </AssetItemHeader>
              </AssetItem>
            ))}
          </AssetGrid>

          <CashierCard>
            <CashierTabs>
              <CashierTabButton
                type="button"
                $active={activeCashierTab === 'exchange'}
                onClick={() => setActiveCashierTab('exchange')}
              >
                充值到金库
              </CashierTabButton>
              <CashierTabButton
                type="button"
                $active={activeCashierTab === 'redeem'}
                onClick={() => setActiveCashierTab('redeem')}
              >
                换回代币
              </CashierTabButton>
            </CashierTabs>

            <CashierHint>
              钱包中的 ALLIN 会先充值到金库，链上确认后自动按 1:1 增加筹码。
            </CashierHint>
            <CashierBalanceRow>
              <CashierBalanceTag>
                钱包 ALLIN：{formatCompactAmount(walletAllinBalanceValue || 0)}
              </CashierBalanceTag>
              <CashierBalanceTag>
                筹码余额：{formatCompactAmount(chipBalanceValue || 0)}
              </CashierBalanceTag>
            </CashierBalanceRow>

            {activeCashierTab === 'exchange' && (
              <>
                <CashierQuickRow>
                  {[
                    { label: '10K', value: 10000 },
                    { label: '50K', value: 50000 },
                    { label: '1M', value: 1000000 },
                    { label: '5M', value: 5000000 },
                  ].map(({ label, value }) => (
                    <CashierQuickBtn
                      key={label}
                      type="button"
                      onClick={() => setExchangeAmount(String(value))}
                    >
                      {label}
                    </CashierQuickBtn>
                  ))}
                  <CashierQuickBtn type="button" onClick={fillAllinMax}>
                    ALLIN
                  </CashierQuickBtn>
                </CashierQuickRow>
                <CashierInputRow>
                  <CashierAmountInput
                    type="text"
                    inputMode="numeric"
                    placeholder="输入要充值到金库的 ALLIN 数量"
                    value={exchangeAmount}
                    onChange={handleExchangeAmountChange}
                  />
                  <CashierSubmitButton
                    type="button"
                    className="btn allin-gold-btn"
                    disabled={isSubmittingCashier}
                    onClick={() => submitCashier('exchange')}
                  >
                    {isSubmittingCashier ? '处理中...' : '确认充值'}
                  </CashierSubmitButton>
                </CashierInputRow>
                <CashierSummary>充值后：钱包 ALLIN 扣减，金库确认后筹码等额增加。</CashierSummary>
              </>
            )}
            {activeCashierTab === 'redeem' && (
              <>
                <CashierInputRow>
                  <CashierAmountInput
                    type="text"
                    inputMode="numeric"
                    placeholder="输入要换回的筹码数量"
                    value={redeemAmount}
                    onChange={handleRedeemAmountChange}
                  />
                  <CashierMaxButton type="button" onClick={fillChipMax}>
                    全部换回
                  </CashierMaxButton>
                  <CashierSubmitButton
                    type="button"
                    className="btn allin-gold-btn"
                    disabled={isSubmittingCashier}
                    onClick={() => submitCashier('redeem')}
                  >
                    {isSubmittingCashier ? '处理中...' : '确认换回'}
                  </CashierSubmitButton>
                </CashierInputRow>
                <CashierSummary>
                  换回后：筹码减少，金库将 ALLIN 转入您的链上钱包（约数秒到账）。
                </CashierSummary>
              </>
            )}
          </CashierCard>
        </SectionCard>

        <SectionCard className="mt-3">
          <SectionTitle>战绩统计</SectionTitle>
          <StatsIconGrid>
            {metricCards.map((item) => (
              <StatsIconItem key={item?.key || item?.label}>
                <StatsIconBadge>{item?.icon || '•'}</StatsIconBadge>
                <StatsIconContent>
                  <StatsIconValue>{item?.value ?? 0}</StatsIconValue>
                  <StatsIconLabel>{item?.label || '-'}</StatsIconLabel>
                </StatsIconContent>
              </StatsIconItem>
            ))}
          </StatsIconGrid>
        </SectionCard>

        <SectionCard className="mt-3">
          <SectionTitle>快捷入口</SectionTitle>
          <QuickActionGrid>
            {quickActions.map((item) => (
              <QuickActionCard key={item.key} type="button" onClick={item.onClick}>
                <QuickIcon>{item.icon}</QuickIcon>
                <QuickTextWrap>
                  <QuickTitle>{item.title}</QuickTitle>
                  <QuickDesc>{item.description}</QuickDesc>
                </QuickTextWrap>
              </QuickActionCard>
            ))}
          </QuickActionGrid>
        </SectionCard>

        {userStats.achievements?.length ? (
          <SectionCard className="mt-3">
            <SectionTitle>成就收藏</SectionTitle>
            <Achievements achievements={userStats.achievements} />
          </SectionCard>
        ) : null}

        <ChartCard className="mt-3">
          <SectionTitle>战绩图表</SectionTitle>
          <StatsChart userStats={userStats.dailyAverageStats} />
        </ChartCard>

        <SectionCard className="mt-3 mb-4">
          <SectionTitle>我的房间</SectionTitle>
          <div style={{ color: '#bfbfbf', fontSize: '13px', marginBottom: '14px' }}>
            房间已改为按大厅档位规则创建，这里只展示你已创建的房间。
          </div>
          <RoomsList>
            {userTables === null ? (
              <EmptyState>加载中...</EmptyState>
            ) : userTables.length ? (
              userTables.map((table) => (
                <RoomItem key={table.id}>
                  <div>
                    <RoomTitle>{table.tableName}</RoomTitle>
                    <RoomMeta>
                      房间编号 #{table.id} | 游戏 {table.game} | 机器人 {table.botCount}
                    </RoomMeta>
                  </div>
                  <RoomActions>
                    <button
                      className="btn btn-sm allin-gold-btn"
                      type="button"
                      onClick={() => navigate('/games')}
                    >
                      前往大厅
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => removeTable(table.id)}
                    >
                      删除
                    </button>
                  </RoomActions>
                </RoomItem>
              ))
            ) : (
              <EmptyState>你暂时还没有创建房间。</EmptyState>
            )}
          </RoomsList>
          <button
            className="btn btn-sm allin-gold-btn mt-3"
            type="button"
            onClick={() => navigate('/games')}
          >
            前往大厅按档位创建
          </button>
        </SectionCard>
      </PageWrap>
    </div>
  );
};

export default MyAccount;
