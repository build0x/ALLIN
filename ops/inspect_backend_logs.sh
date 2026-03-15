set -e

cd /opt/allin/backend
pm2 logs allin-backend --lines 120 --nostream
ls -la
ls -la dist | sed -n '1,120p'
