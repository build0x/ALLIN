# ALLIN 合约

- **仓库**: [github.com/build0x/ALLIN](https://github.com/build0x/ALLIN)
- **推特**: [@Allin_game](https://x.com/Allin_game)
- **代币合约地址 (BSC，平台发行)**: `0xbe3fd46ca68dc40be81ee30a866ae5592ed07777`

**说明**：ALLIN 代币在发币平台发行，本仓库主网**不部署** AllinToken。合约目录中的 `AllinToken.sol` 仅用于本地测试（`deploy-local.js` 会部署测试代币），主网仅部署 GameTreasuryVault、AllinGame。

## BSC 主网部署（代币已平台发行）

**前置条件：**

- 在 `allin-pocket-ts-backend-main\.env` 中已配置：
  - `ALLIN_TOKEN_ADDRESS=0xbe3fd46ca68dc40be81ee30a866ae5592ed07777`（或你在平台发币得到的地址）
  - `BSC_RPC_URL`（主网 RPC）
  - `BSC_OPERATOR_PRIVATE_KEY`（部署账户私钥）
- 部署账户有足够 BNB 支付 gas

**执行（在 `allin-contracts` 目录下）：**

```bash
npm install
npm run compile
npm run deploy:mainnet
```

或：

```bash
npx hardhat run scripts/deploy-mainnet.js --network bsc
```

脚本**仅部署 GameTreasuryVault**，使用 .env 中的代币地址。部署成功后会更新 `GAME_TREASURY_VAULT_ADDRESS`。报名/建房需再执行 `deploy-allin-game.js` 部署 AllinGame。

---

## 本地部署三合约并更新后端 .env

### 1. 安装依赖并编译

```bash
cd allin-contracts
npm install
npm run compile
```

### 2. 启动本地链（保持运行）

```bash
npx hardhat node
```

会打印若干账户和私钥，**记下 Account #0 的 Private Key**，后面填到后端 `.env` 的 `BSC_OPERATOR_PRIVATE_KEY`。

### 3. 新开终端，部署合约

```bash
cd allin-contracts
npx hardhat run scripts/deploy-local.js --network localhost
```

脚本会部署（**仅本地测试**，主网代币用平台地址）：

- **AllinToken**：本地测试用 ERC20，初始 1 亿枚在 deployer
- **GameTreasuryVault**：金库，接收用户充值

并自动把后端 `.env` 里的 `ALLIN_TOKEN_ADDRESS`、`GAME_TREASURY_VAULT_ADDRESS` 更新为本次部署地址。报名/建房需再执行 `deploy-allin-game.js` 部署 AllinGame 并配置 `ALLIN_GAME_ADDRESS`。

### 4. 后端本地测试配置

在后端 `.env`（如 `allin-pocket-ts-backend-main\.env`）中设置：

- `BSC_RPC_URL=http://127.0.0.1:8545`
- `BSC_OPERATOR_PRIVATE_KEY=` 填上面 **Account #0** 的 Private Key

然后启动后端，即可用本地链做充值、提现、建房燃烧等测试。

### 给测试账户发币（仅本地）

本地部署后测试代币在 deployer（Account #0）。若想给其他地址发币，可用 Hardhat console 调用合约的 `mint`（仅限本地测试合约）。**主网代币为平台发行，本仓库不部署 AllinToken。**
