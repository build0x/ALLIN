import React, { useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import adminContext from '@/admin/adminContext';

const panelStyle = {
  borderRadius: '16px',
  background: '#111',
  border: '1px solid rgba(212,175,55,0.18)',
  padding: '18px',
};

const AdminUserDetailPage = () => {
  const { id } = useParams();
  const { getUserDetail, adjustUserBalance } = useContext(adminContext);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    moneyDelta: 0,
    allinDelta: 0,
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = async () => {
    const result = await getUserDetail(id);
    setDetail(result);
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const user = detail?.user;

  const submitAdjust = async () => {
    try {
      const confirmed = window.confirm('确认要调整该用户余额吗？此操作会写入审计日志。');
      if (!confirmed) {
        return;
      }
      setSubmitting(true);
      await adjustUserBalance(id, {
        moneyDelta: Number(form.moneyDelta || 0),
        allinDelta: Number(form.allinDelta || 0),
        reason: form.reason,
      });
      toast.success('余额调整成功');
      setForm({
        moneyDelta: 0,
        allinDelta: 0,
        reason: '',
      });
      await loadDetail();
    } catch (error) {
      toast.error(error.message || '余额调整失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Link to="/admin/users" className="btn btn-outline-warning btn-sm mb-2">
            返回用户列表
          </Link>
          <h2 className="mb-0" style={{ fontWeight: 900 }}>
            用户详情
          </h2>
        </div>
      </div>

      {user ? (
        <>
          <div className="row g-3">
            <div className="col-lg-5">
              <div style={panelStyle}>
                <h5>基本信息</h5>
                <div>ID：{user.id}</div>
                <div>用户名：{user.username || '-'}</div>
                <div style={{ wordBreak: 'break-all' }}>钱包：{user.walletAddress || '-'}</div>
                <div>登录方式：{user.loginMethod}</div>
                <div>XP：{user.xp}</div>
                <div>桌上资金：{user.money}</div>
                <div>ALLIN 持仓：{user.allinBalance}</div>
                <div>总充值：{user.totalDeposited}</div>
                <div>总提现：{user.totalWithdrawn}</div>
                <div>累计燃烧：{user.lifetimeBurned}</div>
              </div>
            </div>
            <div className="col-lg-7">
              <div style={panelStyle}>
                <h5>调整金额</h5>
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">桌上资金增减</label>
                    <input
                      className="form-control"
                      type="number"
                      value={form.moneyDelta}
                      onChange={(event) => setForm({ ...form, moneyDelta: event.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">ALLIN 持仓增减</label>
                    <input
                      className="form-control"
                      type="number"
                      value={form.allinDelta}
                      onChange={(event) => setForm({ ...form, allinDelta: event.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">原因</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={form.reason}
                      onChange={(event) => setForm({ ...form, reason: event.target.value })}
                      placeholder="例如：活动补偿 / 误扣修正 / 赛事补发"
                    />
                  </div>
                  <div className="col-12 d-grid">
                    <button
                      className="btn btn-warning"
                      type="button"
                      disabled={submitting}
                      onClick={submitAdjust}
                    >
                      {submitting ? '提交中...' : '确认调整'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-lg-6">
              <div style={panelStyle}>
                <h5>最近资金流水</h5>
                <div className="table-responsive">
                  <table className="table table-dark table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>时间</th>
                        <th>类型</th>
                        <th>资产</th>
                        <th>变动</th>
                        <th>余额后</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.recentLedger || []).map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.createdAt).toLocaleString()}</td>
                          <td>{item.entryType}</td>
                          <td>{item.asset}</td>
                          <td>{item.amount}</td>
                          <td>{item.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div style={panelStyle}>
                <h5>赛事记录</h5>
                <div className="table-responsive">
                  <table className="table table-dark table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>赛事</th>
                        <th>状态</th>
                        <th>报名时持仓</th>
                        <th>燃烧</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.registrations || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.tournamentTitle}</td>
                          <td>{item.status}</td>
                          <td>{item.holdAmountAtEntry}</td>
                          <td>{item.burnAmount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-light">加载中...</div>
      )}
    </div>
  );
};

export default AdminUserDetailPage;
