# Kurage Payload CMS (kpayload)

Payload CMS 3 + SQLiteで、`https://kurage.exbridge.jp/oss/` のOSSカタログを管理します。
公開先は共用サーバーのため、Payload本体を公開サーバーで動かさず、管理データから静的HTMLを生成します。

## 初期化と公開生成

```bash
cp .env.example .env
# PAYLOAD_SECRETを十分長いランダム値に変更
npm install
npm run generate:types
npm run publish
```

- `npm run dev`: ローカル管理画面（`/admin`）
- `npm run seed`: `data/oss-catalog.json`をPayloadへ同期
- `npm run export`: `dist/oss/`へ静的ページを生成
- `npm run sync`: `kurage_web/oss/`へ同期し、`vibe-oss.html`の一覧を更新
- `npm run check`: 件数、URL、JSON-LD、導線を検査

## 編集

通常はPayload管理画面で編集します。初期データを恒久的に変える場合は`data/oss-catalog.json`も更新し、再seedで戻らないようにします。

秘密情報、APIキー、顧客情報は登録しません。公開情報だけを扱います。
