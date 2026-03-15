set -e

echo "=== extension files ==="
find /www/server/panel/vhost/nginx/extension/allin-bsc.xyz -maxdepth 2 -type f -print | sort || true

echo "=== extension content ==="
for file in $(find /www/server/panel/vhost/nginx/extension/allin-bsc.xyz -maxdepth 2 -type f | sort); do
  echo "--- $file ---"
  sed -n '1,240p' "$file" || true
done

echo "=== recent error log ==="
tail -n 120 /www/wwwlogs/allin-bsc.xyz.error.log || true
