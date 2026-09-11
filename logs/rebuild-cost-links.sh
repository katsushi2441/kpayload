#!/bin/bash
# 全ページ群のフッターに受託開発リンクを入れて再生成→配置
set -a; . /home/kojima/work/aixec/.env; set +a
cd /home/kojima/work/kpayload
for b in saas aisystem solution politech outsourcing zenn helpdesk; do echo "== build-$b"; npx tsx scripts/build-$b.ts 2>&1 | grep -v 'npm notice' | tail -1; done
echo "== oss export/check/sync"; npm run -s export 2>&1 | tail -1; npm run -s check 2>&1 | tail -1; npm run -s sync 2>&1 | tail -1
echo "== deploy all"; bash scripts/deploy.sh all 2>&1 | grep -E '成功|失敗|==' 
echo "== outsourcing (deploy.shに無ければ直接)"; grep -q '"outsourcing"' scripts/deploy.sh || { cd /home/kojima/work/exbridge_jp; ok=0; for f in $(find outsourcing -type f | sort); do curl -sS --fail --ftp-create-dirs -T "$f" "ftp://${FTP_USER}:${FTP_PASS}@${FTP_HOST}/web/exbridge_jp/$f" >/dev/null && ok=$((ok+1)); done; echo "outsourcing put $ok"; }
echo "REBUILD_DONE $(date +%H:%M)"
