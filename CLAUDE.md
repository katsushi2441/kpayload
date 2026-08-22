# Kurage Payload CMS Agent Guide

## Purpose

This project owns the public OSS catalog for `kurage.exbridge.jp/oss/`.
Payload CMS is the editing layer. Static HTML is the production delivery layer.

## Source of truth

- Payload SQLite collection: `oss-projects`
- Reproducible initial data: `data/oss-catalog.json`
- Generated output: `dist/oss/`
- Public Git-owned copy: `/home/kojima/work/kurage_web/oss/`

## Required workflow

1. Update data through Payload or the seed JSON.
2. Run `npm run export` and `npm run check`.
3. Run `npm run sync` to update `kurage_web`.
4. Test public HTML at desktop and mobile widths.
5. Commit and push `kurage_web`, then FTP the generated `oss/` tree and changed integration files.

Never present an LP as a deployment case study. Brain links may only be shown when a real URL exists.
