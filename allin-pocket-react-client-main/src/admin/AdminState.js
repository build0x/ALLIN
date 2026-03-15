import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import adminContext from './adminContext';
import adminClient, { getAdminToken, setAdminToken } from './adminClient';

const AdminState = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const logoutAdmin = useCallback(() => {
    setAdminToken(null);
    setAdmin(null);
  }, []);

  const request = useCallback(
    async (config) => {
      try {
        const response = await adminClient(config);
        return response.data;
      } catch (error) {
        const message = error?.response?.data?.message || error.message || '后台请求失败';
        if (error?.response?.status === 401) {
          logoutAdmin();
        }
        throw new Error(message);
      }
    },
    [logoutAdmin]
  );

  const bootstrap = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await request({
        url: '/auth/me',
        method: 'get',
      });
      setAdmin(response.data.admin);
    } catch (error) {
      setAdminToken(null);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const requestNonce = async (walletAddress) => {
    const response = await request({
      url: '/auth/nonce',
      method: 'post',
      data: {
        walletAddress,
      },
    });
    return response.data;
  };

  const verifyWalletLogin = async ({ walletAddress, signature }) => {
    const response = await request({
      url: '/auth/verify',
      method: 'post',
      data: {
        walletAddress,
        signature,
      },
    });
    setAdminToken(response.data.token);
    setAdmin(response.data.admin);
    toast.success('后台登录成功');
    return response.data;
  };

  const value = useMemo(
    () => ({
      admin,
      loading,
      isAdminAuthed: Boolean(admin),
      requestNonce,
      verifyWalletLogin,
      logoutAdmin,
      getDashboard: () =>
        request({
          url: '/dashboard',
          method: 'get',
        }).then((result) => result.data),
      getUsers: (params) =>
        request({
          url: '/users',
          method: 'get',
          params,
        }).then((result) => result.data),
      getRooms: (params) =>
        request({
          url: '/rooms',
          method: 'get',
          params,
        }).then((result) => result.data),
      deleteRoom: (roomId) =>
        request({
          url: `/rooms/${roomId}`,
          method: 'delete',
        }).then((result) => result.data),
      getUserDetail: (userId) =>
        request({
          url: `/users/${userId}`,
          method: 'get',
        }).then((result) => result.data),
      adjustUserBalance: (userId, payload) =>
        request({
          url: `/users/${userId}/balance-adjust`,
          method: 'post',
          data: payload,
        }).then((result) => result.data),
      getTournaments: () =>
        request({
          url: '/tournaments',
          method: 'get',
        }).then((result) => result.data),
      getTournamentDetail: (tournamentId) =>
        request({
          url: `/tournaments/${tournamentId}`,
          method: 'get',
        }).then((result) => result.data),
      updateTournament: (tournamentId, payload) =>
        request({
          url: `/tournaments/${tournamentId}`,
          method: 'patch',
          data: payload,
        }).then((result) => result.data),
      registerTournamentUser: (tournamentId, userId) =>
        request({
          url: `/tournaments/${tournamentId}/register/${userId}`,
          method: 'post',
        }).then((result) => result.data),
      cancelTournamentRegistration: (tournamentId, userId) =>
        request({
          url: `/tournaments/${tournamentId}/cancel-registration/${userId}`,
          method: 'post',
        }).then((result) => result.data),
      advanceTournament: (tournamentId) =>
        request({
          url: `/tournaments/${tournamentId}/advance`,
          method: 'post',
        }).then((result) => result.data),
      resetTournament: (tournamentId) =>
        request({
          url: `/tournaments/${tournamentId}/reset`,
          method: 'post',
        }).then((result) => result.data),
      generateTournamentStrategy: (tournamentId) =>
        request({
          url: `/tournaments/${tournamentId}/strategy/generate`,
          method: 'post',
        }).then((result) => result.data),
      applyTournamentStrategy: (tournamentId) =>
        request({
          url: `/tournaments/${tournamentId}/strategy/apply`,
          method: 'post',
        }).then((result) => result.data),
      rejectTournamentStrategy: (tournamentId) =>
        request({
          url: `/tournaments/${tournamentId}/strategy/reject`,
          method: 'post',
        }).then((result) => result.data),
      fillTournamentBots: (tournamentId, payload) =>
        request({
          url: `/tournaments/${tournamentId}/fill-bots`,
          method: 'post',
          data: payload,
        }).then((result) => result.data),
      getAuditLogs: (params) =>
        request({
          url: '/audit-logs',
          method: 'get',
          params,
        }).then((result) => result.data),
    }),
    [admin, loading, request, logoutAdmin]
  );

  return <adminContext.Provider value={value}>{children}</adminContext.Provider>;
};

export default AdminState;
