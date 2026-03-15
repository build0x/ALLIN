import React, { useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import contentContext from '@/context/content/contentContext';
import authContext from '@/context/auth/authContext';
import { LS_TOKEN } from '@/context/auth/AuthState';
import { getFriendlyWalletErrorMessage, getContractRevertReason, isRequireFalseRevert, callAllinGameCreateRoom, connectWallet, getWalletTokenBalance } from '@/utils/wallet';

const ROOM_DURATION_OPTIONS = [1, 2, 3, 6, 12, 24];
const HOURLY_BURN_AMOUNT = 10000;
const ALLIN_GAME_ROOM_FEE = 10000;
const DEFAULT_ALLIN_GAME_ADDRESS = '0x28dB2bE155C7EaeeEAA9289280f5B72BE5249529';
/** BSC 上 ALLIN 代币合约，后端未返回时兜底 */
const DEFAULT_ALLIN_TOKEN_ADDRESS = '0xbe3fd46ca68dc40be81ee30a866ae5592ed07777';

const Wrap = styled.div`
  width: min(92vw, 460px);
  max-height: min(88vh, 760px);
  overflow-y: auto;
  padding: 20px 18px 18px;
  border-radius: 22px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.12), transparent 34%),
    linear-gradient(160deg, rgba(26, 26, 26, 0.98) 0%, rgba(12, 12, 12, 0.98) 100%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  color: #f5f5f5;
`;

const Title = styled.div`
  color: #d4af37;
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 14px;
`;

const Label = styled.label`
  font-weight: 700;
  margin-top: 10px;
  color: #d4af37;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: 12px;
  background: rgba(17, 17, 17, 0.96);
  color: #ffffff;
  appearance: none;

  option {
    background: #121212;
    color: #ffffff;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: 12px;
  background: rgba(17, 17, 17, 0.96);
  color: #ffffff;
`;

const Button = styled.button`
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #f5d978 0%, #d4af37 55%, #8f6b14 100%);
  color: #0d0d0d;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  font-weight: 800;

  &:hover {
    background: linear-gradient(135deg, #ffe8a3 0%, #d4af37 55%, #7b5c10 100%);
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const HelperText = styled.small`
  color: #bfbfbf;
  display: block;
  margin-top: -8px;
  margin-bottom: 10px;
  line-height: 1.5;
`;

const BurnNotice = styled.div`
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 122, 89, 0.22);
  background: rgba(255, 122, 89, 0.08);
  color: #ffd7c8;
  font-size: 13px;
  line-height: 1.6;
`;

const CreateTableModal = ({
  existingTableId,
  context,
  closeModal,
  onSuccess,
  economyOverview: economyOverviewProp,
  walletSession: walletSessionProp,
  refreshEconomyOverview: refreshEconomyOverviewProp,
}) => {
  const { socketCtx } = context;
  const { socket } = socketCtx;
  const auth = useContext(authContext);
  const economyOverview = economyOverviewProp ?? auth?.economyOverview ?? null;
  const walletSession = walletSessionProp ?? auth?.walletSession ?? null;
  const refreshEconomyOverview = refreshEconomyOverviewProp ?? auth?.refreshEconomyOverview;
  useContext(contentContext);

  const [tableId, setTableId] = useState(-1);
  const [tableName, setTableName] = useState('');
  const [maxSeats, setMaxSeats] = useState(6);
  const [password, setPassword] = useState('');
  const [turnCountdown, setTurnCountdown] = useState(20);
  const [minBet, setMinBet] = useState(10);
  const [afterRoundCountdown, setAfterRoundCountdown] = useState(10);
  const [durationHours, setDurationHours] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chainWalletAllinBalance, setChainWalletAllinBalance] = useState(null);
  const allinGameAddress =
    economyOverview?.onchain?.allinGameAddress ||
    (typeof process.env.REACT_APP_ALLIN_GAME_ADDRESS === 'string' && process.env.REACT_APP_ALLIN_GAME_ADDRESS.trim()
      ? process.env.REACT_APP_ALLIN_GAME_ADDRESS.trim()
      : '') ||
    DEFAULT_ALLIN_GAME_ADDRESS;
  const selectedBurnAmount = allinGameAddress ? ALLIN_GAME_ROOM_FEE : durationHours * HOURLY_BURN_AMOUNT;

  const backendWalletAllin =
    typeof economyOverview?.userWallet?.walletAllinBalance === 'number'
      ? economyOverview.userWallet.walletAllinBalance
      : typeof economyOverview?.userWallet?.holdAmount === 'number'
        ? economyOverview.userWallet.holdAmount
        : typeof economyOverview?.userWallet?.allinBalance === 'number'
          ? economyOverview.userWallet.allinBalance
          : 0;
  const tokenAddress =
    economyOverview?.onchain?.allinTokenAddress ||
    DEFAULT_ALLIN_TOKEN_ADDRESS ||
    null;
  const walletAllinBalance = Math.max(
    backendWalletAllin,
    typeof chainWalletAllinBalance === 'number' ? chainWalletAllinBalance : 0
  );
  const hasEnoughAllinForBurn = walletAllinBalance >= selectedBurnAmount;

  useEffect(() => {
    if (socket) {
      regSocketMessageHandler(socket);
      if (existingTableId > 0) {
        setTableId(existingTableId);
        const token = localStorage.getItem(LS_TOKEN);
        socket.send(
          JSON.stringify({
            key: 'getUserTable',
            token,
            tableId: existingTableId,
          })
        );
      }
    }
  }, [socket, existingTableId]);

  // 打开弹窗时刷新经济概览（后端用 RPC 读当前钱包 ALLIN，与大厅一致）
  useEffect(() => {
    refreshEconomyOverview?.();
  }, [refreshEconomyOverview]);

  // 用当前连接钱包从链上读 ALLIN 余额，与后端结果取大，避免后端返回 0 时误拦
  useEffect(() => {
    if (!walletSession?.walletId || !tokenAddress) {
      setChainWalletAllinBalance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const walletConnection = await connectWallet(walletSession.walletId);
        const address = walletConnection?.address;
        if (!address || !walletConnection?.provider) {
          if (!cancelled) setChainWalletAllinBalance(null);
          return;
        }
        const balance = await getWalletTokenBalance({
          provider: walletConnection.provider,
          tokenAddress,
          walletAddress: address,
        });
        if (!cancelled) setChainWalletAllinBalance(balance);
      } catch {
        if (!cancelled) setChainWalletAllinBalance(null);
      }
    })();
    return () => { cancelled = true; };
  }, [walletSession?.walletId, tokenAddress]);

  const regSocketMessageHandler = (socket) => {
    socket.handle('getUserTable', (jsonData) => tableData(jsonData.data));

    socket.handle('createUpdateUserTable', (jsonData) => createUpdateTableResult(jsonData.data));
  };

  function tableData(data) {
    const table = data.table;
    if (table) {
      setTableId(table.id);
      setTableName(table.tableName || '');
      setPassword(table.password || '');
      setTurnCountdown(table.turnCountdown || 20);
      setMinBet(table.minBet || 10);
      setAfterRoundCountdown(table.afterRoundCountdown || 10);
      setDurationHours(
        Math.max(1, Number(table.durationHours || table.burnAmount / HOURLY_BURN_AMOUNT || 1))
      );
    }
  }

  const isNetworkError = (msg) => {
    if (typeof msg !== 'string') return false;
    return (
      msg.includes('ECONNRESET') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('socket hang up')
    );
  };

  function createUpdateTableResult(data) {
    setIsSubmitting(false);
    if (data.success) {
      toast.success(existingTableId > 0 ? '房间设置已保存' : '好友房创建成功');
      onSuccess?.(data.table, data);
      closeModal();
    } else {
      let msg = data.message || '创建房间失败';
      if (msg === 'ALLIN_GAME_REQUIRED') {
        msg = '请先完成链上支付：在钱包中授权并确认「创建房间」交易后再提交';
      } else if (msg === 'WALLET_REQUIRED') {
        msg = '请先使用「钱包登录」连接并签名，再创建房间（后台需关联钱包地址才能记录房间）';
      }
      if (!isNetworkError(msg)) toast.error(msg);
    }
  }

  function createUpdateTable(tableData) {
    const token = localStorage.getItem(LS_TOKEN);
    if (socket && token) {
      const data = JSON.stringify({
        key: 'createUpdateUserTable',
        token: token,
        tableData,
      });
      socket.send(data);
    }
  }

  const handleCreateTable = async () => {
    if (!tableName) {
      toast.error('请先填写房间名称');
      return;
    }
    if (Number(minBet || 0) <= 0) {
      toast.error('最低下注金额必须大于 0');
      return;
    }
    const tableData = {
      id: tableId,
      game: 'HOLDEM',
      tableName,
      maxSeats,
      botCount: 0,
      password,
      turnCountdown,
      minBet,
      afterRoundCountdown,
      discardAndDrawTimeout: 20,
      durationHours: allinGameAddress ? 24 : durationHours,
    };
    const isNewRoom = existingTableId == null || existingTableId <= 0;
    const needBurn = isNewRoom && selectedBurnAmount > 0;
    if (needBurn) {
      const tokenAddress = economyOverview?.onchain?.allinTokenAddress;
      if (!walletSession?.walletId) {
        toast.error('请先连接钱包');
        return;
      }
      if (!tokenAddress) {
        toast.error('链上配置未就绪，暂无法创建好友房');
        return;
      }
      if (!hasEnoughAllinForBurn) {
        toast.error('钱包 ALLIN 不足，创建房间需一次性燃烧 10,000 ALLIN');
        return;
      }
      try {
        setIsSubmitting(true);
        const { txHash } = await callAllinGameCreateRoom({
          walletId: walletSession.walletId,
          tokenAddress: tokenAddress || undefined,
          allinGameAddress,
          expectedWalletAddress: economyOverview?.userWallet?.walletAddress,
        });
        createUpdateTable({ ...tableData, paidViaAllinGame: true, txHash });
        // 若后端长时间未响应，15 秒后恢复按钮，避免一直“创建中”
        setTimeout(() => setIsSubmitting(false), 15000);
      } catch (err) {
        setIsSubmitting(false);
        let msg = getFriendlyWalletErrorMessage(err) || err?.message || '操作失败';
        const rawMsg = String(err?.message || '');
        if (rawMsg.includes('授权未生效')) {
          msg = rawMsg;
        } else if (
          rawMsg.includes('revert') ||
          rawMsg.includes('require(false)') ||
          rawMsg.includes('execution reverted')
        ) {
          const reason = getContractRevertReason(err);
          if (reason && !reason.includes('require(false)')) {
            if (reason.includes('ALLOWANCE') || reason.includes('allowance')) {
              msg = '请先在钱包中确认「授权」交易，再点击创建并确认「创建房间」交易';
            } else if (reason.includes('INSUFFICIENT') || reason.includes('balance')) {
              msg = '钱包 ALLIN 不足 10,000，请充值后再创建房间';
            } else {
              msg = `链上交易失败：${reason}`;
            }
          } else if (isRequireFalseRevert(err)) {
            msg =
              '合约执行被拒绝（require(false)）。请确认：① 钱包已切到 BSC 主网 ② 已在钱包中先点「授权」再点「创建房间」两次确认 ③ 若仍失败，可能是代币合约限制了转入 AllinGame，需在 BSCScan 上查看该笔交易详情';
          } else {
            msg =
              '链上交易失败：请确认已在钱包中完成「授权」与「创建房间」两次确认';
          }
        }
        if (!String(msg).includes('取消') && !String(msg).includes('拒绝')) {
          toast.error(msg);
        } else {
          toast.info('已取消或拒绝，可重新点击创建');
        }
      }
    } else {
      try {
        setIsSubmitting(true);
        createUpdateTable(tableData);
      } catch (e) {
        setIsSubmitting(false);
        toast.error(e?.message || '创建失败，请重试');
      }
    }
  };

  const isNewRoom = existingTableId == null || existingTableId <= 0;
  const needBurn = isNewRoom && selectedBurnAmount > 0;
  // 需要燃烧时：未连接钱包或余额不足则禁用按钮；其余只根据房间名和提交状态
  const canSubmit =
    Boolean(tableName) &&
    !isSubmitting &&
    (!needBurn || (Boolean(walletSession?.walletId) && hasEnoughAllinForBurn));

  return (
    <Wrap>
      <Title>{existingTableId > 0 ? '编辑好友房' : '创建好友房'}</Title>
      <HelperText>当前只支持创建德州扑克好友房，可设置座位数、房间密码和最低下注。</HelperText>
      <BurnNotice>
        {existingTableId > 0
          ? '亲友房到时会在当前牌局结算后自动关闭，已创建房间的时长和燃烧费用不再变更。'
          : allinGameAddress
            ? '创建亲友房一次性燃烧 10,000 ALLIN，即可创建。'
            : `创建亲友房一次性燃烧 10,000 ALLIN，房间有效期 ${durationHours} 小时，到时会在当前牌局结算后自动关闭。`}
      </BurnNotice>
      {existingTableId <= 0 && (
        <HelperText style={{ marginBottom: 10 }}>
          当前钱包 ALLIN：{Number(walletAllinBalance).toLocaleString('zh-CN')}
          {!hasEnoughAllinForBurn && selectedBurnAmount > 0 && (
            <span style={{ color: 'var(--bs-danger)', marginLeft: 8 }}>
              （不足 {selectedBurnAmount.toLocaleString('zh-CN')}，请先充值或兑换）
            </span>
          )}
        </HelperText>
      )}

      <Label htmlFor="tableName">房间名称</Label>
      <Input
        id="tableName"
        type="text"
        placeholder="输入房间名称，最多 20 个字符"
        value={tableName}
        maxLength={20}
        onChange={(e) => setTableName(e.target.value)}
      />
      <HelperText>这个名字会显示在大厅房间列表里。</HelperText>

      <Label htmlFor="maxSeats">座位数</Label>
      <Select id="maxSeats" value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))}>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
      </Select>
      <HelperText>表示这个房间最多允许几名玩家同时入座。</HelperText>

      {!allinGameAddress && (
        <>
          <Label htmlFor="durationHours">房间有效期</Label>
          <Select
            id="durationHours"
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
            disabled={existingTableId > 0}
          >
            {ROOM_DURATION_OPTIONS.map((hours) => (
              <option key={hours} value={hours}>
                {hours} 小时
              </option>
            ))}
          </Select>
          <HelperText>
            房间有效期，到期后在当前牌局结算后自动关闭。创建时一次性燃烧 10,000 ALLIN。
          </HelperText>
        </>
      )}
      {allinGameAddress && (
        <HelperText style={{ marginBottom: 10 }}>
          创建时一次性燃烧 10,000 ALLIN，无需选择时长。
        </HelperText>
      )}

      <Label htmlFor="password">房间密码</Label>
      <Input
        id="password"
        type="text"
        placeholder="可选，不填就是公开房间"
        value={password}
        maxLength={20}
        onChange={(e) => setPassword(e.target.value)}
      />
      <HelperText>设置后，其他玩家进入房间前需要先输入密码。</HelperText>

      <Label htmlFor="turnCountdown">行动倒计时</Label>
      <Input
        id="turnCountdown"
        type="number"
        value={turnCountdown}
        onChange={(e) => setTurnCountdown(Number(e.target.value))}
      />
      <HelperText>每位玩家轮到自己操作时，可思考的秒数。</HelperText>

      <Label htmlFor="minBet">最低下注</Label>
      <Input
        id="minBet"
        type="number"
        value={minBet}
        onChange={(e) => setMinBet(Number(e.target.value))}
      />
      <HelperText>进入这个房间后，每局使用的基础下注金额。</HelperText>

      <Label htmlFor="afterRoundCountdown">回合结束停留时间</Label>
      <Input
        id="afterRoundCountdown"
        type="number"
        value={afterRoundCountdown}
        onChange={(e) => setAfterRoundCountdown(Number(e.target.value))}
      />
      <HelperText>一局打完后，在自动开始下一局前停留多少秒。</HelperText>

      <Button className="mt-2" onClick={handleCreateTable} disabled={!canSubmit}>
        {isSubmitting
          ? '正在燃烧代币创建中'
          : needBurn && !walletSession?.walletId
            ? '请先连接钱包'
            : needBurn && !hasEnoughAllinForBurn
              ? '钱包 ALLIN 不足，无法创建'
              : existingTableId > 0
                ? '保存房间设置'
                : '创建房间'}
      </Button>
    </Wrap>
  );
};

export default CreateTableModal;
