/**
 * 本地测试网部署：ALLIN 代币、GameTreasuryVault
 * 使用方式：
 *   终端1: npx hardhat node
 *   终端2: npx hardhat run scripts/deploy-local.js --network localhost
 * 部署完成后将打印地址，并把 poker-pocket-ts-backend-main\.env 中三行更新为本次部署地址。
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const INITIAL_SUPPLY = process.env.ALLIN_INITIAL_SUPPLY || "100000000"; // 1 亿枚，18 decimals

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. 部署 ALLIN 测试代币
  const AllinToken = await hre.ethers.getContractFactory("AllinToken");
  const initialSupplyWei = hre.ethers.parseUnits(INITIAL_SUPPLY, 18);
  const token = await AllinToken.deploy(initialSupplyWei);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("ALLIN Token:", tokenAddress);

  // 2. 部署金库（owner = deployer, token = ALLIN）
  const GameTreasuryVault = await hre.ethers.getContractFactory("GameTreasuryVault");
  const vault = await GameTreasuryVault.deploy(deployer.address, tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("GameTreasuryVault:", vaultAddress);

  console.log("\n--- 复制到后端 .env ---");
  console.log("ALLIN_TOKEN_ADDRESS=" + tokenAddress);
  console.log("GAME_TREASURY_VAULT_ADDRESS=" + vaultAddress);
  console.log("\n本地测试时请设置：");
  console.log("BSC_RPC_URL=http://127.0.0.1:8545");
  console.log("BSC_OPERATOR_PRIVATE_KEY= 使用 hardhat node 启动时打印的 Account #0 的 Private Key");
  console.log("报名/建房需单独部署 AllinGame：npx hardhat run scripts/deploy-allin-game.js --network localhost");

  const envPath = path.join(__dirname, "..", "..", "poker-pocket-ts-backend-main", ".env");
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf8");
    env = env.replace(/^ALLIN_TOKEN_ADDRESS=.*$/m, "ALLIN_TOKEN_ADDRESS=" + tokenAddress);
    env = env.replace(/^GAME_TREASURY_VAULT_ADDRESS=.*$/m, "GAME_TREASURY_VAULT_ADDRESS=" + vaultAddress);
    fs.writeFileSync(envPath, env, "utf8");
    console.log("\n已写入 " + envPath);
  } else {
    console.log("\n未找到 " + envPath + "，请手动复制上述两行到 .env");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
