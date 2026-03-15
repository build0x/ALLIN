import React, { useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import adminContext from '@/admin/adminContext';

const panelStyle = {
  borderRadius: '16px',
  background: '#111',
  border: '1px solid rgba(212,175,55,0.18)',
  padding: '18px',
};

const badgeStyle = (friendly) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  background: friendly ? 'rgba(180,108,255,0.18)' : 'rgba(212,175,55,0.16)',
  color: friendly ? '#e7c8ff' : '#f5d978',
});

const AdminRoomsPage = () => {
  const { getRooms, deleteRoom } = useContext(adminContext);
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ items: [] });
  const [deletingId, setDeletingId] = useState(null);

  const loadRooms = async (nextSearch = search) => {
    const result = await getRooms({
      search: nextSearch,
    });
    setData(result);
  };

  useEffect(() => {
    loadRooms('');
  }, []);

  const handleDeleteRoom = async (room) => {
    const confirmed = window.confirm(`确认删除房间「${room.tableName}」吗？`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(room.id);
      await deleteRoom(room.id);
      toast.success('房间已删除');
      await loadRooms(search);
    } catch (error) {
      toast.error(error.message || '删除房间失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0" style={{ fontWeight: 900 }}>
          房间管理
        </h2>
        <div style={{ color: '#bfbfbf' }}>共 {data.total || 0} 个房间</div>
      </div>

      <div style={panelStyle}>
        <div className="row g-2 mb-3">
          <div className="col-md-8">
            <input
              className="form-control"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索房间名 / 房间类型"
            />
          </div>
          <div className="col-md-4 d-grid">
            <button className="btn btn-warning" type="button" onClick={() => loadRooms()}>
              查询房间
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-dark align-middle mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>房间</th>
                <th>类型</th>
                <th>创建者</th>
                <th>最低下注</th>
                <th>时长</th>
                <th>燃烧</th>
                <th>到期</th>
                <th>密码</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((room) => {
                const isFriendly = room.roomType === 'private_friendly';
                return (
                  <tr key={room.id}>
                    <td>{room.id}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{room.tableName}</div>
                      <div style={{ color: '#bfbfbf', fontSize: '12px' }}>
                        {room.game} · {room.maxSeats} 座
                      </div>
                    </td>
                    <td>
                      <span style={badgeStyle(isFriendly)}>
                        {isFriendly ? '亲友房' : room.roomType || '普通房'}
                      </span>
                    </td>
                    <td>
                      <div>{room.ownerName || '-'}</div>
                      <div
                        style={{
                          color: '#bfbfbf',
                          fontSize: '12px',
                          maxWidth: '180px',
                          wordBreak: 'break-all',
                        }}
                      >
                        {room.ownerWalletAddress || '-'}
                      </div>
                    </td>
                    <td>{room.minBet}</td>
                    <td>{room.durationHours} 小时</td>
                    <td>{room.burnAmount}</td>
                    <td>{room.expiresAt ? new Date(room.expiresAt).toLocaleString() : '-'}</td>
                    <td>{room.passwordProtected ? '有' : '无'}</td>
                    <td>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        type="button"
                        disabled={deletingId === room.id}
                        onClick={() => handleDeleteRoom(room)}
                      >
                        {deletingId === room.id ? '删除中...' : '删除'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRoomsPage;
