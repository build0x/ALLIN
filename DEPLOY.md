# ALLIN 德州扑克 — 打包与上线说明

## 合约正式上线流程（主网）

若代币在**发币平台**上部署，按以下顺序操作：

### 第一步：部署收税转发器（因发币时必须先填税收地址）

在 `allin-contracts` 目录下执行：

```bash
npm run compile
npx hardhat run scripts/deploy-tax-forwarder.js --network bsc
```

- 会部署 **TaxForwarder**，所有税收 BNB 的接收地址。**前期**（未设置奖池时）调用 `forward()` 会 **100% 转营销钱包**：`0x4c0cb594276567f8c47d5cf9e2f536626a00c620`。
- 脚本会把 `TAX_FORWARDER_ADDRESS` 写入 `poker-pocket-ts-backend-main\.env`。
- **请把输出的合约地址** 填到发币平台的「税收接收地址」/ Tax Receiver，这样代币产生的 BNB 税会打进该合约。
- 后期执行第三步「一键部署其他合约」时会部署奖池并调用 `setPrizePool`，此后 `forward()` 将按 **5/6 奖池、1/6 营销** 分配。

### 第二步：在平台部署代币

在发币平台上部署你的代币合约，并把「税收接收地址」设为第一步得到的 **TaxForwarder 地址**。部署完成后，记下**代币合约地址**。

### 第三步：一键部署其他合约

把代币合约地址填到 `poker-pocket-ts-backend-main\.env` 的 **ALLIN_TOKEN_ADDRESS**，然后在 `allin-contracts` 下执行：

```bash
npx hardhat run scripts/deploy-others-with-token.js --network bsc
```

脚本会依次部署并写回 .env：

- **GameTreasuryVault**（代币金库）
- **PrizePoolVault**（BNB 奖池）
- 若 .env 中已有 **TAX_FORWARDER_ADDRESS**，会自动在收税转发器上设置奖池（PrizePoolVault），之后调用 `forward()` 时税收 BNB 将按 5/6 奖池、1/6 营销分配（此前未设奖池时是 100% 转营销钱包）

完成后，后端 .env 中会包含：`ALLIN_TOKEN_ADDRESS`、`GAME_TREASURY_VAULT_ADDRESS`、`PRIZE_POOL_VAULT_ADDRESS`。  
报名/建房需单独部署 **AllinGame** 并配置 `ALLIN_GAME_ADDRESS`：  
`npx hardhat run scripts/deploy-allin-game.js --network bsc`（在 allin-contracts 目录下）。

---

## 服务器与目录（已确认）

- **服务器**：185.183.84.237  
- **前端网站根目录（宝塔）**：`/www/wwwroot/allin-bsc.xyz`  
  - 即：根目录 → www → wwwroot → allin-bsc.xyz  
  - 更新前端时，用本地打好的 **`build/`** 里的内容**覆盖**该目录下原有文件即可。  
- **后端**：当前截图里未看到后端目录；后端可能在同一台机的其他路径，或通过 PM2/端口 5700 运行。若你之后找到后端路径，可补在这里。

**安全提醒**：不要把服务器密码写在本文档或提交到 Git。建议用 SSH 密钥登录，密码仅用于宝塔面板且定期更换。

---

## 一、本地打包

**建议**：先关掉所有打开该项目的终端、编辑器（或至少关掉在该目录下的终端），再新开一个终端执行下面步骤，可减少 EPERM/文件占用问题。

### 1. 前端（React）

```bash
cd poker-pocket-react-client-main
npm install
npm run build
```

- 产物在 **`build/`** 目录。
- 将 **`build/` 里的全部内容**上传并覆盖到服务器目录 **`/www/wwwroot/allin-bsc.xyz`**（保持 index.html、assets、static 等结构）。

### 2. 后端（Node + WebSocket）

```bash
cd poker-pocket-ts-backend-main
npm install
npm run build
```

- 产物：**`dist/`** 目录（编译后的 JS；`npm run build` 已自动把 `src/assets/` 拷到 `dist/assets/`，含 `names.txt`）。
- 上传到服务器时需包含：
  - **`dist/`** 整个目录（含 `dist/assets/`）
  - **`package.json`**
  - **`package-lock.json`**
  - 在服务器该目录执行 **`npm install --production`** 生成 `node_modules/`
  - **`.env`**（在服务器上单独配置，不要提交到 Git）

生产环境启动：

```bash
node dist/index.js
# 或
npm run start:prod
```

建议用 **PM2** 守护进程：

```bash
pm2 start dist/index.js --name allin-backend
pm2 save
pm2 startup
```

---

## 二、本地打包常见错误与处理

按 DEPLOY 操作时若报错，可按下面逐条试。

| 现象 | 处理办法 |
|------|----------|
| **EPERM / 无法 unlink / bcrypt_lib.node** | 1）关掉所有在该项目目录下的终端、Cursor/VS Code 等；2）如有杀毒/安全软件，暂时排除项目目录或先关闭；3）**删掉该子项目里的 `node_modules`**（前端或后端哪个报错就删哪个），再重新执行 `npm install` 和 `npm run build`。仍不行可尝试**用管理员身份**打开 PowerShell 再执行。 |
| **'tsc' 不是内部或外部命令** | 已改为用 `npx tsc` 构建，正常应能执行。若仍报错，在同一目录先执行 `npm install` 再 `npm run build`，保证本机已安装 TypeScript（在 devDependencies 里）。 |
| **ENOTEMPTY / directory not empty** | 删掉该子项目下的 **`node_modules`** 以及 **`node_modules\.cache`**（若有），再执行 `npm install` 和 `npm run build`。 |
| **cross-env / craco 找不到** | 在前端目录执行一次 `npm install`，再用 `npm run build`（脚本里已用 npx，一般可避免）。 |

**推荐顺序（减少报错）**：

1. 关闭所有占用项目的终端和编辑器窗口（或至少不在项目目录下开很多终端）。
2. 新开一个终端，进入对应子目录（前端或后端）。
3. 若之前装依赖失败过，先删掉该目录下的 `node_modules`，再执行 `npm install`。
4. 再执行 `npm run build`。

---

## 三、宝塔 PostgreSQL 建库与“连接失败”处理

后端用的是 **PostgreSQL**，在宝塔里要切到 **「数据库」→ 上方标签选 PgSQL** 再建库。

若点「添加数据库」报 **连接数据库失败**，且终端里错误是 `fe_sendauth: no password supplied`，说明宝塔连 PostgreSQL 时没有用对管理员密码，按下面做：

1. **在服务器终端里给 postgres 用户设好密码**（你已执行过可跳过）：
   ```bash
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD '你的密码';"
   ```
   把 `你的密码` 换成你要用的密码（例如 `As1234..`），记住它。

2. **在宝塔里把“管理员密码”填成同一个**  
   进入 **数据库 → PgSQL**，在工具栏点 **「管理员密码」**（或「root 密码」），把上一步设的 postgres 密码填进去并保存。这样宝塔用这个密码去连本机 PostgreSQL。

3. **再点「添加数据库」**  
   新建一个库，库名可用 `poker-pocket-ts`，用户名、密码按界面提示设（或让宝塔自动生成），记下 **数据库名、用户名、密码**，填到后端 `.env` 的 `DB_NAME`、`DB_USER`、`DB_PASS`。

建好库后，后端 `.env` 里 `DB_HOST=localhost` 即可（数据库与后端同机）。

---

## 四、在服务器上一步步查“昨天怎么跑的数据库”

下面都在**服务器**上做：先连上服务器，再按顺序执行命令，就能看到当时用的数据库配置和状态。

### 1. 连上服务器

在你自己电脑上打开终端（PowerShell / CMD / 或 Mac 终端），执行：

```bash
ssh root@185.183.84.237
```

提示输入密码时，填服务器 root 密码。  
（若你用的是其他用户名，把 `root` 换成你的用户名；若用密钥登录，加上 `-i 你的密钥路径`。）

### 2. 看后端用的数据库配置

连上后，你之前跑的后端在 **`/opt/allin/backend`**（PM2 里看到的），先看它用的数据库连接：

```bash
grep -E '^DB_' /opt/allin/backend/.env
```

会看到类似：

- `DB_HOST=localhost`
- `DB_USER=postgres`
- `DB_PASS=postgres`
- `DB_NAME=poker-pocket-ts`

这就是**昨天后端在用的**：本机 PostgreSQL，用户 `postgres`，密码 `postgres`，库名 `poker-pocket-ts`。  
宝塔里「管理员密码」填 **`postgres`** 就是在用同一套。

### 3. 看 PostgreSQL 是否在跑

```bash
systemctl status postgresql
```

看到 `Active: active` 就说明服务在跑。

### 4. 用上面的账号密码测一下能否连上库

（下面命令里密码就是上一步 `.env` 里的 `DB_PASS`，这里用 `postgres` 举例。）

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d poker-pocket-ts -c "\conninfo"
```

- 能连上：会打印连接信息，说明当前 postgres 用户密码就是 `postgres`，宝塔里填 `postgres` 即可。
- 报错 `password authentication failed`：说明 postgres 密码已经改过了，不是 `postgres` 了，需要你在服务器上**重设一次**密码（见下面第 5 步），再把新密码填到宝塔和后端 `.env`。

### 5. 若密码不对，在服务器上重设 postgres 密码

（不依赖宝塔，直接在服务器改库密码。）

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '你要用的新密码';"
```

把 `你要用的新密码` 换成你打算用的密码，记住。  
然后：

- 在宝塔 **数据库 → PgSQL → 管理员密码** 里填这个新密码；
- 后端 `.env` 里 `DB_PASS=` 也改成这个新密码。

### 6. 看库里有没有 poker-pocket-ts

```bash
sudo -u postgres psql -c "\l"
```

列表里有没有 `poker-pocket-ts`：

- 有：说明库还在，只要密码对（第 4 步或第 5 步），后端和宝塔都能连。
- 没有：在宝塔 PgSQL 里「添加数据库」新建一个，库名填 `poker-pocket-ts`，用户名密码按界面设，再把 `DB_NAME` / `DB_USER` / `DB_PASS` 写进后端 `.env`。

按 1→2→3→4→5（如需）→6 做一遍，就能确认昨天是怎么跑的数据库，以及现在该怎么改密码/建库。

---

## 五、服务器上后端可能放哪里（宝塔常见）

我无法知道你昨天具体上传到了哪，下面只是**常见位置**，供你排查：

| 可能位置 | 说明 |
|----------|------|
| `/www/wwwroot/你的域名/backend` 或 `api` | 宝塔建站后的项目目录下 |
| `/www/wwwroot/你的域名` | 若前后端同站，可能后端也在这 |
| `/home/www/` 或 `/var/www/` | 部分环境用这类路径 |
| `/root/` 下的项目文件夹 | 有人会放在 root 家目录 |

### 如何快速找到后端

1. **看 PM2 进程（若用了 PM2）**
   ```bash
   pm2 list
   ```
   看是否有 `allin`、`poker`、`backend`、`node` 等名字，再：
   ```bash
   pm2 show <名字>
   ```
   会显示 **运行目录**（即后端所在路径）。

2. **看端口**
   后端默认端口一般是 **5700**（你本地 .env 里是 `PORT=5700`）。在服务器上查谁在监听：
   ```bash
   netstat -tlnp | grep 5700
   # 或
   ss -tlnp | grep 5700
   ```
   会显示占用该端口的进程，再根据 PID 查进程所在目录。

3. **宝塔面板**
   - 网站 → 对应站点 → 根目录，看实际路径。
   - 软件商店 → PM2 管理器（若装了）→ 查看项目列表里的“运行目录”。

4. **按文件名/目录名搜索**
   ```bash
   find /www -name "package.json" -path "*/poker*" 2>/dev/null
   find /www -name "dist" -type d 2>/dev/null
   ```

找到目录后，**以后更新**就只覆盖该目录里的 `dist/`、`package.json`，并在该目录执行 `npm ci --production` 和 `pm2 restart allin-backend`（或你起的名字）。

---

## 六、本次更新要传什么

- **前端**：本地执行 `npm run build` 后，用 **`build/`** 里的全部文件覆盖服务器上的 **`/www/wwwroot/allin-bsc.xyz`**（宝塔 → 文件 → 进入该目录 → 上传并覆盖）。
- **后端**：重新执行 `npm run build`，用新的 **`dist/`** 覆盖服务器上后端项目里的 `dist/`，并在后端目录执行 `npm ci --production`（如有依赖变更），然后 `pm2 restart <进程名>`。

---

## 七、Nginx 与前端代理（若前后端同机）

前端访问后端 WebSocket 时，一般会通过 Nginx 反代。例如：

- 前端：`https://你的域名/`
- WebSocket：`wss://你的域名/api` → 反代到 `http://127.0.0.1:5700/api`

在 Nginx 里需要有类似配置：

```nginx
location /api {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_pass http://127.0.0.1:5700;
}
```

前端里的 WebSocket 地址需和实际域名一致（如 `wss://你的域名/api`）。

---

## 前端提示「连接已断开」/ 连接不了后端

前端生产环境会连 **`wss://当前域名/api`**（例如访问 https://allin-bsc.xyz 则连 wss://allin-bsc.xyz/api）。出现「连接已断开，请检查网络后重试」时，按下面逐项检查：

| 检查项 | 操作 |
|--------|------|
| **1. 后端是否在跑** | 服务器上执行 `pm2 list`，看 allin-backend（或你的进程名）是否为 online。若没有或为 stopped，执行 `cd /www/wwwroot/allin-houduan && pm2 start index.js --name allin-backend` 或 `pm2 restart allin-backend`。 |
| **2. 后端端口** | 后端默认端口 5700。执行 `ss -tlnp \| grep 5700` 或 `netstat -tlnp \| grep 5700`，应有进程在监听。 |
| **3. Nginx 是否反代 /api** | 宝塔 → 网站 → 对应站点（如 allin-bsc.xyz）→ 设置 → 反向代理，添加：代理名称随意，目标 URL 填 `http://127.0.0.1:5700`，发送域名填 `$host`，再在「配置文件」或「子目录」里确保有 `location /api { ... proxy_pass http://127.0.0.1:5700; }` 以及 WebSocket 用的 `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`。 |
| **4. 防火墙** | 若用户直连服务器 IP:5700 则需放行 5700；若只通过 Nginx 反代访问，则只需放行 80/443，不必开放 5700。 |

改完 Nginx 后执行 `nginx -t` 检查配置，再 `systemctl reload nginx`（或宝塔里重载配置）。

---

## 后端报「Error during database initialization」

后端用 PostgreSQL 的 **schema：`poker`**，新库 `allin` 里默认没有这个 schema，需要先建好并授权给用户 `ALLIN`。

**在服务器上执行（用有权限的账号，例如 postgres）：**

```bash
# 用 postgres 连到 allin 库，创建 schema 并授权（密码按你实际设置的填）
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d allin -c "CREATE SCHEMA IF NOT EXISTS poker; GRANT ALL ON SCHEMA poker TO \"ALLIN\"; GRANT ALL ON ALL TABLES IN SCHEMA poker TO \"ALLIN\"; GRANT ALL ON ALL SEQUENCES IN SCHEMA poker TO \"ALLIN\"; ALTER DEFAULT PRIVILEGES IN SCHEMA poker GRANT ALL ON TABLES TO \"ALLIN\";"
```

若你已把 postgres 密码改成别的，把上面 `PGPASSWORD=postgres` 改成实际密码。执行成功后，再重启后端：

```bash
pm2 restart allin-backend
```

若仍报错，看 `pm2 logs allin-backend` 里是否还有「database」「connection」「permission」等字样，再按报错排查。

---

## 后台登录报「ADMIN_WALLET_NOT_ALLOWED」或 admin_wallets 表为空

后台登录依赖 **数据库表 `poker.admin_wallets`**，表里的记录来自启动时根据 **环境变量 `ADMIN_WALLETS`** 做的“播种”（seed）。若表为空或没有你的地址，就会报 `ADMIN_WALLET_NOT_ALLOWED`。

**按下面顺序做：**

1. **确认服务器上后端目录里的 `.env` 有配置**
   - 在后端项目目录（例如 `/www/wwwroot/allin-houduan`）执行：
     ```bash
     grep ADMIN_WALLETS /www/wwwroot/allin-houduan/.env
     ```
   - 应看到一行：`ADMIN_WALLETS=0x你的钱包地址`（多个地址用英文逗号分隔，不要有多余空格）。
   - 若没有或写错，用宝塔或 `nano` 编辑该目录下的 `.env`，补上或改成正确地址后保存。

2. **用“项目根目录”的 .env 启动（已在后端代码中修复）**
   - 新版本后端会从 **项目根目录**（即与 `dist/` 同级）加载 `.env`，不再依赖 PM2 的“当前工作目录”。  
   - 因此请**重新构建并上传后端**（覆盖 `dist/`），再重启：
     ```bash
     cd /www/wwwroot/allin-houduan
     pm2 restart allin-backend
     ```

3. **确认表里已有你的地址**
   - 重启后，用你当前库的用户名和密码查表（下面示例用户为 `ALLIN`、密码为 `As1234..`）：
     ```bash
     PGPASSWORD=As1234.. psql -h 127.0.0.1 -U ALLIN -d allin -c "SET search_path TO poker; SELECT id, wallet_address, is_active FROM \"admin_wallets\";"
     ```
   - 应至少有一行，且 `wallet_address` 为你在 `.env` 里填的地址（小写）。若仍是 0 行，回到第 1 步确认 `.env` 无误且已重启。

4. **再试登录**
   - 刷新后台登录页，用**同一钱包**（且确保在 BSC 主网）点「使用 MetaMask 登录」。

---

你只要在服务器上按上面「如何快速找到后端」试一遍，就能确定后端当前所在路径；确定后，以后每次上线就按「本次更新要传什么」操作即可。
