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
  { repo: 'horilla-opensource/horilla', category: 'hr' },
  { repo: 'frappe/hrms', category: 'hr' },
  { repo: 'haiwen/seafile', category: 'storage' },
  { repo: 'owncloud/ocis', category: 'storage' },
  { repo: 'zulip/zulip', category: 'groupware' },
  { repo: 'akaunting/akaunting', category: 'accounting' },
  { repo: 'invoiceninja/invoiceninja', category: 'accounting' },
  { repo: 'bigbluebutton/bigbluebutton', category: 'groupware' },
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
