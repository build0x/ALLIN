set -e

for url in \
  "http://allin-bsc.xyz/assets/images/poker_table_green.png" \
  "http://allin-bsc.xyz/public/assets/images/poker_table_green.png" \
  "http://allin-bsc.xyz/static/public/assets/images/poker_table_green.png" \
  "http://allin-bsc.xyz/static/media/poker_table_green.845d24506efa40f25a3d.png" \
  "http://allin-bsc.xyz/assets/images/card_top_red.png" \
  "http://allin-bsc.xyz/public/assets/images/card_top_red.png" \
  "http://allin-bsc.xyz/static/public/assets/images/card_top_red.png" \
  "http://allin-bsc.xyz/static/media/card_top_red.50c68a95f5d460677907.png" \
  "http://allin-bsc.xyz/static/media/dealer_chip.c4acacfe96660105882e.png" \
  "http://allin-bsc.xyz/static/media/chips_in_icon.0b32047afa629d9bccd4.png"
do
  echo "=== $url ==="
  curl -I "$url" || true
done
