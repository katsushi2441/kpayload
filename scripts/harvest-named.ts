/**
 * リポジトリ名を直接指定して収集する。
 *
 * なぜ必要か（2026-08-24）:
 *   収集はGitHubのトピック検索で回しているが、トピックを付けていない
 *   リポジトリは何を巡回しても永久に入らない。
 *   例) calcom/cal.com のトピックは nextjs / prisma / trpc のような
 *       技術スタックだけで、booking も scheduling も付いていない。
 *   SaaSの入口(/saas/)から必ず推薦したいものは、名前で取りに行く。
 *
 * 出力は通常の収集と同じ形（data/harvest/named__<category>.json）なので、
 * select.ts はそのまま読む。
 *
 * 使い方: npx tsx scripts/harvest-named.ts
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'harvest')
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

/** SaaSの受け皿として必ず持っておきたいOSS。カテゴリは select/enrich が使う。 */
const WANTED: Array<{ repo: string; category: string }> = [
  // 2026-09-06 追加。防災・危機管理のOSSが1件も入っていなかった（競合 fal.co.jp の
  // TRANS MOD／緊急指令システムに相当する領域）。災害時に実際に使われている
  // 定番を名前で取りに行く。GitHubのトピックだけでは拾えない。
  { repo: 'ushahidi/platform', category: 'hazard' },          // 被害情報のクラウドソース集約・地図化
  { repo: 'sahana/eden', category: 'hazard' },                // 避難所・物資・安否の人道支援管理
  { repo: 'hotosm/tasking-manager', category: 'hazard' },     // 災害時の地図作成を分担する仕組み
  { repo: 'meshtastic/firmware', category: 'hazard' },        // 通信断でも使えるメッシュ無線
  { repo: 'getodk/central', category: 'hazard' },             // 現地調査・被害状況の集計
  { repo: 'kobotoolbox/kpi', category: 'hazard' },            // 人道支援の現地データ収集
  { repo: 'GeoNode/geonode', category: 'gis' },               // 地理空間データの共有基盤
  { repo: 'geosolutions-it/MapStore2', category: 'gis' },     // WebGISの地図アプリ基盤
  { repo: 'openlayers/openlayers', category: 'gis' },         // 地図表示ライブラリ
  { repo: 'Leaflet/Leaflet', category: 'gis' },               // 地図表示ライブラリ
  // 緊急連絡・アラートの基盤。災害時の一斉通知に使われる
  { repo: 'binwiederhier/ntfy', category: 'notify' },
  { repo: 'caronc/apprise', category: 'notify' },
  { repo: 'gotify/server', category: 'notify' },
  { repo: 'novuhq/novu', category: 'notify' },
  { repo: 'louislam/uptime-kuma', category: 'monitoring' },
  { repo: 'grafana/oncall', category: 'monitoring' },
  { repo: 'cachethq/cachet', category: 'monitoring' },
  // 2026-08-24時点で calcom/cal.com は calcom/cal.diy にリネームされている。
  // GitHubはリダイレクトして新しい名前で返すので、指定名と結果がずれる。
  { repo: 'calcom/cal.diy', category: 'booking' },
  { repo: 'alextselegidis/easyappointments', category: 'booking' },
  { repo: 'mattermost/mattermost', category: 'groupware' },
  { repo: 'RocketChat/Rocket.Chat', category: 'groupware' },
  { repo: 'nextcloud/server', category: 'groupware' },
  { repo: 'jitsi/jitsi-meet', category: 'groupware' },
  { repo: 'baserow/baserow', category: 'lowcode' },
  { repo: 'teableio/teable', category: 'lowcode' },
  { repo: 'Budibase/budibase', category: 'lowcode' },
  { repo: 'appsmithorg/appsmith', category: 'lowcode' },
  { repo: 'plankanban/planka', category: 'project' },
  { repo: 'opf/openproject', category: 'project' },
  { repo: 'kaleidos-ventures/taiga', category: 'project' },
  { repo: 'mattermost/focalboard', category: 'project' },
  { repo: 'mautic/mautic', category: 'marketing' },
  { repo: 'vendure-ecommerce/vendure', category: 'commerce' },
  { repo: 'chatwoot/chatwoot', category: 'support' },
  // 2026-08-25 追加。/saas/ から名指ししているのに収集されていなかったもの。
  // medusa は enrich が別リポジトリ(medusa-mobile-react-native)を拾っていて、
  // Shopifyの置き換え候補としては別物だった。
  { repo: 'medusajs/medusa', category: 'commerce' },
  { repo: 'orangehrm/orangehrm', category: 'hr' },
  // 2026-09-01 追加。GIS・商圏分析の空白を埋める(kshoken構築で選定した中核)。
  { repo: 'qgis/QGIS', category: 'gis' },
  { repo: 'postgis/postgis', category: 'gis' },
  { repo: 'valhalla/valhalla', category: 'gis' },
  { repo: 'Project-OSRM/osrm-backend', category: 'gis' },
  { repo: 'pgRouting/pgrouting', category: 'gis' },
  { repo: 'maplibre/maplibre-gl-js', category: 'gis' },
  { repo: 'keplergl/kepler.gl', category: 'gis' },
  { repo: 'geopandas/geopandas', category: 'gis' },
  { repo: 'gboeing/osmnx', category: 'gis' },
  { repo: 'uber/h3', category: 'gis' },
  { repo: 'GIScience/openrouteservice', category: 'gis' },
  { repo: 'Turfjs/turf', category: 'gis' },
  { repo: 'geoserver/geoserver', category: 'gis' },
  // 2026-09-01 追加。政治団体・市民参加(civic)。デジタル民主主義2030系は日本発
  { repo: 'civicrm/civicrm-core', category: 'civic' },
  { repo: 'decidim/decidim', category: 'civic' },
  { repo: 'consuldemocracy/consuldemocracy', category: 'civic' },
  { repo: 'compdemocracy/polis', category: 'civic' },
  { repo: 'digitaldemocracy2030/kouchou-ai', category: 'civic' },
  { repo: 'digitaldemocracy2030/polimoney', category: 'civic' },
  { repo: 'digitaldemocracy2030/idobata', category: 'civic' },
  { repo: 'codeforjapan/decidim-cfj', category: 'civic' },
  { repo: 'horilla-opensource/horilla', category: 'hr' },
  { repo: 'frappe/hrms', category: 'hr' },
  { repo: 'haiwen/seafile', category: 'storage' },
  { repo: 'owncloud/ocis', category: 'storage' },
  { repo: 'zulip/zulip', category: 'groupware' },
  { repo: 'akaunting/akaunting', category: 'accounting' },
  { repo: 'invoiceninja/invoiceninja', category: 'accounting' },
  { repo: 'bigbluebutton/bigbluebutton', category: 'groupware' },
  // 2026-08-25 追加。個人向けの月額サービスを置き換える受け皿。
  // 事業者が仕事で使っているものに限る（音楽・動画のような娯楽は入れない）。
  { repo: 'dani-garcia/vaultwarden', category: 'security' },
  { repo: 'passbolt/passbolt_api', category: 'security' },
  { repo: 'keepassxreboot/keepassxc', category: 'security' },
  { repo: 'FreshRSS/FreshRSS', category: 'knowledge' },
  { repo: 'miniflux/v2', category: 'knowledge' },
  { repo: 'shlinkio/shlink', category: 'marketing' },
  { repo: 'YOURLS/YOURLS', category: 'marketing' },
  { repo: 'languagetool-org/languagetool', category: 'knowledge' },
  { repo: 'laurent22/joplin', category: 'knowledge' },
  { repo: 'usememos/memos', category: 'knowledge' },
  { repo: 'activepieces/activepieces', category: 'automation' },
  { repo: 'huginn/huginn', category: 'automation' },
  { repo: 'actualbudget/actual', category: 'accounting' },
  { repo: 'Automattic/harper', category: 'knowledge' },
  { repo: 'textlint/textlint', category: 'knowledge' },
]

async function getRepo(full: string) {
  const res = await fetch(`https://api.github.com/repos/${full}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kpayload-harvest-named',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) return null
  return (await res.json()) as Record<string, unknown>
}

const byCategory = new Map<string, unknown[]>()
let ok = 0
for (const { repo, category } of WANTED) {
  const data = await getRepo(repo)
  if (!data) { console.log(`  取得できず: ${repo}`); continue }
  const list = byCategory.get(category) || []
  list.push(data)
  byCategory.set(category, list)
  ok++
}

await fs.mkdir(outDir, { recursive: true })
for (const [category, items] of byCategory) {
  const file = path.join(outDir, `named__${category}.json`)
  await fs.writeFile(file, JSON.stringify({ topic: `named-${category}`, category, funnel: 'oss', items }, null, 2))
  console.log(`  ${file}  ${items.length}件`)
}
console.log(`名前指定の収集: ${ok}/${WANTED.length} 件`)
