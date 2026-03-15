# ALLIN

**多游戏扑克 + BSC 链上经济 · 德州 / 五张抽牌 / 转瓶 · 合约开源**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-allin--bsc.xyz-00c853)](https://allin-bsc.xyz/)
[![Twitter](https://img.shields.io/badge/Twitter-@Allin__game-1DA1F2?logo=twitter)](https://x.com/Allin_game)

---

## 📌 链接

|  |  |
|--|--|
| **官网** | [allin-bsc.xyz](https://allin-bsc.xyz/) |
| **仓库** | [github.com/build0x/ALLIN](https://github.com/build0x/ALLIN) |
| **推特** | [@Allin_game](https://x.com/Allin_game) |
| **代币合约 (BSC)** | `0xbe3fd46ca68dc40be81ee30a866ae5592ed07777` |

---

<p align="center">
  <img src="assets/logo.png" alt="ALLIN Logo" width="280" />
</p>

<p align="center">
  <img src="assets/banner.png" alt="ALLIN 赛事" width="720" />
</p>

---

## ✨ 简介

ALLIN 是多游戏扑克平台，支持德州扑克、五张抽牌、转瓶等玩法，并接入 BSC 链上 ALLIN 代币与经济系统。**代币在发币平台发行**，本仓库智能合约为 Hardhat（GameTreasuryVault、AllinGame），不包含代币合约。金库与奖池合约为**仅充值、不可提取**设计，资金锁定在合约内。

## 🏗️ 项目结构

| 目录 | 说明 |
|------|------|
| `allin-pocket-ts-backend-main` | 后端：TypeScript + Express + WebSocket，多游戏逻辑、锦标赛、链上经济 |
| `allin-pocket-react-client-main` | 前端：React 客户端 |
| `allin-contracts` | BSC 合约：GameTreasuryVault、AllinGame（Hardhat，代币为平台发行） |

## 🚀 快速开始

### 1. 合约

```bash
cd allin-contracts
npm install
npm run compile
# 本地：npx hardhat node 后 npm run deploy:local
# 主网：配置 .env 后 npm run deploy:mainnet
```

详见 [allin-contracts/README.md](allin-contracts/README.md)。

### 2. 后端

```bash
cd allin-pocket-ts-backend-main
cp .env.example .env   # 按需填写数据库、JWT、BSC RPC、合约地址等
npm install
npm run start:dev
```

### 3. 前端

```bash
cd allin-pocket-react-client-main
npm install
npm start
```

浏览器访问前端地址（如 http://localhost:3000），后端默认代理到 `http://localhost:5700`。

---

## 📄 License

MIT © [build0x](https://github.com/build0x)
