/**
 * 给定代币地址，一键部署其他合约（金库、销毁路由、奖池），并绑定收税转发器奖池
 *
 * 流程：你先在发币平台部署好代币，并把代币合约地址填到 poker-pocket-ts-backend-main\.env 的
 *       ALLIN_TOKEN_ADDRESS，再执行本脚本。脚本会部署 GameTreasuryVault、PrizePoolVault，
 *       并在已部署的 TaxForwarder 上设置奖池地址。报名/建房需单独部署 AllinGame。
 *
 * 前置条件：
 *   1. 已在 .env 中配置 ALLIN_TOKEN_ADDRESS（你在平台部署得到的代币合约地址）
 *   2. 若已执行过「仅部署收税转发器」，.env 中应有 TAX_FORWARDER_ADDRESS（用于设置奖池）
 *   3. BSC_RPC_URL、BSC_OPERATOR_PRIVATE_KEY 已配置，部署账户有足够 BNB
 *
 * 执行（在 allin-contracts 目录下）：
 *   npx hardhat run scripts/deploy-others-with-token.js --network bsc
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// 从后端 .env 加载（hardhat.config.js 已指向该 .env）
const backendEnvPath = path.join(__dirname, "..", "..", "poker-pocket-ts-backend-main", ".env");
if (fs.existsSync(backendEnvPath)) {
  require("dotenv").config({ path: backendEnvPath });
}

function getEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === "") return null;
  return v.trim();
}

async function main() {
  const tokenAddress = getEnv("ALLIN_TOKEN_ADDRESS");
  if (!tokenAddress || !hre.ethers.isAddress(tokenAddress)) {
    throw new Error(
      "请先在 poker-pocket-ts-backend-main\\.env 中配置 ALLIN_TOKEN_ADDRESS（你在平台部署得到的代币合约地址）"
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer || !deployer.provider) {
    throw new Error(
      "未获取到部署账户，请检查 BSC_RPC_URL 与 BSC_OPERATOR_PRIVATE_KEY 是否已在 .env 中正确配置"
    );
  }

  const network = await deployer.provider.getNetwork();
  console.log("Network:", network.name, "chainId:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("ALLIN_TOKEN_ADDRESS (existing):", tokenAddress);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "BNB\n");

  // 1. 部署金库
  console.log("1. Deploying GameTreasuryVault...");
  const GameTreasuryVault = await hre.ethers.getContractFactory("GameTreasuryVault");
  const vault = await GameTreasuryVault.deploy(deployer.address, tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   GameTreasuryVault:", vaultAddress);

  // 2. 部署奖池
  console.log("2. Deploying PrizePoolVault...");
  const PrizePoolVault = await hre.ethers.getContractFactory("PrizePoolVault");
  const prizePool = await PrizePoolVault.deploy(deployer.address);
  await prizePool.waitForDeployment();
  const prizePoolAddress = await prizePool.getAddress();
  console.log("   PrizePoolVault:", prizePoolAddress);

  // 3. 若存在 TaxForwarder，设置奖池地址以便 forward() 可分配 BNB
  const taxForwarderAddress = getEnv("TAX_FORWARDER_ADDRESS");
  if (taxForwarderAddress && hre.ethers.isAddress(taxForwarderAddress)) {
    console.log("3. Setting PrizePool on TaxForwarder...");
    const taxForwarder = await hre.ethers.getContractAt("TaxForwarder", taxForwarderAddress);
    const tx = await taxForwarder.setPrizePool(prizePoolAddress);
    await tx.wait();
    console.log("   Done. TaxForwarder 将把 5/6 税收 BNB 转入 PrizePoolVault。");
  } else {
    console.log("3. 未配置 TAX_FORWARDER_ADDRESS，跳过 setPrizePool。若已部署过收税转发器，请在 .env 中填写后重新运行本脚本并手动调用 TaxForwarder.setPrizePool(" + prizePoolAddress + ")。");
  }

  console.log("\n--- 后端 .env 将更新为 ---");
  console.log("ALLIN_TOKEN_ADDRESS=" + tokenAddress);
  console.log("GAME_TREASURY_VAULT_ADDRESS=" + vaultAddress);
  console.log("PRIZE_POOL_VAULT_ADDRESS=" + prizePoolAddress);

  if (fs.existsSync(backendEnvPath)) {
    let env = fs.readFileSync(backendEnvPath, "utf8");
    env = env.replace(/^ALLIN_TOKEN_ADDRESS=.*$/m, "ALLIN_TOKEN_ADDRESS=" + tokenAddress);
    env = env.replace(/^GAME_TREASURY_VAULT_ADDRESS=.*$/m, "GAME_TREASURY_VAULT_ADDRESS=" + vaultAddress);
    if (/^PRIZE_POOL_VAULT_ADDRESS=/m.test(env)) {
      env = env.replace(/^PRIZE_POOL_VAULT_ADDRESS=.*$/m, "PRIZE_POOL_VAULT_ADDRESS=" + prizePoolAddress);
    } else {
      env = env.trimEnd() + "\nPRIZE_POOL_VAULT_ADDRESS=" + prizePoolAddress + "\n";
    }
    fs.writeFileSync(backendEnvPath, env, "utf8");
    console.log("\n已写入 " + backendEnvPath);
  } else {
    console.log("\n未找到 " + backendEnvPath + "，请手动复制上述地址到 .env");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
