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
#   bash scripts/deploy.sh politech   # exbridge: politech/（政治・政策キーワード）
#   bash scripts/deploy.sh outsourcing # exbridge: outsourcing/
#   bash scripts/deploy.sh vibeblog   # exbridge: vibeblog/（VWorkブログの移設先）
#   bash scripts/deploy.sh academic   # exbridge: academic/（論文トラッカー・東海の大学の研究×国会）
#   bash scripts/deploy.sh shocho     # exbridge: shocho/（省庁トラッカー・各府省の新着×国会）
#   bash scripts/deploy.sh news       # exbridge: news/（ニュースと国会の記録カード・毎時）
#   bash scripts/deploy.sh all
#
# なぜ dist/ を先に同期するか（2026-09-09）:
#   build-*.ts は kpayload/dist/<set>/ に書く。exbridge_jp/<set>/ は配置用のコピーで、
#   同期を忘れると古いページを本番へ送り直す（footer のリンク追加が反映されなかった前例）。
#   politech と oss は直接書くので同期対象外。--delete は付けない（手置きファイルを守る）。
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

sync_dist() {   # $1=セット名。kpayload/dist/<set>/ → exbridge_jp/<set>/（build の出力を配置用コピーへ）
  local set="$1" src="/home/kojima/work/kpayload/dist/$1/" dst="/home/kojima/work/exbridge_jp/$1/"
  if [ -d "$src" ]; then
    rsync -a "$src" "$dst" && echo "  dist/$set → exbridge_jp/$set 同期"
  else
    echo "  dist/$set が無いので同期しません（build 未実行なら exbridge_jp の現状を送ります）"
  fi
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
  sync_dist ai-system
  # 約2,900ページあるので、中身が変わったファイルだけを1接続で送る（2026-10-08。以前は1ファイル1接続）
  /usr/bin/python3 "$(dirname "$0")/put_changed.py" /home/kojima/work/exbridge_jp /web/exbridge_jp ai-system || rc=1
fi

if [ "$what" = "news" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: news/（ニュースと国会の記録カード） =="
  sync_dist news
  # 毎時作り直すので、中身が変わったファイルだけを1接続で送る
  /usr/bin/python3 "$(dirname "$0")/put_changed.py" /home/kojima/work/exbridge_jp /web/exbridge_jp news || rc=1
fi

if [ "$what" = "solution" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: solution/ =="
  sync_dist solution
  put_tree /home/kojima/work/exbridge_jp exbridge_jp solution || rc=1
fi

if [ "$what" = "saas" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: saas/ =="
  sync_dist saas
  put_tree /home/kojima/work/exbridge_jp exbridge_jp saas || rc=1
fi

if [ "$what" = "helpdesk" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: helpdesk/ =="
  sync_dist helpdesk
  put_tree /home/kojima/work/exbridge_jp exbridge_jp helpdesk || rc=1
fi

if [ "$what" = "politech" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: politech/ =="
  put_tree /home/kojima/work/exbridge_jp exbridge_jp politech || rc=1
fi
if [ "$what" = "zenn" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: zenn/ =="
  sync_dist zenn
  put_tree /home/kojima/work/exbridge_jp exbridge_jp zenn || rc=1
fi

if [ "$what" = "outsourcing" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: outsourcing/ =="
  sync_dist outsourcing
  put_tree /home/kojima/work/exbridge_jp exbridge_jp outsourcing || rc=1
fi

if [ "$what" = "vibeblog" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: vibeblog/ =="
  # 新しい記事に「〇〇とは？」の答えとよくある質問を付ける（2026-10-23）。作ったら記事を作り直してから送る
  /usr/bin/python3 "$(dirname "$0")/vibeblog-answers.py" --missing; arc=$?
  if [ "$arc" = "3" ]; then (cd "$(dirname "$0")/.." && npx tsx scripts/build-vibeblog.ts >/dev/null) || rc=1; elif [ "$arc" != "0" ]; then rc=1; fi
  # canonical-map.json は GitHub Pages 側の向け替えに使う作業用ファイル。公開しない。
  # AI検索向けの記事一覧（/vibeblog/llms.txt）を dist から作り直す（2026-10-08）
  /usr/bin/python3 "$(dirname "$0")/build_vibeblog_llms.py" || rc=1
  sync_dist vibeblog
  # 記事ごとのトップ画像（= og:image）。サーバーに無いものだけ1接続で送る
  /usr/bin/python3 "$(dirname "$0")/make_vibeblog_eyecatch.py" --sync || rc=1
  rm -f /home/kojima/work/exbridge_jp/vibeblog/canonical-map.json
  # 中身が変わったファイルだけを1接続で送る（2026-10-07。以前は約285ファイルを1つずつ別接続で送っていた。
  # 日付だけ違うページは送らない。記録は kpayload/outputs/put_changed_vibeblog.json）
  /usr/bin/python3 "$(dirname "$0")/put_changed.py" /home/kojima/work/exbridge_jp /web/exbridge_jp vibeblog || rc=1
fi

if [ "$what" = "shocho" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: shocho/ =="
  # Kurage 省庁トラッカー（2026-10-23）。build-shocho.ts が exbridge_jp/shocho/ に直接書く。変わったものだけ1接続で送る
  /usr/bin/python3 "$(dirname "$0")/put_changed.py" /home/kojima/work/exbridge_jp /web/exbridge_jp shocho || rc=1
  /usr/bin/python3 "$(dirname "$0")/make_shocho_ogp.py" || rc=1
  /usr/bin/python3 "$(dirname "$0")/put_changed.py" /home/kojima/work/exbridge_jp /web/exbridge_jp images/shocho || rc=1
fi

if [ "$what" = "academic" ] || [ "$what" = "all" ]; then
  echo "== exbridge.jp: academic/ =="
  # build-academic.ts は exbridge_jp/academic/ に直接書く。研究者ごとのページが多いので、中身が変わったものだけ1接続で送る
  /usr/bin/python3 "$(dirname "$0")/put_changed.py" /home/kojima/work/exbridge_jp /web/exbridge_jp academic || rc=1
  # OGP画像（テーマ・研究者・一覧）。build が書いた中身から描き、変わったものだけ送る
  /usr/bin/python3 "$(dirname "$0")/make_academic_ogp.py" || rc=1
  /usr/bin/python3 "$(dirname "$0")/put_changed.py" /home/kojima/work/exbridge_jp /web/exbridge_jp images/academic || rc=1
fi

exit $rc
