set -e

cat >/www/server/panel/vhost/nginx/0.default.conf <<'EOF'
server
{
    listen 80 default_server;
    server_name _;
    index index.html;
    root /var/www/allin;

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
systemctl reload nginx

curl -I http://127.0.0.1/
curl -I http://127.0.0.1/admin-api || true
curl -I -H "Host: allin-bsc.xyz" http://127.0.0.1/
curl -I -H "Host: allin-bsc.xyz" http://127.0.0.1/admin-api || true
