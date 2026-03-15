import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import adminContext from '@/admin/adminContext';

const panelStyle = {
  borderRadius: '16px',
  background: '#111',
  border: '1px solid rgba(212,175,55,0.18)',
  padding: '18px',
};

const AdminUsersPage = () => {
  const { getUsers } = useContext(adminContext);
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ items: [] });

  const loadUsers = async (nextSearch = search) => {
    const result = await getUsers({
      search: nextSearch,
      page: 1,
      pageSize: 50,
    });
    setData(result);
  };

  useEffect(() => {
    loadUsers('');
  }, []);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0" style={{ fontWeight: 900 }}>
          用户管理
        </h2>
        <div style={{ color: '#bfbfbf' }}>共 {data.total || 0} 个用户</div>
      </div>

      <div style={panelStyle}>
        <div className="row g-2 mb-3">
          <div className="col-md-8">
            <input
              className="form-control"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索用户名 / 钱包 / 邮箱"
            />
          </div>
          <div className="col-md-4 d-grid">
            <button className="btn btn-warning" type="button" onClick={() => loadUsers()}>
              查询用户
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-dark align-middle mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户</th>
                <th>钱包</th>
                <th>桌上资金</th>
                <th>ALLIN 持仓</th>
                <th>XP</th>
                <th>战绩</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username || '-'}</td>
                  <td style={{ maxWidth: '220px', wordBreak: 'break-all' }}>
                    {user.walletAddress || '-'}
                  </td>
                  <td>{user.money}</td>
                  <td>{user.allinBalance}</td>
                  <td>{user.xp}</td>
                  <td>
                    {user.winCount}/{user.loseCount}
                  </td>
                  <td>
                    <Link to={`/admin/users/${user.id}`} className="btn btn-outline-warning btn-sm">
                      详情 / 调整
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage;
