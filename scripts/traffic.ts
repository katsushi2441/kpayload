/**
 * Search Console の実アクセスを読み、カタログの並び順に反映させる。
 *
 * 「アクセスが多いOSSにLP・Brainを作って流動させる」という運用のうち、
 * 「アクセスが多いものを上に出す」を自動でやる部分。
 * 出力した data/traffic.json は build-static が読み、priority に加点する。
 *
 * 認証は gcloud の ADC（読み取りのみで足りる）。
 * 使い方: npx tsx scripts/traffic.ts [日数]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://kurage.exbridge.jp/'
const API = 'https://searchconsole.googleapis.com/webmasters/v3'

const token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], { encoding: 'utf8' }).trim()
let quota = ''
try {
  const adc = JSON.parse(await fs.readFile(path.join(process.env.HOME || '', '.config/gcloud/application_default_credentials.json'), 'utf8')) as { quota_project_id?: string }
  quota = adc.quota_project_id || ''
} catch {
  quota = ''
}

const days = Number(process.argv[2] || '90')
const end = new Date(Date.now() - 2 * 86_400_000)
const start = new Date(end.getTime() - days * 86_400_000)
const iso = (date: Date) => date.toISOString().slice(0, 10)

const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
if (quota) headers['x-goog-user-project'] = quota

const res = await fetch(`${API}/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    startDate: iso(start), endDate: iso(end), dimensions: ['page'], rowLimit: 5000,
    dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: '/oss/' }] }],
  }),
})
if (!res.ok) throw new Error(`Search Console ${res.status}: ${await res.text()}`)
const body = (await res.json()) as { rows?: Array<{ keys: string[]; clicks: number; impressions: number }> }

const traffic: Record<string, { clicks: number; impressions: number }> = {}
for (const row of body.rows || []) {
  const match = row.keys[0].match(/\/oss\/([a-z0-9-]+)\/?$/i)
  if (!match || match[1] === 'c') continue
  const slug = match[1]
  const prior = traffic[slug] || { clicks: 0, impressions: 0 }
  traffic[slug] = { clicks: prior.clicks + Math.round(row.clicks), impressions: prior.impressions + Math.round(row.impressions) }
}

const out = path.join(root, 'data', 'traffic.json')
await fs.writeFile(out, JSON.stringify({ measuredAt: iso(end), days, traffic }, null, 2))

const total = Object.values(traffic).reduce((acc, item) => ({ clicks: acc.clicks + item.clicks, impressions: acc.impressions + item.impressions }), { clicks: 0, impressions: 0 })
console.log(`Search Console 直近${days}日: ${Object.keys(traffic).length}件のOSSページ  クリック${total.clicks} 表示${total.impressions}`)
const top = Object.entries(traffic).sort((a, b) => b[1].impressions - a[1].impressions).slice(0, 10)
for (const [slug, item] of top) console.log(`  ${slug.padEnd(28)}表示${String(item.impressions).padStart(6)} クリック${item.clicks}`)
console.log(`出力: ${out}`)
