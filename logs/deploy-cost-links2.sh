#!/bin/bash
set -a; . /home/kojima/work/aixec/.env; set +a
cd /home/kojima/work/kpayload
for t in ai-system solution saas helpdesk zenn; do bash scripts/deploy.sh $t 2>&1 | grep -E '成功|失敗'; done
cd /home/kojima/work/exbridge_jp; ok=0; for f in $(find outsourcing -type f | sort); do curl -sS --fail --ftp-create-dirs -T "$f" "ftp://${FTP_USER}:${FTP_PASS}@${FTP_HOST}/web/exbridge_jp/$f" >/dev/null && ok=$((ok+1)); done; echo "outsourcing put $ok"
echo "DEPLOY2_DONE $(date +%H:%M)"
