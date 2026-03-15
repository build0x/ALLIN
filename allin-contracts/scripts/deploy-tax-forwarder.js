/**
 * 仅部署收税转发器（TaxForwarder）
 *
 * 用途：发币平台要求必须先填「税收接收地址」才能创建代币，所以先部署本合约拿到一个地址。
 * 逻辑（全自动，收到税即转出）：
 *   - 前期（未设置奖池）：每次收到 BNB 立即 100% 转营销钱包；
 *   - 后期执行「一键部署其他合约」后会调用 setPrizePool(奖池地址)，此后每次收到 BNB 立即按 5/6 奖池、1/6 营销转出。
 *
 * 营销钱包：0x4c0cb594276567f8c47d5cf9e2f536626a00c620
 *
 * 前置条件：
 *   poker-pocket-ts-backend-main\.env 中已配置：
 *     BSC_RPC_URL=...
 *     BSC_OPERATOR_PRIVATE_KEY=0x...
 *
 * 执行（在 allin-contracts 目录下）：
 *   npx hardhat run scripts/deploy-tax-forwarder.js --network bsc
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const MARKETING_WALLET = "0x4c0cb594276567f8c47d5cf9e2f536626a00c620";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer || !deployer.provider) {
    throw new Error(
      "未获取到部署账户，请检查 BSC_RPC_URL 与 BSC_OPERATOR_PRIVATE_KEY 是否已在 poker-pocket-ts-backend-main\\.env 中正确配置"
    );
  }
  const network = await deployer.provider.getNetwork();
  console.log("Network:", network.name, "chainId:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "BNB\n");

  console.log("Deploying TaxForwarder...");
  console.log("  Owner:", deployer.address);
  console.log("  MarketingWallet:", MARKETING_WALLET);

  const TaxForwarder = await hre.ethers.getContractFactory("TaxForwarder");
  const forwarder = await TaxForwarder.deploy(deployer.address, MARKETING_WALLET);
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();

  console.log("\nTaxForwarder deployed:", forwarderAddress);
  console.log("\n请将此地址填入发币平台的「税收接收地址」/ Tax Receiver，代币产生的 BNB 税将打入此合约。");
  console.log("全自动：收到税即转出。当前未设置奖池时 100% 转营销钱包；设置奖池后按 5/6 奖池、1/6 营销转出。");
  console.log("（也可手动调用 forward() 处理暂停期间滞留的 BNB。）\n");

  const envPath = path.join(__dirname, "..", "..", "poker-pocket-ts-backend-main", ".env");
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf8");
    if (/^TAX_FORWARDER_ADDRESS=/m.test(env)) {
      env = env.replace(/^TAX_FORWARDER_ADDRESS=.*$/m, "TAX_FORWARDER_ADDRESS=" + forwarderAddress);
    } else {
      env = env.trimEnd() + "\n# 收税转发器（第一步部署后写入，用于后续一键部署时设置奖池）\nTAX_FORWARDER_ADDRESS=" + forwarderAddress + "\n";
    }
    fs.writeFileSync(envPath, env, "utf8");
    console.log("已写入 TAX_FORWARDER_ADDRESS 到 " + envPath);
  } else {
    console.log("未找到 " + envPath + "，请手动在 .env 中添加：");
    console.log("TAX_FORWARDER_ADDRESS=" + forwarderAddress);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
