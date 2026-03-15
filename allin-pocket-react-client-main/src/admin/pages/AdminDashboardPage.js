import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import adminContext from '@/admin/adminContext';

const metricCard = {
  borderRadius: '16px',
  background: '#111',
  border: '1px solid rgba(212,175,55,0.18)',
  padding: '18px',
};

const AdminDashboardPage = () => {
  const { getDashboard } = useContext(adminContext);
  const [data, setData] = useState(null);

  useEffect(() => {
    getDashboard().then(setData);
  }, [getDashboard]);

  const summary = data?.summary || {};

  return (
    <div>
      <h2 style={{ marginBottom: '18px', fontWeight: 900 }}>后台总览</h2>
      <div className="row g-3">
        <div className="col-md-4">
          <div style={metricCard}>
            <div style={{ color: '#c4c4c4' }}>总用户数</div>
            <div style={{ fontSize: '30px', fontWeight: 800 }}>{summary.totalUsers || 0}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div style={metricCard}>
            <div style={{ color: '#c4c4c4' }}>管理员</div>
            <div style={{ fontSize: '30px', fontWeight: 800 }}>{summary.activeAdmins || 0}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div style={metricCard}>
            <div style={{ color: '#c4c4c4' }}>BNB 奖池</div>
            <div style={{ fontSize: '30px', fontWeight: 800 }}>{summary.prizePoolBnb || 0}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div style={metricCard}>
            <div style={{ color: '#c4c4c4' }}>已燃烧 ALLIN</div>
            <div style={{ fontSize: '30px', fontWeight: 800 }}>{summary.totalBurnedAllin || 0}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div style={metricCard}>
            <div style={{ color: '#c4c4c4' }}>活跃现金桌</div>
            <div style={{ fontSize: '30px', fontWeight: 800 }}>{summary.activeCashTables || 0}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div style={metricCard}>
            <div style={{ color: '#c4c4c4' }}>活跃赛事</div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 800,
              }}
            >
              {summary.activeTournaments || 0}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-2">
        <div className="col-lg-6">
          <div style={metricCard}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">高余额用户</h5>
              <Link to="/admin/users" className="btn btn-outline-warning btn-sm">
                查看用户
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table table-dark table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户</th>
                    <th>持仓</th>
                    <th>桌上</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topUsers || []).map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username || user.walletAddress}</td>
                      <td>{user.allinBalance}</td>
                      <td>{user.money}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div style={metricCard}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">最近审计</h5>
              <Link to="/admin/audit-logs" className="btn btn-outline-warning btn-sm">
                查看日志
              </Link>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {(data?.recentAudits || []).map((audit) => (
                <div
                  key={audit.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{audit.summary || audit.action}</div>
                  <div
                    style={{
                      color: '#bbbbbb',
                      fontSize: '13px',
                    }}
                  >
                    {audit.adminWalletAddress} · {new Date(audit.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3" style={metricCard}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">近期赛事</h5>
          <Link to="/admin/tournaments" className="btn btn-outline-warning btn-sm">
            管理赛事
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table table-dark align-middle mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>赛事</th>
                <th>状态</th>
                <th>开始时间</th>
                <th>奖池 BNB</th>
                <th>报名费</th>
              </tr>
            </thead>
            <tbody>
              {(data?.tournaments || []).map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.title}</td>
                  <td>{item.status}</td>
                  <td>{item.startsAt ? new Date(item.startsAt).toLocaleString() : '-'}</td>
                  <td>{item.bnbPrizeAmount}</td>
                  <td>{item.buyInAllin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
