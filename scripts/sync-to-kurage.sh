#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="/home/kojima/work/kurage_web"

test -f "$ROOT/dist/oss/index.html"
mkdir -p "$TARGET/oss"
cp -a "$ROOT/dist/oss/." "$TARGET/oss/"
npx tsx "$ROOT/scripts/inject-vibe-oss.ts"
echo "Synced static catalog to $TARGET/oss and updated vibe-oss.html"
# vibe-oss.html も書き換えている。配置のとき oss/ だけ送ると、本番の掲載件数が
# 古いまま残る（2026-08-24 に「1120件」と表示されたまま公開されていた）。
echo "配置は scripts/deploy.sh を使うこと（oss/ と vibe-oss.html の両方を送る）"
