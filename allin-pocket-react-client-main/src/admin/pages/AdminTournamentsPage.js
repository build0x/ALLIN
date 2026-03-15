import React, { useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import adminContext from '@/admin/adminContext';

const panelStyle = {
  borderRadius: '16px',
  background: '#111',
  border: '1px solid rgba(212,175,55,0.18)',
  padding: '18px',
};

const AdminTournamentsPage = () => {
  const {
    getTournaments,
    getTournamentDetail,
    updateTournament,
    registerTournamentUser,
    cancelTournamentRegistration,
    advanceTournament,
    resetTournament,
    generateTournamentStrategy,
    applyTournamentStrategy,
    rejectTournamentStrategy,
    fillTournamentBots,
  } = useContext(adminContext);
  const [tournaments, setTournaments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [registerUserId, setRegisterUserId] = useState('');
  const [botFillCount, setBotFillCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    status: '',
    requiredHoldAmount: '',
    buyInAllin: '',
    burnAmount: '',
    bnbPrizeAmount: '',
    minPlayers: '',
    maxPlayers: '',
    registrationOpensAt: '',
    startsAt: '',
  });

  const loadList = async () => {
    const result = await getTournaments();
    setTournaments(result);
    if (!selectedId && result.length) {
      setSelectedId(result[0].id);
    }
  };

  const loadDetail = async (tournamentId) => {
    const result = await getTournamentDetail(tournamentId);
    setDetail(result);
    const tournament = result.tournament;
    setForm({
      title: tournament.title || '',
      status: tournament.status || '',
      requiredHoldAmount: tournament.requiredHoldAmount ?? '',
      buyInAllin: tournament.buyInAllin ?? '',
      burnAmount: tournament.burnAmount ?? '',
      bnbPrizeAmount: tournament.bnbPrizeAmount ?? '',
      minPlayers: tournament.minPlayers ?? '',
      maxPlayers: tournament.maxPlayers ?? '',
      registrationOpensAt: tournament.registrationOpensAt
        ? new Date(tournament.registrationOpensAt).toISOString().slice(0, 16)
        : '',
      startsAt: tournament.startsAt ? new Date(tournament.startsAt).toISOString().slice(0, 16) : '',
    });
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [selectedId]);

  const submitUpdate = async () => {
    try {
      const confirmed = window.confirm('确认保存赛事配置吗？');
      if (!confirmed) {
        return;
      }
      setSaving(true);
      await updateTournament(selectedId, form);
      toast.success('赛事配置已更新');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '赛事更新失败');
    } finally {
      setSaving(false);
    }
  };

  const submitRegister = async () => {
    try {
      const confirmed = window.confirm(`确认给用户 ${registerUserId} 报名当前赛事吗？`);
      if (!confirmed) {
        return;
      }
      await registerTournamentUser(selectedId, registerUserId);
      toast.success('已为用户报名赛事');
      setRegisterUserId('');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '报名失败');
    }
  };

  const submitAdvance = async () => {
    try {
      const confirmed = window.confirm('确认手动推进该赛事状态吗？');
      if (!confirmed) {
        return;
      }
      await advanceTournament(selectedId);
      toast.success('已推进赛事状态');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '推进失败');
    }
  };

  const cancelRegistration = async (userId) => {
    try {
      const confirmed = window.confirm(`确认取消用户 ${userId} 的报名并退款吗？`);
      if (!confirmed) {
        return;
      }
      await cancelTournamentRegistration(selectedId, userId);
      toast.success('已取消报名并退款');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '取消报名失败');
    }
  };

  const submitFillBots = async () => {
    try {
      const confirmed = window.confirm('确认为当前赛事补充测试机器人报名吗？');
      if (!confirmed) {
        return;
      }
      await fillTournamentBots(selectedId, {
        count: botFillCount ? Number(botFillCount) : undefined,
      });
      toast.success('已补充测试机器人报名');
      setBotFillCount('');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '补充机器人失败');
    }
  };

  const generateStrategy = async () => {
    try {
      await generateTournamentStrategy(selectedId);
      toast.success('已生成 AI 奖励建议');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '生成建议失败');
    }
  };

  const applyStrategy = async () => {
    try {
      const confirmed = window.confirm('确认采用当前 AI 奖励模板建议吗？');
      if (!confirmed) {
        return;
      }
      await applyTournamentStrategy(selectedId);
      toast.success('已采用 AI 奖励建议');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '采用建议失败');
    }
  };

  const rejectStrategy = async () => {
    try {
      const confirmed = window.confirm('确认忽略当前 AI 奖励模板建议吗？');
      if (!confirmed) {
        return;
      }
      await rejectTournamentStrategy(selectedId);
      toast.success('已忽略当前建议');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '忽略建议失败');
    }
  };

  const submitReset = async () => {
    try {
      const confirmed = window.confirm(
        '赛事重置将：清空当前届所有报名、退还报名费、清除燃烧记录，并开启新一届（约 30 分钟后开始）。确认执行吗？'
      );
      if (!confirmed) {
        return;
      }
      await resetTournament(selectedId);
      toast.success('赛事已重置，新一届已开启');
      await loadList();
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error.message || '赛事重置失败');
    }
  };

  return (
    <div>
      <h2 className="mb-3" style={{ fontWeight: 900 }}>
        锦标赛管理
      </h2>
      <div className="row g-3">
        <div className="col-lg-4">
          <div style={panelStyle}>
            <h5>赛事列表</h5>
            <div style={{ display: 'grid', gap: '10px' }}>
              {tournaments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`btn ${selectedId === item.id ? 'btn-warning' : 'btn-outline-warning'}`}
                  onClick={() => setSelectedId(item.id)}
                  style={{ textAlign: 'left' }}
                >
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: '13px' }}>
                    {item.status} · 当前届 {item.currentEdition} · 报名 {item.registrationCount}/
                    {item.maxPlayers}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          {detail ? (
            <div style={panelStyle}>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="mb-0">赛事配置</h5>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-warning btn-sm"
                    type="button"
                    onClick={submitAdvance}
                  >
                    手动推进状态
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    type="button"
                    onClick={submitReset}
                    title="清空当前届报名并退款，开启新一届"
                  >
                    赛事重置
                  </button>
                </div>
              </div>

              <div
                className="mb-4 p-3 rounded"
                style={{ border: '1px solid rgba(212,175,55,0.16)', background: '#0d0d0d' }}
              >
                <div style={{ fontSize: '14px', color: '#f5f5f5', marginBottom: '8px' }}>
                  当前届次：{detail.tournament.currentEdition}
                </div>
                <div style={{ fontSize: '13px', color: '#bfbfbf', marginBottom: '8px' }}>
                  当前桌数：{detail.tournament.currentTableCount || 0} | 当前轮次：
                  {detail.tournament.currentRound || 0} | 奖池分配：
                  {(detail.tournament.prizeDistribution || [])
                    .map(
                      (item) =>
                        `${item.label} ${Math.round(Number(item.percent || 0) * 100)}% (${item.amount} BNB)`
                    )
                    .join(' / ')}
                </div>
                <div style={{ fontSize: '13px', color: '#bfbfbf' }}>
                  报名门槛大于 {detail.tournament.requiredHoldAmount} ALLIN，报名费
                  {detail.tournament.buyInAllin} ALLIN，奖池取全局 BNB 奖池的
                  {detail.tournament.prizePoolSharePercent}%。
                </div>
              </div>

              <div
                className="mb-4 p-3 rounded"
                style={{ border: '1px solid rgba(212,175,55,0.16)', background: '#0d0d0d' }}
              >
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <h6 className="mb-0">AI 奖励建议</h6>
                  <button
                    className="btn btn-outline-warning btn-sm"
                    type="button"
                    onClick={generateStrategy}
                  >
                    重新生成建议
                  </button>
                </div>
                {detail.tournament.strategyRecommendation ? (
                  <>
                    <div style={{ fontSize: '14px', color: '#f5f5f5', marginBottom: '8px' }}>
                      模板：{detail.tournament.strategyRecommendation.templateLabel}（
                      {detail.tournament.strategyRecommendation.templateCode}）
                    </div>
                    <div style={{ fontSize: '13px', color: '#bfbfbf', marginBottom: '8px' }}>
                      状态：{detail.tournament.strategyRecommendation.status} | 提供方：
                      {detail.tournament.strategyRecommendation.provider} | 模式：
                      {detail.tournament.strategyRecommendation.providerMode}
                    </div>
                    <div style={{ fontSize: '13px', color: '#bfbfbf', marginBottom: '8px' }}>
                      预计成本：{detail.tournament.strategyRecommendation.estimatedCostBnb} BNB
                    </div>
                    <div style={{ fontSize: '13px', color: '#f5f5f5', marginBottom: '8px' }}>
                      {`建议奖励：${detail.tournament.strategyRecommendation.recommendedPatch?.bnbPrizeAmount ?? '--'} BNB`}
                    </div>
                    <div style={{ fontSize: '13px', color: '#bfbfbf', marginBottom: '8px' }}>
                      {detail.tournament.strategyRecommendation.decisionSummary}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#8f8f8f',
                        marginBottom: '8px',
                        wordBreak: 'break-all',
                      }}
                    >
                      CID：
                      {detail.tournament.strategyRecommendation.reasoningCid ||
                        '暂未回填（当前为试点 mock 模式）'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8f8f8f', marginBottom: '12px' }}>
                      Prompt：{detail.tournament.strategyRecommendation.promptPreview}
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        className="btn btn-warning btn-sm"
                        type="button"
                        disabled={detail.tournament.strategyRecommendation.status !== 'recommended'}
                        onClick={applyStrategy}
                      >
                        采用建议
                      </button>
                      <button
                        className="btn btn-outline-light btn-sm"
                        type="button"
                        disabled={detail.tournament.strategyRecommendation.status !== 'recommended'}
                        onClick={rejectStrategy}
                      >
                        忽略建议
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: '#bfbfbf' }}>
                    当前还没有 AI 奖励建议，可先手动生成一次。
                  </div>
                )}
                {detail.tournament.rewardTemplates?.length ? (
                  <div className="mt-3" style={{ fontSize: '12px', color: '#9f9f9f' }}>
                    可用模板：
                    {detail.tournament.rewardTemplates
                      .map((item) => `${item.label}(${item.code}, x${item.prizeMultiplier})`)
                      .join(' / ')}
                  </div>
                ) : null}
              </div>

              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">标题</label>
                  <input
                    className="form-control"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">状态</label>
                  <input
                    className="form-control"
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">持仓门槛</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.requiredHoldAmount}
                    onChange={(event) =>
                      setForm({ ...form, requiredHoldAmount: event.target.value })
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">报名费</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.buyInAllin}
                    onChange={(event) => setForm({ ...form, buyInAllin: event.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">燃烧</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.burnAmount}
                    onChange={(event) => setForm({ ...form, burnAmount: event.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">预计奖池</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.bnbPrizeAmount}
                    onChange={(event) => setForm({ ...form, bnbPrizeAmount: event.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">最少人数</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.minPlayers}
                    onChange={(event) => setForm({ ...form, minPlayers: event.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">最多人数</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.maxPlayers}
                    onChange={(event) => setForm({ ...form, maxPlayers: event.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">报名开放时间</label>
                  <input
                    className="form-control"
                    type="datetime-local"
                    value={form.registrationOpensAt}
                    onChange={(event) =>
                      setForm({ ...form, registrationOpensAt: event.target.value })
                    }
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">开赛时间</label>
                  <input
                    className="form-control"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                  />
                </div>
                <div className="col-12 d-grid">
                  <button
                    className="btn btn-warning"
                    type="button"
                    disabled={saving}
                    onClick={submitUpdate}
                  >
                    {saving ? '保存中...' : '保存赛事配置'}
                  </button>
                </div>
              </div>

              <hr className="border-secondary my-4" />

              <h5>管理员报名</h5>
              <div className="row g-2 mb-3">
                <div className="col-md-8">
                  <input
                    className="form-control"
                    type="number"
                    value={registerUserId}
                    onChange={(event) => setRegisterUserId(event.target.value)}
                    placeholder="输入用户 ID"
                  />
                </div>
                <div className="col-md-4 d-grid">
                  <button
                    className="btn btn-outline-warning"
                    type="button"
                    onClick={submitRegister}
                  >
                    为该用户报名
                  </button>
                </div>
              </div>

              <h5>测试机器人报名</h5>
              <div className="row g-2 mb-3">
                <div className="col-md-8">
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    value={botFillCount}
                    onChange={(event) => setBotFillCount(event.target.value)}
                    placeholder="留空则自动补满"
                  />
                </div>
                <div className="col-md-4 d-grid">
                  <button
                    className="btn btn-outline-warning"
                    type="button"
                    onClick={submitFillBots}
                  >
                    填充机器人
                  </button>
                </div>
              </div>

              <h5>当前分桌</h5>
              {(detail.tournament.currentTables || []).length ? (
                <div className="row g-2 mb-4">
                  {detail.tournament.currentTables.map((table) => (
                    <div className="col-md-6" key={table.tableNo}>
                      <div
                        className="p-3 rounded h-100"
                        style={{
                          border: '1px solid rgba(212,175,55,0.16)',
                          background: '#0d0d0d',
                        }}
                      >
                        <div style={{ color: '#d4af37', fontWeight: 700 }}>
                          第 {table.tableNo} 桌
                        </div>
                        <div style={{ fontSize: '12px', color: '#bfbfbf', marginTop: '4px' }}>
                          人数 {table.playerCount}
                        </div>
                        <div className="mt-2 d-flex flex-column gap-1">
                          {table.players.map((player) => (
                            <div
                              key={`${table.tableNo}-${player.userId}`}
                              style={{ fontSize: '13px' }}
                            >
                              {player.seatNo} 号位 ·{' '}
                              {player.username || player.walletAddress || player.userId} ·{' '}
                              {player.status}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-4" style={{ color: '#bfbfbf', fontSize: '13px' }}>
                  当前尚未分桌。
                </div>
              )}

              <h5>历届前三</h5>
              {(detail.tournament.historyTop3 || []).length ? (
                <div className="row g-2 mb-4">
                  {detail.tournament.historyTop3.map((entry) => (
                    <div className="col-md-6" key={entry.editionKey}>
                      <div
                        className="p-3 rounded h-100"
                        style={{
                          border: '1px solid rgba(212,175,55,0.16)',
                          background: '#0d0d0d',
                        }}
                      >
                        <div style={{ color: '#d4af37', fontWeight: 700 }}>{entry.editionKey}</div>
                        <div style={{ fontSize: '12px', color: '#bfbfbf', marginTop: '4px' }}>
                          奖池 {entry.prizePoolBnb} BNB | 结算{' '}
                          {entry.settledAt ? new Date(entry.settledAt).toLocaleString() : '-'}
                        </div>
                        <div className="mt-2 d-flex flex-column gap-1">
                          {(entry.top3 || []).map((item) => (
                            <div
                              key={`${entry.editionKey}-${item.rank}`}
                              style={{ fontSize: '13px' }}
                            >
                              {item.rank} 名 · {item.username || item.walletAddress || item.userId}{' '}
                              · {item.payoutBnb} BNB
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-4" style={{ color: '#bfbfbf', fontSize: '13px' }}>
                  暂无历届前三记录。
                </div>
              )}

              <h5>锦标赛排名榜</h5>
              {(detail.tournament.leaderboard || []).length ? (
                <div className="table-responsive mb-4">
                  <table className="table table-dark table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>用户</th>
                        <th>冠军数</th>
                        <th>前三次数</th>
                        <th>累计 BNB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.tournament.leaderboard.map((item, index) => (
                        <tr key={`${item.userId}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{item.username || item.walletAddress || item.userId}</td>
                          <td>{item.titles}</td>
                          <td>{item.top3Count}</td>
                          <td>{item.totalPayoutBnb}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mb-4" style={{ color: '#bfbfbf', fontSize: '13px' }}>
                  暂无锦标赛排行榜数据。
                </div>
              )}

              <h5>报名列表</h5>
              <div className="table-responsive">
                <table className="table table-dark table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>用户ID</th>
                      <th>届次</th>
                      <th>用户名</th>
                      <th>钱包</th>
                      <th>状态</th>
                      <th>桌位</th>
                      <th>报名持仓</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.registrations.map((item) => (
                      <tr key={item.id}>
                        <td>{item.userId}</td>
                        <td>{item.editionKey}</td>
                        <td>{item.username || '-'}</td>
                        <td style={{ maxWidth: '180px', wordBreak: 'break-all' }}>
                          {item.walletAddress || '-'}
                        </td>
                        <td>{item.status}</td>
                        <td>
                          {item.tableNo ? `桌 ${item.tableNo} / 座 ${item.seatNo || '-'}` : '-'}
                        </td>
                        <td>{item.holdAmountAtEntry}</td>
                        <td>
                          {item.status !== 'cancelled' ? (
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => cancelRegistration(item.userId)}
                            >
                              取消报名
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-light">加载中...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTournamentsPage;
