#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="/home/kojima/work/kurage_web"

test -f "$ROOT/dist/oss/index.html"
mkdir -p "$TARGET/oss"
cp -a "$ROOT/dist/oss/." "$TARGET/oss/"
npx tsx "$ROOT/scripts/inject-vibe-oss.ts"
echo "Synced static catalog to $TARGET/oss and updated vibe-oss.html"
