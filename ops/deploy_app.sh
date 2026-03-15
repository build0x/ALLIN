set -e

cd /opt/allin/backend
npm ci --omit=dev

pm2 delete allin-backend || true
pm2 start dist/index.js --name allin-backend --time
pm2 save
pm2 startup systemd -u root --hp /root || true

cat >/etc/nginx/sites-available/default <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/allin;
    index index.html;

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
}
EOF

nginx -t
systemctl restart nginx

sleep 5
pm2 status
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/admin-api || true
