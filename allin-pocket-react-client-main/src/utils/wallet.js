import * as ethers from 'ethers';

const BSC_CHAIN_ID = '0x38';
const ALLIN_DECIMALS = 18;
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];
const TREASURY_VAULT_ABI = ['function deposit(uint256 amount, bytes32 depositId) external'];
const ALLIN_GAME_ABI = [
  'function createRoom() external',
  'function registerTournament() external',
  'function roomCreationFee() view returns (uint256)',
  'function tournamentFee() view returns (uint256)',
];

export const LS_CONNECTED_WALLET_ID = 'ALLIN_CONNECTED_WALLET_ID';

const BSC_NETWORK_PARAMS = {
  chainId: BSC_CHAIN_ID,
  chainName: 'BNB Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/', 'https://bsc-dataseed1.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

const getInjectedProviders = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  const ethereum = window.ethereum;
  if (!ethereum) {
    return [];
  }

  if (Array.isArray(ethereum.providers) && ethereum.providers.length) {
    return ethereum.providers;
  }

  return [ethereum];
};

export const getAvailableWallets = () => {
  const providers = getInjectedProviders();

  return [
    {
      id: 'metamask',
      name: 'MetaMask',
      provider: providers.find((item) => item.isMetaMask) || null,
    },
    {
      id: 'okx',
      name: 'OKX Wallet',
      provider: providers.find((item) => item.isOkxWallet || item.isOKExWallet) || null,
    },
    {
      id: 'binance',
      name: 'Binance Web3 Wallet',
      provider: providers.find((item) => item.isBinance) || null,
    },
  ];
};

const getWalletById = (walletId) =>
  getAvailableWallets().find((item) => item.id === walletId) || null;

const getErrorCode = (error) => {
  if (typeof error?.code === 'number') {
    return error.code;
  }

  if (typeof error?.code === 'string' && !Number.isNaN(Number(error.code))) {
    return Number(error.code);
  }

  return null;
};

/**
 * 从合约 revert 中取出原因（ethers 常在 reason / shortMessage 中；require(false) 时可能无文案）
 * @param {unknown} error
 * @returns {string|null}
 */
export const getContractRevertReason = (error) => {
  const s = String(error?.reason ?? error?.shortMessage ?? error?.message ?? '');
  if (!s || s.length > 200) return null;
  return s.trim() || null;
};

/** 是否为“无具体原因”的合约 revert（如 require(false)） */
export const isRequireFalseRevert = (error) => {
  const msg = String(error?.message ?? error?.reason ?? '');
  return msg.includes('require(false)') || msg.includes('execution reverted') || msg.includes('revert');
};

/**
 * 将钱包/链上错误转为对用户友好的中文提示，避免展示 ethers 等库的原始技术信息。
 * @param {unknown} error
 * @returns {string|null} 友好文案，若无法识别则返回 null，由调用方使用 error.message 等
 */
export const getFriendlyWalletErrorMessage = (error) => {
  const code = getErrorCode(error);
  const codeStr = error?.code;
  const msg = String(error?.message || error?.reason || '');

  if (code === 4001 || codeStr === 'ACTION_REJECTED') {
    return '您已取消操作';
  }
  if (msg.includes('user rejected') || msg.includes('User denied') || msg.includes('rejected')) {
    return '您已取消操作';
  }
  if (msg.includes('已取消')) {
    return msg;
  }
  return null;
};

const persistWalletId = (walletId) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_CONNECTED_WALLET_ID, walletId);
  }
};

export const clearWalletSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LS_CONNECTED_WALLET_ID);
  }
};

const ensureBscNetwork = async (walletProvider) => {
  const currentChainId = await walletProvider.request({ method: 'eth_chainId' });
  if (currentChainId === BSC_CHAIN_ID) {
    return;
  }

  try {
    await walletProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID }],
    });
  } catch (switchError) {
    const switchErrorCode = getErrorCode(switchError);

    if (switchErrorCode === 4001) {
      throw new Error('已取消切换到 BSC，无法继续连接');
    }

    if (switchErrorCode === 4902) {
      try {
        await walletProvider.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_NETWORK_PARAMS],
        });
      } catch (addError) {
        const addErrorCode = getErrorCode(addError);
        if (addErrorCode === 4001) {
          throw new Error('已取消添加 BSC 网络，无法继续连接');
        }

        throw new Error('添加 BSC 网络失败，请在钱包中手动切换到 BSC');
      }
    } else {
      throw new Error('当前钱包不在 BSC，请先切换到 BSC 主网');
    }
  }

  const nextChainId = await walletProvider.request({ method: 'eth_chainId' });
  if (nextChainId !== BSC_CHAIN_ID) {
    throw new Error('当前钱包不在 BSC，请先切换到 BSC 主网');
  }
};

export const connectWallet = async (walletId) => {
  const wallet = getWalletById(walletId);
  if (!wallet?.provider) {
    throw new Error('未检测到钱包插件');
  }

  const walletProvider = wallet.provider;
  const provider = new ethers.BrowserProvider(walletProvider);
  try {
    await provider.send('eth_requestAccounts', []);
  } catch (error) {
    if (getErrorCode(error) === 4001) {
      throw new Error('已取消钱包授权');
    }

    throw new Error('钱包连接失败，请稍后重试');
  }

  await ensureBscNetwork(walletProvider);

  const readyProvider = new ethers.BrowserProvider(walletProvider);
  const signer = await readyProvider.getSigner();
  const address = await signer.getAddress();
  persistWalletId(walletId);

  return {
    wallet,
    provider: readyProvider,
    signer,
    address,
  };
};

export const restoreWalletSession = async () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const walletId = localStorage.getItem(LS_CONNECTED_WALLET_ID);
  if (!walletId) {
    return null;
  }

  const wallet = getWalletById(walletId);
  if (!wallet?.provider) {
    return null;
  }

  const accounts = await wallet.provider.request({ method: 'eth_accounts' });
  if (!Array.isArray(accounts) || !accounts.length) {
    return null;
  }

  await ensureBscNetwork(wallet.provider);
  const provider = new ethers.BrowserProvider(wallet.provider);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return {
    wallet,
    provider,
    signer,
    address,
  };
};

export const createTreasuryDepositId = (walletAddress) =>
  ethers.id(`treasury-deposit:${walletAddress}:${Date.now()}:${Math.random()}`);

/** 创建房间：先授权 AllinGame 再调 createRoom()，一次性燃烧 1 万（用户直接调合约） */
export const callAllinGameCreateRoom = async ({
  walletId,
  tokenAddress,
  allinGameAddress,
  expectedWalletAddress,
}) => {
  if (!walletId) throw new Error('请先连接钱包');
  if (!tokenAddress || !allinGameAddress) throw new Error('链上配置未完成');
  const ROOM_FEE = 10000;
  const amountInUnits = ethers.parseUnits(String(ROOM_FEE), ALLIN_DECIMALS);
  const walletConnection = await connectWallet(walletId);
  if (expectedWalletAddress) {
    const expected = String(expectedWalletAddress).toLowerCase();
    const actual = String(walletConnection.address || '').toLowerCase();
    if (expected && actual && expected !== actual) {
      throw new Error('当前连接的钱包与登录账户不一致，请切换回原钱包或重新登录');
    }
  }
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, walletConnection.signer);
  let currentAllowance = await tokenContract.allowance(walletConnection.address, allinGameAddress);
  if (currentAllowance < amountInUnits) {
    const maxApproval = 2n ** 256n - 1n;
    const approvalTx = await tokenContract.approve(allinGameAddress, maxApproval);
    await approvalTx.wait();
    // 授权已上链，直接发起创建房间交易（不再复检 allowance，避免 RPC 延迟导致误报）
  }
  const gameContract = new ethers.Contract(allinGameAddress, ALLIN_GAME_ABI, walletConnection.signer);
  const tx = await gameContract.createRoom();
  await tx.wait();
  return { txHash: tx.hash };
};

/** 报名锦标赛：先 approve(AllinGame) 再调 registerTournament()，扣 10 万转 DEAD（用户直接调合约） */
export const callAllinGameRegisterTournament = async ({
  walletId,
  tokenAddress,
  allinGameAddress,
  expectedWalletAddress,
}) => {
  if (!walletId) throw new Error('请先连接钱包');
  if (!tokenAddress || !allinGameAddress) throw new Error('链上配置未完成');
  const TOURNAMENT_FEE = 100000;
  const amountInUnits = ethers.parseUnits(String(TOURNAMENT_FEE), ALLIN_DECIMALS);
  const walletConnection = await connectWallet(walletId);
  if (expectedWalletAddress) {
    const expected = String(expectedWalletAddress).toLowerCase();
    const actual = String(walletConnection.address || '').toLowerCase();
    if (expected && actual && expected !== actual) {
      throw new Error('当前连接的钱包与登录账户不一致，请切换回原钱包或重新登录');
    }
  }
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, walletConnection.signer);
  let currentAllowance = await tokenContract.allowance(walletConnection.address, allinGameAddress);
  if (currentAllowance < amountInUnits) {
    const maxApproval = 2n ** 256n - 1n;
    const approvalTx = await tokenContract.approve(allinGameAddress, maxApproval);
    await approvalTx.wait();
    // 授权已上链，直接发起报名交易（不再复检 allowance，避免 RPC 延迟导致无第二次弹窗）
  }
  const gameContract = new ethers.Contract(allinGameAddress, ALLIN_GAME_ABI, walletConnection.signer);
  const tx = await gameContract.registerTournament();
  await tx.wait();
  return { txHash: tx.hash };
};

export const getWalletTokenBalance = async ({ provider, tokenAddress, walletAddress }) => {
  if (!provider || !tokenAddress || !walletAddress) {
    return 0;
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await tokenContract.balanceOf(walletAddress);
  return Number(ethers.formatUnits(balance, ALLIN_DECIMALS));
};

export const depositAllinToTreasury = async ({
  walletId,
  tokenAddress,
  treasuryVaultAddress,
  amount,
  expectedWalletAddress,
}) => {
  if (!walletId) {
    throw new Error('请先连接钱包');
  }

  if (!tokenAddress || !treasuryVaultAddress) {
    throw new Error('链上配置未完成');
  }

  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isInteger(numericAmount)) {
    throw new Error('请输入有效整数数量');
  }

  const walletConnection = await connectWallet(walletId);

  if (expectedWalletAddress) {
    const expected = String(expectedWalletAddress).toLowerCase();
    const actual = String(walletConnection.address || '').toLowerCase();
    if (expected && actual && expected !== actual) {
      throw new Error('当前连接的钱包与登录账户不一致，请切换回原钱包或重新登录');
    }
  }

  const balance = await getWalletTokenBalance({
    provider: walletConnection.provider,
    tokenAddress,
    walletAddress: walletConnection.address,
  });
  if (balance < numericAmount) {
    throw new Error(`钱包 ALLIN 余额不足（当前 ${balance}，需要 ${numericAmount}）`);
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, walletConnection.signer);
  const vaultContract = new ethers.Contract(
    treasuryVaultAddress,
    TREASURY_VAULT_ABI,
    walletConnection.signer
  );
  const amountInUnits = ethers.parseUnits(String(numericAmount), ALLIN_DECIMALS);
  const currentAllowance = await tokenContract.allowance(
    walletConnection.address,
    treasuryVaultAddress
  );

  let approvalTxHash = null;
  if (currentAllowance < amountInUnits) {
    const approvalTx = await tokenContract.approve(treasuryVaultAddress, amountInUnits);
    approvalTxHash = approvalTx.hash;
    await approvalTx.wait();
  }

  const depositId = createTreasuryDepositId(walletConnection.address);

  try {
    const depositTx = await vaultContract.deposit(amountInUnits, depositId);
    const receipt = await depositTx.wait();

    return {
      walletAddress: walletConnection.address,
      depositId,
      approvalTxHash,
      txHash: receipt?.hash || depositTx.hash,
    };
  } catch (err) {
    const msg = String(err?.reason || err?.message || '');
    if (msg.includes('TRANSFER_FROM_FAILED')) {
      throw new Error('转账失败，请确认钱包 ALLIN 余额充足并已授权金库');
    }
    if (msg.includes('VAULT_PAUSED')) {
      throw new Error('金库已暂停充值，请稍后再试');
    }
    if (msg.includes('INVALID_AMOUNT') || msg.includes('INVALID_DEPOSIT_ID')) {
      throw new Error('充值参数无效，请刷新后重试');
    }
    if (msg.includes('DEPOSIT_ALREADY_USED')) {
      throw new Error('该充值单号已使用，请重新发起充值');
    }
    if (getErrorCode(err) === 4001) {
      throw new Error('已取消链上确认');
    }
    throw err;
  }
};
