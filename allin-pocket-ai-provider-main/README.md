# ALLIN AI Provider

ALLIN 扑克后端的 AI 扩展，通过大语言模型（LLM）提供聊天与牌局中的 AI 能力。

用途：以“玩家”身份接入游戏，支持用户与 AI 对战、完成成就等；本端行为由本地运行的 [Jan AI](https://jan.ai/) 等 LLM 执行。建议本地已安装 `llama3.1-8b-instruct` 等模型。

- **仓库**: [github.com/build0x/ALLIN](https://github.com/build0x/ALLIN)（本模块位于 `allin-pocket-ai-provider-main`）
- **后端**: 本仓库中的 `allin-pocket-ts-backend-main`

### 基本配置

1. 配置环境变量，例如：
   ```
   POKER_SERVER_API_ADDRESS="ws://localhost:8000"
   JAN_AI_SERVER_ADDRESS=http://localhost:1337
   PP_USERNAME="<你的游戏账号>"
   PP_PASSWORD="<账号密码>"
   TABLE_ID=123
   TABLE_PASSWORD="<桌台密码>"
   LLM_MODEL="llama3.1-8b-instruct"
   ```
2. 执行：`npm run start:dev`

连接自建/线上后端时，将 `POKER_SERVER_API_ADDRESS` 改为对应 WebSocket 地址（如 `wss://你的域名/api`）即可。

## License

MIT © [build0x](https://github.com/build0x)
