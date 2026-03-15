set -e

nginx -v 2>&1
nginx -T 2>&1 | sed -n '1,220p'
ls -la /etc/nginx
find /etc/nginx -maxdepth 2 -type f | sort
pm2 status
curl -I http://127.0.0.1:8000/admin-api || true
curl -I http://127.0.0.1:8000/ || true
