set -e

cd /opt/allin/backend
pm2 restart allin-backend
sleep 5
pm2 status
curl -I http://127.0.0.1:8000/admin-api || true

cat >/www/server/panel/vhost/nginx/allin-bsc.xyz.conf <<'EOF'
server
{
    listen 80;
    server_name allin-bsc.xyz www.allin-bsc.xyz 185.183.84.237;
    index index.html;
    root /var/www/allin;

    include /www/server/panel/vhost/nginx/well-known/allin-bsc.xyz.conf;
    include /www/server/panel/vhost/nginx/extension/allin-bsc.xyz/*.conf;

    location /api {
        proxy_pass http://127.0.0.1:8000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin-api {
        proxy_pass http://127.0.0.1:8000/admin-api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }

    access_log /www/wwwlogs/allin-bsc.xyz.log;
    error_log /www/wwwlogs/allin-bsc.xyz.error.log;
}
EOF

nginx -t
systemctl restart nginx

curl -I http://127.0.0.1/
curl -I http://127.0.0.1/admin-api || true
