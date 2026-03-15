set -e

curl -I -H "Host: allin-bsc.xyz" http://127.0.0.1/
curl -I http://allin-bsc.xyz/ || true
curl -I http://allin-bsc.xyz/admin-api || true
