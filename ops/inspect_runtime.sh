set -e

pm2 logs allin-backend --lines 80 --nostream
ss -tlnp | grep 8000 || true
curl -I -H "Host: allin-bsc.xyz" http://127.0.0.1/ || true
curl -I -H "Host: allin-bsc.xyz" http://127.0.0.1/admin-api || true
