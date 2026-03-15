require("hardhat/config");
require("@nomicfoundation/hardhat-ethers");
const path = require("path");

// 主网部署时从后端 .env 读取 RPC 与私钥
const backendEnv = path.join(__dirname, "..", "poker-pocket-ts-backend-main", ".env");
require("dotenv").config({ path: backendEnv });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: process.env.BSC_OPERATOR_PRIVATE_KEY ? [process.env.BSC_OPERATOR_PRIVATE_KEY] : [],
    },
  },
};
