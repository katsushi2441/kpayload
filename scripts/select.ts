/**
 * 収集した候補から、カタログに載せるものだけを残す。
 *
 * 落とすもの:
 *   - 基盤・ライブラリ・CLI（改造して納品する対象でも、使って作る道具でもない）
 *   - 学習用リポジトリ（awesome / tutorial / boilerplate / 書籍）
 *   - 保守されていないもの、ライセンス不明のもの、説明が無いもの
 *
 * 使い方: npx tsx scripts/select.ts
 * 出力:   data/harvest/selected.json
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const harvestDir = path.join(root, 'data', 'harvest')

type Repo = {
  full_name: string
  html_url: string
  homepage: string | null
  description: string | null
  stargazers_count: number
  language: string | null
  license: { spdx_id?: string | null; name?: string | null } | null
  topics: string[]
  archived: boolean
  fork: boolean
  pushed_at: string
  created_at: string
}
type Bucket = { topic: string; category: string; funnel: 'oss' | 'prototype'; items: Repo[] }

// 学習用・一覧系。ソフトウェアではないので納品対象にならない。
const NAME_BLOCK = /(^|[-_/])(awesome|awesome-list|cheatsheet|cheat-sheet|roadmap|tutorials?|examples?|samples?|demos?|boilerplate|starter|scaffold|template|templates|books?|course|courses|handbook|guide|guides|learning|learn|curriculum|interview|resources|collection|list|links|papers|notes|docs|documentation|spec|specs|rfc)([-_/]|$)/i
// 「roadmap」単体では落とさない。製品の機能名として書かれることが多く、
// OpenProject の "roadmaps, Gantt charts" で誤爆して落ちていた（2026-08-25）。
const DESC_BLOCK = /(awesome list|curated list|a list of|collection of (links|resources|papers)|learning resources|study (notes|guide)|interview questions|cheat ?sheet|(developer|learning|study|beginner|career)s? road ?map|road ?map to (learn|become|master)|book about|free books)/i

// ライブラリ・部品。単体で業務に使えないので、どちらの出口にも乗らない。
const LIB_TOPICS = new Set([
  'library', 'libraries', 'sdk', 'api-client', 'api-wrapper', 'wrapper', 'binding', 'bindings',
  'plugin', 'plugins', 'theme', 'themes', 'extension', 'extensions', 'package', 'module',
  'component', 'components', 'ui-kit', 'design-system', 'icons', 'fonts', 'polyfill', 'middleware',
])
// OS・基盤。Linux や Apache の側。
const INFRA_TOPICS = new Set([
  'kernel', 'operating-system', 'compiler', 'programming-language', 'interpreter', 'emulator',
  'firmware', 'bootloader', 'driver', 'filesystem', 'networking', 'dns', 'vpn', 'proxy',
  'load-balancer', 'web-server', 'reverse-proxy', 'kubernetes', 'terraform', 'ansible',
  'infrastructure-as-code', 'container', 'virtualization', 'hypervisor',
])

const STALE_MONTHS = 18

const files = (await fs.readdir(harvestDir)).filter((name) => name.endsWith('.json') && name.includes('__'))
if (!files.length) throw new Error('No harvest files. Run scripts/harvest.ts first.')

const seen = new Map<string, { repo: Repo; category: string; funnel: 'oss' | 'prototype'; topics: Set<string> }>()
for (const name of files) {
  const bucket = JSON.parse(await fs.readFile(path.join(harvestDir, name), 'utf8')) as Bucket
  for (const repo of bucket.items) {
    const key = repo.full_name.toLowerCase()
    const hit = seen.get(key)
    if (hit) {
      hit.topics.add(bucket.topic)
      // 業務アプリ側の判定を優先する（同じリポジトリが両方のトピックに出ることがある）
      if (bucket.funnel === 'oss' && hit.funnel === 'prototype') { hit.funnel = 'oss'; hit.category = bucket.category }
      continue
    }
    seen.set(key, { repo, category: bucket.category, funnel: bucket.funnel, topics: new Set([bucket.topic]) })
  }
}

/**
 * GitHubが判定できなかったライセンス(NOASSERTION)を、本文から判定した結果。
 * scripts/resolve-license.py が作る。無ければ従来どおり全部落とす。
 *
 * これを入れる前は、他の条件を全部通ったものだけで782件が「no license」で
 * 落ちていた。中身は n8n・dify・nocodb・metabase・odoo・strapi・directus・
 * twenty・outline・medusa という、業務OSSとして最も検索需要のある製品ばかり。
 */
type Resolved = { license: string | null; tier: string | null; note: string | null }
let resolved: Record<string, Resolved> = {}
try {
  resolved = JSON.parse(await fs.readFile(path.join(harvestDir, 'licenses.json'), 'utf8'))
} catch { /* 未生成なら従来動作 */ }
/** 掲載してよい区分。判定不能(null)と、提供元との個別契約(eula)は載せない。 */
const OK_TIERS = new Set(['osi', 'osi-copyleft', 'osi-network-copyleft', 'source-available', 'dual'])

const staleBefore = new Date()
staleBefore.setMonth(staleBefore.getMonth() - STALE_MONTHS)

const reasons = new Map<string, number>()
const bump = (reason: string) => reasons.set(reason, (reasons.get(reason) || 0) + 1)

const kept: Array<{ repo: Repo; category: string; funnel: 'oss' | 'prototype'; topics: string[]
  licenseName: string; licenseTier: string; licenseNote: string | null }> = []
for (const entry of seen.values()) {
  const { repo } = entry
  const shortName = repo.full_name.split('/')[1] || repo.full_name
  const desc = repo.description || ''
  const spdx = repo.license?.spdx_id || ''

  if (repo.archived) { bump('archived'); continue }
  if (repo.fork) { bump('fork'); continue }
  if (!desc.trim()) { bump('no description'); continue }
  let licenseName = spdx
  let licenseTier = spdx && spdx !== 'NOASSERTION' ? 'osi' : null
  let licenseNote: string | null = null
  if (!spdx || spdx === 'NOASSERTION') {
    const r = resolved[repo.full_name]
    if (!r || !r.tier || !OK_TIERS.has(r.tier)) {
      bump(r && r.tier === 'eula' ? 'license: 個別契約' : 'license: 判定できず')
      continue
    }
    licenseName = r.license || 'ライセンス本文を参照'
    licenseTier = r.tier
    licenseNote = r.note
  }
  if (new Date(repo.pushed_at) < staleBefore) { bump(`stale (>${STALE_MONTHS}mo)`); continue }
  if (NAME_BLOCK.test(shortName)) { bump('learning/list repo (name)'); continue }
  if (DESC_BLOCK.test(desc)) { bump('learning/list repo (description)'); continue }

  const topics = repo.topics || []
  if (topics.some((topic) => LIB_TOPICS.has(topic))) { bump('library/component'); continue }
  if (topics.some((topic) => INFRA_TOPICS.has(topic))) { bump('infrastructure'); continue }

  kept.push({ repo, category: entry.category, funnel: entry.funnel, topics: [...entry.topics],
    licenseName: licenseName || '不明', licenseTier: licenseTier || 'osi', licenseNote })
}

kept.sort((a, b) => b.repo.stargazers_count - a.repo.stargazers_count)

const out = path.join(harvestDir, 'selected.json')
await fs.writeFile(out, JSON.stringify(kept, null, 2))

console.log(`候補 ${seen.size} 件 → 採用 ${kept.length} 件`)
console.log('落とした理由:')
for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${reason.padEnd(28)}${count}`)
const byFunnel = kept.reduce<Record<string, number>>((acc, item) => { acc[item.funnel] = (acc[item.funnel] || 0) + 1; return acc }, {})
console.log('出口別:', byFunnel)
console.log(`出力: ${out}`)
