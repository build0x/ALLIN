set -e

cd /opt/allin/backend
node - <<'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1/api', {
  headers: {
    Host: 'allin-bsc.xyz'
  }
});

const timer = setTimeout(() => {
  console.error('WS_TIMEOUT');
  process.exit(1);
}, 8000);

ws.on('open', () => {
  console.log('WS_OPEN');
  clearTimeout(timer);
  ws.close();
});

ws.on('error', (error) => {
  console.error('WS_ERROR', error.message);
  clearTimeout(timer);
  process.exit(1);
});
EOF
