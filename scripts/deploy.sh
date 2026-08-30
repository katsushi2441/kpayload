#!/usr/bin/env bash
# 生成物を本番へ配置する。sync-to-kurage.sh が触るファイルを漏らさないための入口。
#
# なぜ必要か（2026-08-24）:
#   sync-to-kurage.sh は oss/ だけでなく vibe-oss.html も書き換える（掲載件数と
#   カタログ一覧を差し込む）。配置のとき oss/ しか送らなかったため、本番の
#   「1120件のOSSを掲載」が実際の1710件と食い違ったまま公開されていた。
#
# 使い方:
#   set -a; . /home/kojima/work/aixec/.env; set +a
#   bash scripts/deploy.sh oss         # kurage: oss/ + vibe-oss.html
#   bash scripts/deploy.sh ai-system   # exbridge: ai-system/
#   bash scripts/deploy.sh zenn       # exbridge: zenn/
#   bash scripts/deploy.sh all
set -uo pipefail

: "${FTP_HOST:?FTP_HOST が未設定です。aixec/.env を読み込んでください}"
: "${FTP_USER:?FTP_USER が未設定です}"
: "${FTP_PASS:?FTP_PASS が未設定です}"

put_tree() {   # $1=ローカルの起点ディレクトリ $2=リモートのweb配下 $3=送るパス群
  local base="$1" remote="$2"; shift 2
  local ok=0 ng=0 f
  cd "$base"
  for f in $(find "$@" -type f | sort); do
    if curl -s --fail --ftp-create-dirs -T "$f" \
         "ftp://${FTP_USER}:${FTP_PASS}@${FTP_HOST}/web/${remote}/$f" --max-time 60 -o /dev/null; then
      ok=$((ok+1))
    else
      ng=$((ng+1)); echo "  失敗: $f"
    fi
  done
  echo "  ${base}: 成功${ok} 失敗${ng}"
  return $(( ng > 0 ))
}

what="${1:-all}"
rc=0

if [ "$what" = "oss" ] || [ "$what" = "all" ]; then
  echo "== kurage.exbridge.jp: oss/ と vibe-oss.html =="
  # vibe-oss.html を必ず含める。件数の差し込み先がここなので、忘れると本番だけ古い数字になる
  put_tree /home/kojima/work/kurage_web kurage_exbridge_jp oss vibe-oss.html || rc=1
fi

if [ "$what" = "ai-system" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: ai-system/ =="
  put_tree /home/kojima/work/exbridge_jp exbridge_jp ai-system || rc=1
fi

if [ "$what" = "solution" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: solution/ =="
  put_tree /home/kojima/work/exbridge_jp exbridge_jp solution || rc=1
fi

if [ "$what" = "saas" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: saas/ =="
  put_tree /home/kojima/work/exbridge_jp exbridge_jp saas || rc=1
fi

if [ "$what" = "helpdesk" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: helpdesk/ =="
  put_tree /home/kojima/work/exbridge_jp exbridge_jp helpdesk || rc=1
fi

if [ "$what" = "zenn" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: zenn/ =="
  put_tree /home/kojima/work/exbridge_jp exbridge_jp zenn || rc=1
fi

exit $rc
