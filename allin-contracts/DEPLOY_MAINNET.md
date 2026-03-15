# BSC 主网部署

## 前置条件

1. **后端 `.env` 已配置**（`poker-pocket-ts-backend-main\.env`）：
   - `BSC_RPC_URL`：BSC 节点 RPC（如 `https://bsc-dataseed.binance.org/`）
   - `BSC_OPERATOR_PRIVATE_KEY`：部署/操作钱包私钥（0x 开头）
2. **部署账户有足够 BNB** 支付 gas。

---

## 方式一：代币在发币平台部署（正式上线推荐）

### 第一步：部署收税转发器

```bash
cd allin-contracts
npm run compile
npx hardhat run scripts/deploy-tax-forwarder.js --network bsc
```

- 部署 **TaxForwarder**（发币时必须先有一个税收接收地址）。**前期**未设置奖池时，`forward()` 会 **100%** 转营销钱包：`0x4c0cb594276567f8c47d5cf9e2f536626a00c620`；部署奖池并 `setPrizePool` 后改为 5/6 奖池、1/6 营销。
- 脚本会写回 `TAX_FORWARDER_ADDRESS` 到后端 .env。
- **把输出的合约地址** 填到发币平台的「税收接收地址」/ Tax Receiver。

### 第二步：在平台部署代币

在发币平台上部署代币，税收接收地址填第一步的 **TaxForwarder 地址**。部署完成后记下**代币合约地址**。

### 第三步：一键部署其他合约

把代币地址填到后端 .env 的 **ALLIN_TOKEN_ADDRESS**，然后执行：

```bash
npx hardhat run scripts/deploy-others-with-token.js --network bsc
```

会部署 **GameTreasuryVault**、**PrizePoolVault**，在 TaxForwarder 上设置奖池，并写回 .env。报名/建房需单独部署 **AllinGame**：`npx hardhat run scripts/deploy-allin-game.js --network bsc`。

---

## 方式二：本仓库一次性部署代币 + 金库

在 **allin-contracts** 目录下：

```bash
npm run compile
npx hardhat run scripts/deploy-mainnet.js --network bsc
```

部署成功后会打印并写回 `ALLIN_TOKEN_ADDRESS`、`GAME_TREASURY_VAULT_ADDRESS`。报名/建房需再执行 `deploy-allin-game.js` 部署 AllinGame 并配置 `ALLIN_GAME_ADDRESS`。

（不包含 TaxForwarder、PrizePoolVault；若需收税转发与奖池，请用方式一。）

## 可选环境变量

- `ALLIN_INITIAL_SUPPLY`：代币初始供应量（默认 100000000，即 1 亿枚，18 decimals）

## 当前合约逻辑

- **AllinToken**：支持 `burn(amount)`，用户或 AllinGame 可燃烧自身余额。
- **AllinGame**：用户直接调用 `registerTournament()` / `createRoom()` 扣费并链上燃烧，无需后端 operator。
- **TaxForwarder**：接收代币税收 BNB。奖池未设置时 `forward()` 100% 转营销钱包；设置奖池后 5/6 转奖池、1/6 转营销钱包。
