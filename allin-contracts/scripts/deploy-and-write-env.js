/**
 * 一键部署：启动本地节点 → 部署三合约 → 更新后端 .env
 * 在 allin-contracts 目录下执行: node scripts/deploy-and-write-env.js
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const HARDHAT_ACCOUNT_0_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2f80";
const INITIAL_SUPPLY = "1000000";
const RPC = "http://127.0.0.1:8545";

function waitForRpc(ms = 500, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = () => {
      const req = http.get(RPC, { timeout: 500 }, (res) => {
        resolve();
      });
      req.on("error", () => {
        attempts++;
        if (attempts >= maxAttempts) return reject(new Error("RPC timeout"));
        setTimeout(tick, ms);
      });
    };
    tick();
  });
}

async function main() {
  const allinRoot = path.join(__dirname, "..");
  const backendEnv = path.join(allinRoot, "..", "poker-pocket-ts-backend-main", ".env");

  console.log("1. 启动 Hardhat 本地节点...");
  const node = spawn("npx", ["hardhat", "node"], {
    cwd: allinRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  node.stdout?.on("data", (d) => process.stdout.write(d));
  node.stderr?.on("data", (d) => process.stderr.write(d));

  await new Promise((r) => setTimeout(r, 3000));
  try {
    await waitForRpc();
  } catch (e) {
    node.kill();
    throw e;
  }
  console.log("   节点已就绪");

  console.log("2. 部署合约...");
  const deploy = spawn("npx", ["hardhat", "run", "scripts/deploy-local.js", "--network", "localhost"], {
    cwd: allinRoot,
    stdio: "inherit",
    env: { ...process.env },
    shell: true,
  });

  await new Promise((resolve, reject) => {
    deploy.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("deploy exit " + code))));
  });

  console.log("3. 部署完成，本地节点继续在后台运行。");
  console.log("   后端 .env 已更新。本地测试请设置：");
  console.log("   BSC_RPC_URL=http://127.0.0.1:8545");
  console.log("   BSC_OPERATOR_PRIVATE_KEY=" + HARDHAT_ACCOUNT_0_KEY);
  console.log("\n   （如需停止节点，请关闭本窗口或 Ctrl+C）");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
