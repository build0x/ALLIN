set -e

ls -la /www/server/panel/vhost/nginx
find /www/server/panel/vhost/nginx -maxdepth 1 -type f | sort
pm2 status
curl -I http://127.0.0.1:8000/admin-api || true
curl -I http://127.0.0.1:8000/ || true
