set -e

python3 - <<'PY'
from pathlib import Path

for target in [
    Path('/www/server/panel/vhost/nginx/allin-bsc.xyz.conf'),
    Path('/www/server/panel/vhost/nginx/0.default.conf'),
]:
    text = target.read_text(encoding='utf-8')
    text = text.replace('root /var/www/allin;', 'root /www/wwwroot/allin-bsc.xyz;')
    target.write_text(text, encoding='utf-8')
PY

nginx -t
systemctl reload nginx

curl -I http://allin-bsc.xyz/
curl -I http://allin-bsc.xyz/admin-api || true
ls -la /www/wwwroot/allin-bsc.xyz/.well-known || true
