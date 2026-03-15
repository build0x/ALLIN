import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import adminContext from './adminContext';

const navItems = [
  { to: '/admin/dashboard', label: '总览' },
  { to: '/admin/users', label: '用户' },
  { to: '/admin/rooms', label: '房间' },
  { to: '/admin/tournaments', label: '锦标赛' },
  { to: '/admin/audit-logs', label: '审计日志' },
];

const linkStyle = (active) => ({
  display: 'block',
  padding: '12px 14px',
  color: active ? '#111' : '#f1f1f1',
  background: active ? '#d4af37' : 'transparent',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
  marginBottom: '8px',
});

const AdminLayout = ({ children }) => {
  const { admin, logoutAdmin } = useContext(adminContext);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#f5f5f5' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
          background: '#0b0b0b',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 900,
              letterSpacing: '0.12em',
            }}
          >
            ALLIN 后台
          </div>
          <div style={{ color: '#c5c5c5', fontSize: '13px' }}>
            {admin?.displayName || admin?.walletAddress || '管理员'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-outline-warning btn-sm"
            type="button"
            onClick={() => navigate('/games')}
          >
            返回前台
          </button>
          <button
            className="btn btn-warning btn-sm"
            type="button"
            onClick={() => {
              logoutAdmin();
              navigate('/admin/login');
            }}
          >
            退出后台
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 77px)' }}>
        <aside
          style={{
            width: '220px',
            padding: '20px',
            borderRight: '1px solid rgba(212, 175, 55, 0.15)',
            background: '#080808',
          }}
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={linkStyle(location.pathname === item.to)}
            >
              {item.label}
            </Link>
          ))}
        </aside>
        <main style={{ flex: 1, padding: '24px' }}>{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
