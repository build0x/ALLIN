/**
 * 若 dist/HandRanks.dat 不存在则从上游下载（构建/部署用）
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const distPath = path.join(__dirname, '..', 'dist', 'HandRanks.dat');
const url = 'https://github.com/christophschmalhofer/poker/raw/master/XPokerEval/XPokerEval.TwoPlusTwo/HandRanks.dat';

if (fs.existsSync(distPath)) {
  console.log('HandRanks.dat already exists in dist/, skip download.');
  process.exit(0);
}

const dir = path.dirname(distPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(toUrl, followRedirect = true) {
  const file = fs.createWriteStream(distPath);
  const req = https.get(toUrl, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      const loc = res.headers.location;
      if (loc && followRedirect) {
        download(loc, false);
        return;
      }
    }
    if (res.statusCode !== 200) {
      console.error('Download failed:', res.statusCode);
      process.exit(1);
    }
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('HandRanks.dat saved to dist/');
    });
  });
  req.on('error', (err) => {
    try { fs.unlinkSync(distPath); } catch (_) {}
    console.error('Download error:', err.message);
    process.exit(1);
  });
}

console.log('Downloading HandRanks.dat...');
download(url);
