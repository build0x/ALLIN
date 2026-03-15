set -e

curl -L "https://raw.githubusercontent.com/christophschmalhofer/poker/master/XPokerEval/XPokerEval.TwoPlusTwo/HandRanks.dat" -o /opt/allin/backend/dist/HandRanks.dat

cd /opt/allin/backend
pm2 restart allin-backend
sleep 6
pm2 status
ss -tlnp | grep 8000 || true
curl -I http://127.0.0.1:8000/admin-api || true
