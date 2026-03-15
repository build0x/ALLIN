import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import AdminLayout from '@/admin/AdminLayout';
import RequireAdminAuth from '@/admin/RequireAdminAuth';
import HoldemPage from '@/pages/HoldemPage';
import GamesPage from '@/pages/GamesPage';
import WalletLoginPage from '@/pages/WalletLoginPage';
import MyAccountPage from '@/pages/MyAccountPage';
import RankingsPage from '@/pages/RankingsPage';
import AdminLoginPage from '@/admin/pages/AdminLoginPage';
import AdminDashboardPage from '@/admin/pages/AdminDashboardPage';
import AdminUsersPage from '@/admin/pages/AdminUsersPage';
import AdminUserDetailPage from '@/admin/pages/AdminUserDetailPage';
import AdminRoomsPage from '@/admin/pages/AdminRoomsPage';
import AdminTournamentsPage from '@/admin/pages/AdminTournamentsPage';
import AdminAuditLogsPage from '@/admin/pages/AdminAuditLogsPage';

const AppRoute = ({ component: Component, layout: Layout, ...rest }) => {
  return (
    <Layout {...rest}>
      <Component {...rest} />
    </Layout>
  );
};

const BaseRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<WalletLoginPage />} />
      <Route path="/login" element={<WalletLoginPage />} />
      <Route path="/games" element={<AppRoute component={GamesPage} layout={MainLayout} />} />
      <Route path="/holdem" element={<AppRoute component={HoldemPage} layout={MainLayout} />} />
      <Route path="/account" element={<AppRoute component={MyAccountPage} layout={MainLayout} />} />
      <Route path="/rankings" element={<AppRoute component={RankingsPage} layout={MainLayout} />} />
      <Route path="/account-android" element={<MyAccountPage />} />
      <Route path="/rankings-android" element={<RankingsPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdminAuth>
            <AppRoute component={AdminDashboardPage} layout={AdminLayout} />
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <RequireAdminAuth>
            <AppRoute component={AdminDashboardPage} layout={AdminLayout} />
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAdminAuth>
            <AppRoute component={AdminUsersPage} layout={AdminLayout} />
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <RequireAdminAuth>
            <AppRoute component={AdminUserDetailPage} layout={AdminLayout} />
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/rooms"
        element={
          <RequireAdminAuth>
            <AppRoute component={AdminRoomsPage} layout={AdminLayout} />
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/tournaments"
        element={
          <RequireAdminAuth>
            <AppRoute component={AdminTournamentsPage} layout={AdminLayout} />
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RequireAdminAuth>
            <AppRoute component={AdminAuditLogsPage} layout={AdminLayout} />
          </RequireAdminAuth>
        }
      />
    </Routes>
  );
};

export default BaseRouter;
