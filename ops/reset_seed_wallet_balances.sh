set -e

sudo -u postgres psql -d "poker-pocket-ts" -c "
UPDATE poker.users
SET money = 0,
    allin_balance = 0
WHERE login_method = 'wallet'
  AND money = 1000
  AND allin_balance = 5000
  AND COALESCE(total_deposited, 0) = 0
  AND COALESCE(total_withdrawn, 0) = 0
  AND COALESCE(lifetime_burned, 0) = 0
  AND COALESCE(locked_table_balance, 0) = 0
  AND COALESCE(locked_tournament_balance, 0) = 0
  AND COALESCE(pending_withdrawal, 0) = 0;
"
