set -e
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y postgresql
npm install -g pm2

mkdir -p /opt/allin/backend /var/www/allin

systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='poker-pocket-ts'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE \"poker-pocket-ts\";"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -d "poker-pocket-ts" -c "CREATE SCHEMA IF NOT EXISTS poker AUTHORIZATION postgres;"
