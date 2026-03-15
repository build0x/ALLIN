/**
 * 一键构建前端+后端并打压缩包，便于上传宝塔部署
 * 在项目根目录（dezhou）执行：node build-and-pack.js
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'poker-pocket-react-client-main');
const backendDir = path.join(rootDir, 'poker-pocket-ts-backend-main');
const frontendBuildDir = path.join(frontendDir, 'build');
const backendDistDir = path.join(backendDir, 'dist');

function run(cmd, cwd, label) {
  console.log('\n' + '='.repeat(60));
  console.log(label || cmd);
  console.log('='.repeat(60));
  try {
    execSync(cmd, { cwd: cwd || rootDir, stdio: 'inherit', shell: true });
  } catch (e) {
    console.error('执行失败:', e.message);
    process.exit(1);
  }
}

// 1. 前端构建
if (!fs.existsSync(frontendDir)) {
  console.error('未找到前端目录: poker-pocket-react-client-main');
  process.exit(1);
}
run('npm run build', frontendDir, '[1/3] 前端构建 (poker-pocket-react-client-main)');

if (!fs.existsSync(frontendBuildDir)) {
  console.error('前端构建产物 build/ 不存在，请检查构建是否成功');
  process.exit(1);
}

// 2. 后端构建
if (!fs.existsSync(backendDir)) {
  console.error('未找到后端目录: poker-pocket-ts-backend-main');
  process.exit(1);
}
run('npm run build', backendDir, '[2/3] 后端构建 (poker-pocket-ts-backend-main)');

if (!fs.existsSync(backendDistDir)) {
  console.error('后端构建产物 dist/ 不存在，请检查构建是否成功');
  process.exit(1);
}

// 3. 打 zip（Windows 用 PowerShell，其他系统用 zip 命令）
const frontendZip = path.join(rootDir, 'deploy-frontend.zip');
const backendZip = path.join(rootDir, 'deploy-backend.zip');

function zipFrontend() {
  console.log('\n[3/3] 打包 deploy-frontend.zip（build/ 内容为根）...');
  const buildContents = path.join(frontendBuildDir, '*');
  const dest = path.resolve(frontendZip);
  const ps1 = path.join(rootDir, '_zip-frontend.ps1');
  fs.writeFileSync(ps1, `Compress-Archive -Path '${buildContents.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force\n`, 'utf8');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, { stdio: 'inherit', shell: true });
  try { fs.unlinkSync(ps1); } catch (_) {}
}

function zipBackend() {
  console.log('打包 deploy-backend.zip（含 dist + package.json + package-lock.json）...');
  const items = [
    path.join(backendDir, 'dist'),
    path.join(backendDir, 'package.json'),
    path.join(backendDir, 'package-lock.json'),
  ].filter((p) => fs.existsSync(p));
  if (items.length === 0) {
    console.error('后端缺少 dist 或 package.json');
    process.exit(1);
  }
  const dest = path.resolve(backendZip);
  const ps1 = path.join(rootDir, '_zip-backend.ps1');
  const pathList = items.map((p) => "'" + path.resolve(p).replace(/'/g, "''") + "'").join(',');
  fs.writeFileSync(ps1, `Compress-Archive -Path ${pathList} -DestinationPath '${dest.replace(/'/g, "''")}' -Force\n`, 'utf8');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, { stdio: 'inherit', shell: true });
  try { fs.unlinkSync(ps1); } catch (_) {}
}

const isWin = process.platform === 'win32';
if (isWin) {
  try {
    zipFrontend();
    zipBackend();
  } catch (e) {
    console.error('PowerShell 打包失败，请手动压缩：');
    console.error('  前端：将 poker-pocket-react-client-main/build/* 打成 deploy-frontend.zip');
    console.error('  后端：将 poker-pocket-ts-backend-main 的 dist、package.json、package-lock.json 打成 deploy-backend.zip');
    process.exit(1);
  }
} else {
  // Linux/macOS：用 zip 命令
  try {
    execSync(`cd "${frontendBuildDir}" && zip -r "${path.resolve(frontendZip)}" .`, { stdio: 'inherit', shell: true });
    execSync(`cd "${backendDir}" && zip -r "${path.resolve(backendZip)}" dist package.json package-lock.json`, { stdio: 'inherit', shell: true });
  } catch (e) {
    console.error('zip 打包失败，请安装 zip 或手动压缩');
    process.exit(1);
  }
}

console.log('\n' + '='.repeat(60));
console.log('完成。压缩包已生成在项目根目录：');
console.log('  deploy-frontend.zip → 解压到宝塔网站根目录 /www/wwwroot/allin-bsc.xyz');
console.log('  deploy-backend.zip  → 解压到服务器后端目录，执行 npm ci --production 后 node dist/index.js 或 PM2 启动');
console.log('='.repeat(60));
