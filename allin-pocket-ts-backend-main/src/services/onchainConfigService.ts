import {ethers} from 'ethers';

const ALLIN_DECIMALS = 18;
/** BSC 主网 chainId，用于 JsonRpcProvider 指定静态网络，避免自动 detect 导致 ECONNRESET/重启 */
const BSC_CHAIN_ID = 56;
const erc20Abi = [
  'function balanceOf(address account) view returns (uint256)',
];

const getRequiredNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getOnchainConfig = () => ({
  rpcUrl: process.env.BSC_RPC_URL || '',
  privateKey: process.env.BSC_OPERATOR_PRIVATE_KEY || '',
  allinTokenAddress: process.env.ALLIN_TOKEN_ADDRESS || '',
  treasuryVaultAddress: process.env.GAME_TREASURY_VAULT_ADDRESS || '',
  allinGameAddress: process.env.ALLIN_GAME_ADDRESS || '',
  prizePoolVaultAddress: process.env.PRIZE_POOL_VAULT_ADDRESS || '',
  confirmations: Math.max(1, getRequiredNumber(process.env.ONCHAIN_CONFIRMATIONS, 1)),
  startBlock: Math.max(0, getRequiredNumber(process.env.ONCHAIN_START_BLOCK, 0)),
});

export const isAllinTokenConfigured = () => {
  const config = getOnchainConfig();
  return Boolean(config.rpcUrl && config.allinTokenAddress);
};

export const isTreasuryConfigured = () => {
  const config = getOnchainConfig();
  return Boolean(config.rpcUrl && config.privateKey && config.allinTokenAddress && config.treasuryVaultAddress);
};

export const isPrizePoolConfigured = () => {
  const config = getOnchainConfig();
  return Boolean(config.rpcUrl && config.privateKey && config.prizePoolVaultAddress);
};

/**
 * 使用 BSC 静态网络创建 JsonRpcProvider，避免 ethers 自动 detect network 时
 * 因 RPC 不可达/断连导致 ECONNRESET 并拖垮进程。仅在 BSC_RPC_URL 已配置时创建。
 */
export const getRpcProvider = () => {
  const config = getOnchainConfig();
  if (!config.rpcUrl || !config.rpcUrl.trim()) {
    throw new Error('BSC_RPC_URL not configured');
  }
  const network = ethers.Network.from(BSC_CHAIN_ID);
  return new ethers.JsonRpcProvider(config.rpcUrl.trim(), network, { staticNetwork: network });
};

export const getOperatorWallet = () => new ethers.Wallet(getOnchainConfig().privateKey, getRpcProvider());

export const getAllinTokenContract = (runner: ethers.ContractRunner = getRpcProvider()) =>
  new ethers.Contract(getOnchainConfig().allinTokenAddress, erc20Abi, runner);

export const toAllinUnits = (amount: number) => ethers.parseUnits(String(amount), ALLIN_DECIMALS);

export const fromAllinUnits = (amount: bigint) => Number(ethers.formatUnits(amount, ALLIN_DECIMALS));

export const toBnbWei = (amount: number) => ethers.parseEther(String(amount));

export const fromBnbWei = (amount: bigint) => Number(ethers.formatEther(amount));

export const createActionHash = (value: string) => ethers.id(value);

/** 从链上读取用户钱包的 ALLIN 余额，用于创建房间/锦标赛报名等校验。未配置 BSC_RPC_URL 或 ALLIN_TOKEN_ADDRESS 时返回 0。RPC 异常时也返回 0，避免 ECONNRESET 等导致进程退出。 */
export const getWalletAllinBalance = async (walletAddress?: string | null) => {
  if (!walletAddress || !isAllinTokenConfigured()) {
    return 0;
  }

  try {
    const tokenContract = getAllinTokenContract();
    const balance = await tokenContract.balanceOf(walletAddress);
    return fromAllinUnits(balance);
  } catch {
    return 0;
  }
};
