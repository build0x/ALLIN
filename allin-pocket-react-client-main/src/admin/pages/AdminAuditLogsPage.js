import React, { useContext, useEffect, useState } from 'react';
import adminContext from '@/admin/adminContext';

const panelStyle = {
  borderRadius: '16px',
  background: '#111',
  border: '1px solid rgba(212,175,55,0.18)',
  padding: '18px',
};

const AdminAuditLogsPage = () => {
  const { getAuditLogs } = useContext(adminContext);
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ items: [] });

  const loadLogs = async (nextSearch = search) => {
    const result = await getAuditLogs({
      search: nextSearch,
      page: 1,
      pageSize: 100,
    });
    setData(result);
  };

  useEffect(() => {
    loadLogs('');
  }, []);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0" style={{ fontWeight: 900 }}>
          审计日志
        </h2>
        <div style={{ color: '#bfbfbf' }}>共 {data.total || 0} 条</div>
      </div>

      <div style={panelStyle}>
        <div className="row g-2 mb-3">
          <div className="col-md-8">
            <input
              className="form-control"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索动作 / 资源 / 管理员钱包"
            />
          </div>
          <div className="col-md-4 d-grid">
            <button className="btn btn-warning" type="button" onClick={() => loadLogs()}>
              查询日志
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-dark align-middle mb-0">
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>摘要</th>
                <th>管理员</th>
                <th>对象</th>
                <th>用户ID</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>{item.action}</td>
                  <td>{item.summary || '-'}</td>
                  <td
                    style={{
                      maxWidth: '180px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.adminWalletAddress}
                  </td>
                  <td>
                    {item.resourceType}/{item.resourceId || '-'}
                  </td>
                  <td>{item.targetUserId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogsPage;
