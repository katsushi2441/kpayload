#!/usr/bin/env bash
# exbridge.jp/news/（ニュースと国会の記録カード）を作り直して、変わったファイルだけ送る。
# xb4g/giin/scripts/x_reply_jobs.py が毎時の返信候補のあとに呼ぶ（kdeck の worker は PATH に nvm が無いので node を直に足す）。
set -uo pipefail
export PATH="/home/kojima/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /home/kojima/work/kpayload
/usr/bin/python3 /home/kojima/work/xb4g/giin/scripts/news_cards.py --export || exit 1
npx tsx scripts/build-news.ts || exit 1
set -a; . /home/kojima/work/aixec/.env; set +a
bash scripts/deploy.sh news
