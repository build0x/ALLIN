set -e

echo "=== nginx -t ==="
nginx -t || true

echo "=== vhost list ==="
ls -la /www/server/panel/vhost/nginx || true

echo "=== allin-bsc.xyz.conf ==="
sed -n '1,240p' /www/server/panel/vhost/nginx/allin-bsc.xyz.conf || true

echo "=== 0.default.conf ==="
sed -n '1,240p' /www/server/panel/vhost/nginx/0.default.conf || true

echo "=== ssl cert list ==="
ls -la /www/server/panel/vhost/cert || true
