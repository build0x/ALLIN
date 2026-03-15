# ALLIN 后端 (TypeScript)

ALLIN 扑克平台后端服务，支持多游戏（德州扑克、五张抽牌、转瓶等）、锦标赛与 BSC 链上经济。轻量设计，可支撑大量房间。

- **仓库**: [github.com/build0x/ALLIN](https://github.com/build0x/ALLIN)（本后端位于 `allin-pocket-ts-backend-main`）
- **官网**: [allin-bsc.xyz](https://allin-bsc.xyz/)

### 前置条件

* 下载 `handRanks.dat`：  
  [christophschmalhofer/poker - HandRanks.dat](https://github.com/christophschmalhofer/poker/blob/master/XPokerEval/XPokerEval.TwoPlusTwo/HandRanks.dat)  
  放入本项目的 `/src` 目录。

### 基本配置

1. 创建数据库（如 `poker-pocket-ts`），或通过环境变量 `DB_NAME` 指定库名。
2. 在数据库中新增 schema：`poker`。
3. 配置环境变量，例如：
   ```
   DB_HOST=<value>
   DB_USER=<value>
   DB_PASS=<value>
   DB_NAME=<value，默认 poker-pocket-ts>
   ```
4. 配置密钥：
   * `PW_SECRET=<value>`（可用 `npm run secret` 生成）
   * `PW_REFRESH_SECRET=<value>`（同上）
5. 执行 `npm install`
6. 开发环境运行：`npm run start:dev`（使用 nodemon）
7. 前端可配合本仓库中的 `allin-pocket-react-client-main` 使用。

### AI 扩展

* 本仓库内：`Allin-pocket-AI-Provider-Main`

### 说明

`.gitignore` 已忽略大文件 `HandRanks.dat`，需按上文手动下载放置。

## License

MIT © [build0x](https://github.com/build0x)
