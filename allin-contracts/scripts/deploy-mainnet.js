/**
 * BSC 主网部署：仅部署 GameTreasuryVault（代币使用平台发币地址）
 *
 * 代币在发币平台发行，本脚本不部署 AllinToken。请先在 .env 中配置 ALLIN_TOKEN_ADDRESS（平台得到的代币合约地址）。
 *
 * 前置条件：
 *   1. poker-pocket-ts-backend-main\.env 中已配置：
 *      ALLIN_TOKEN_ADDRESS=0x...  （平台发币得到的合约地址）
 *      BSC_RPC_URL=https://...
 *      BSC_OPERATOR_PRIVATE_KEY=0x...
 *   2. 部署账户有足够 BNB 支付 gas
 *
 * 执行：在 allin-contracts 目录下
 *   npx hardhat run scripts/deploy-mainnet.js --network bsc
 *
 * 部署成功后会自动更新后端 .env 中的 GAME_TREASURY_VAULT_ADDRESS。
 * 报名/建房需再执行：npx hardhat run scripts/deploy-allin-game.js --network bsc
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function getEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === "") return null;
  return v.trim();
}

async function main() {
  const tokenAddress = getEnv("ALLIN_TOKEN_ADDRESS");
  if (!tokenAddress || !hre.ethers.isAddress(tokenAddress)) {
    throw new Error(
      "请先在 poker-pocket-ts-backend-main\\.env 中配置 ALLIN_TOKEN_ADDRESS（你在发币平台得到的代币合约地址），本仓库不部署代币合约。"
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer || !deployer.provider) {
    throw new Error(
      "未获取到部署账户，请检查 BSC_RPC_URL 与 BSC_OPERATOR_PRIVATE_KEY 是否已在 poker-pocket-ts-backend-main\\.env 中正确配置"
    );
  }
  const network = await deployer.provider.getNetwork();
  console.log("Network:", network.name, "chainId:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("ALLIN_TOKEN_ADDRESS (平台发币):", tokenAddress);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "BNB\n");

  // 仅部署金库（代币地址来自 .env）
  console.log("Deploying GameTreasuryVault...");
  const GameTreasuryVault = await hre.ethers.getContractFactory("GameTreasuryVault");
  const vault = await GameTreasuryVault.deploy(deployer.address, tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   GameTreasuryVault:", vaultAddress);

  console.log("\n--- 后端 .env 将更新为 ---");
  console.log("GAME_TREASURY_VAULT_ADDRESS=" + vaultAddress);

  const envPath = path.join(__dirname, "..", "..", "allin-pocket-ts-backend-main", ".env");
  const envPathAlt = path.join(__dirname, "..", "..", "poker-pocket-ts-backend-main", ".env");
  const targetPath = fs.existsSync(envPath) ? envPath : envPathAlt;
  if (fs.existsSync(targetPath)) {
    let env = fs.readFileSync(targetPath, "utf8");
    env = env.replace(/^GAME_TREASURY_VAULT_ADDRESS=.*$/m, "GAME_TREASURY_VAULT_ADDRESS=" + vaultAddress);
    fs.writeFileSync(targetPath, env, "utf8");
    console.log("\n已写入 " + targetPath);
  } else {
    console.log("\n未找到 .env，请手动复制 GAME_TREASURY_VAULT_ADDRESS 到后端 .env");
  }
  console.log("\n报名/建房需单独部署 AllinGame：npx hardhat run scripts/deploy-allin-game.js --network bsc");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
