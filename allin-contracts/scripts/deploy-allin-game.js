/**
 * 部署 AllinGame（用户直接调用 registerTournament / createRoom，无 operator、无后端代执行）
 * 从 poker-pocket-ts-backend-main\.env 读取 ALLIN_TOKEN_ADDRESS
 *
 * 执行：npx hardhat run scripts/deploy-allin-game.js --network bsc
 */

const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  const backendEnv = path.join(__dirname, "..", "..", "poker-pocket-ts-backend-main", ".env");
  require("dotenv").config({ path: backendEnv });

  const tokenAddress = process.env.ALLIN_TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error("请在 poker-pocket-ts-backend-main\\.env 中配置 ALLIN_TOKEN_ADDRESS");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Token:  ", tokenAddress);

  const AllinGame = await hre.ethers.getContractFactory("AllinGame");
  const game = await AllinGame.deploy(tokenAddress);
  await game.waitForDeployment();
  const gameAddress = await game.getAddress();
  console.log("AllinGame:", gameAddress);
  console.log("tournamentFee:", (await game.tournamentFee()).toString());
  console.log("roomCreationFee:", (await game.roomCreationFee()).toString());

  const envPath = path.join(__dirname, "..", "..", "poker-pocket-ts-backend-main", ".env");
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf8");
    if (/^ALLIN_GAME_ADDRESS=/m.test(env)) {
      env = env.replace(/^ALLIN_GAME_ADDRESS=.*$/m, "ALLIN_GAME_ADDRESS=" + gameAddress);
    } else {
      env = env.trimEnd() + "\nALLIN_GAME_ADDRESS=" + gameAddress + "\n";
    }
    fs.writeFileSync(envPath, env, "utf8");
    console.log("\n已写入 ALLIN_GAME_ADDRESS 到 " + envPath);
  } else {
    console.log("\nALLIN_GAME_ADDRESS=" + gameAddress);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
