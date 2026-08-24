/**
 * GitHubから業務アプリ／AI開発ツールの候補を集める。
 *
 * GitHub Search APIは1クエリ1,000件が上限なので、トピック×スター数レンジで
 * 母数を刻んで積む。結果は data/harvest/<topic>__<slice>.json にそのまま残し、
 * 再実行時はそのファイルがあればAPIを叩かない（レート制限で中断しても続けられる）。
 *
 * 使い方:
 *   npx tsx scripts/harvest.ts business    # 業務アプリのみ
 *   npx tsx scripts/harvest.ts ai          # AI開発ツールのみ
 *   npx tsx scripts/harvest.ts all
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'harvest')

type Funnel = 'oss' | 'prototype'
type TopicSpec = { topic: string; category: string; funnel: Funnel }

// 業務アプリ = 完成品を改造して納品できるもの。カテゴリはkpayloadのselect値に揃える。
const BUSINESS_TOPICS: TopicSpec[] = [
  // 2026-08-24 追加: SaaS入口(/saas/)から推薦したいOSSが、こちらの巡回トピックと
  // GitHub側のトピック名が違うために1件も取れていなかった。
  // 例) nextcloud は groupware ではなく collaboration / file-sharing を付けている。
  { topic: 'collaboration', category: 'groupware', funnel: 'oss' },
  { topic: 'file-sharing', category: 'dms', funnel: 'oss' },
  { topic: 'cloud-storage', category: 'dms', funnel: 'oss' },
  { topic: 'chat', category: 'groupware', funnel: 'oss' },
  { topic: 'team-chat', category: 'groupware', funnel: 'oss' },
  { topic: 'video-conferencing', category: 'groupware', funnel: 'oss' },
  { topic: 'videoconference', category: 'groupware', funnel: 'oss' },
  { topic: 'appointment-scheduling', category: 'booking', funnel: 'oss' },
  { topic: 'calendar', category: 'booking', funnel: 'oss' },
  { topic: 'hr', category: 'hr', funnel: 'oss' },
  { topic: 'hrms', category: 'hr', funnel: 'oss' },
  { topic: 'attendance', category: 'hr', funnel: 'oss' },
  { topic: 'payroll', category: 'hr', funnel: 'oss' },
  { topic: 'invoice', category: 'accounting', funnel: 'oss' },
  { topic: 'expenses', category: 'accounting', funnel: 'oss' },
  { topic: 'crm', category: 'crm', funnel: 'oss' },
  { topic: 'erp', category: 'accounting', funnel: 'oss' },
  { topic: 'cms', category: 'cms', funnel: 'oss' },
  { topic: 'ecommerce', category: 'commerce', funnel: 'oss' },
  { topic: 'e-commerce', category: 'commerce', funnel: 'oss' },
  { topic: 'helpdesk', category: 'support', funnel: 'oss' },
  { topic: 'ticketing', category: 'support', funnel: 'oss' },
  { topic: 'project-management', category: 'project', funnel: 'oss' },
  { topic: 'kanban', category: 'project', funnel: 'oss' },
  { topic: 'accounting', category: 'accounting', funnel: 'oss' },
  { topic: 'invoicing', category: 'accounting', funnel: 'oss' },
  { topic: 'lms', category: 'lms', funnel: 'oss' },
  { topic: 'wiki', category: 'knowledge', funnel: 'oss' },
  { topic: 'knowledge-base', category: 'knowledge', funnel: 'oss' },
  { topic: 'forum', category: 'forum', funnel: 'oss' },
  { topic: 'groupware', category: 'groupware', funnel: 'oss' },
  { topic: 'hrm', category: 'hr', funnel: 'oss' },
  { topic: 'time-tracking', category: 'hr', funnel: 'oss' },
  { topic: 'inventory-management', category: 'inventory', funnel: 'oss' },
  { topic: 'point-of-sale', category: 'pos', funnel: 'oss' },
  { topic: 'booking', category: 'booking', funnel: 'oss' },
  { topic: 'scheduling', category: 'booking', funnel: 'oss' },
  { topic: 'survey', category: 'survey', funnel: 'oss' },
  { topic: 'document-management', category: 'dms', funnel: 'oss' },
  { topic: 'digital-signature', category: 'esign', funnel: 'oss' },
  { topic: 'low-code', category: 'lowcode', funnel: 'oss' },
  { topic: 'no-code', category: 'lowcode', funnel: 'oss' },
  { topic: 'email-marketing', category: 'marketing', funnel: 'oss' },
  { topic: 'marketing-automation', category: 'marketing', funnel: 'oss' },
  { topic: 'business-intelligence', category: 'analytics', funnel: 'oss' },
]

// AI開発ツール = 改造して納品する対象ではなく、これを使って作るもの。
const AI_TOPICS: TopicSpec[] = [
  { topic: 'llm', category: 'aidev', funnel: 'prototype' },
  { topic: 'mcp', category: 'aidev', funnel: 'prototype' },
  { topic: 'ai-agent', category: 'aidev', funnel: 'prototype' },
  { topic: 'rag', category: 'aidev', funnel: 'prototype' },
  { topic: 'agent', category: 'aidev', funnel: 'prototype' },
  { topic: 'chatbot', category: 'aidev', funnel: 'prototype' },
  { topic: 'ollama', category: 'aidev', funnel: 'prototype' },
  { topic: 'text-to-speech', category: 'media', funnel: 'prototype' },
  { topic: 'image-generation', category: 'media', funnel: 'prototype' },
  { topic: 'video-generation', category: 'media', funnel: 'prototype' },
  { topic: 'automation', category: 'devtools', funnel: 'prototype' },
  { topic: 'self-hosted', category: 'devtools', funnel: 'prototype' },
]

// 1,000件上限を避けるためのスター数レンジ。上限側は件数が少ないので粗くてよい。
const STAR_SLICES = ['50..79', '80..129', '130..219', '220..399', '400..799', '800..1999', '2000..4999', '5000..14999', '>=15000']

const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()

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

async function search(q: string, page: number): Promise<{ items: Repo[]; total: number }> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${page}`
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kpayload-harvest' },
    })
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset') || '0') * 1000
      const waitMs = Math.max(5000, Math.min(90_000, reset - Date.now() + 2000))
      console.log(`  rate limited, waiting ${Math.round(waitMs / 1000)}s`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      continue
    }
    if (!res.ok) throw new Error(`GitHub ${res.status} for ${q}`)
    const body = (await res.json()) as { items: Repo[]; total_count: number }
    return { items: body.items || [], total: body.total_count || 0 }
  }
  throw new Error(`GitHub search kept failing: ${q}`)
}

const specs = (() => {
  const mode = process.argv[2] || 'business'
  const limit = Number(process.argv[3] || '0')
  const pick = mode === 'business' ? BUSINESS_TOPICS
    : mode === 'ai' ? AI_TOPICS
    : mode === 'all' ? [...BUSINESS_TOPICS, ...AI_TOPICS]
    : (() => { throw new Error(`Unknown mode: ${mode} (business | ai | all)`) })()
  return limit > 0 ? pick.slice(0, limit) : pick
})()

await fs.mkdir(outDir, { recursive: true })
let fetched = 0
let cached = 0

for (const spec of specs) {
  for (const slice of STAR_SLICES) {
    const safeSlice = slice.replace(/[^0-9a-z]+/gi, '_')
    const file = path.join(outDir, `${spec.topic}__${safeSlice}.json`)
    try {
      await fs.access(file)
      cached++
      continue
    } catch {
      // 未取得なので進む
    }
    const stars = slice.startsWith('>=') ? `stars:${slice}` : `stars:${slice}`
    const q = `topic:${spec.topic} ${stars}`
    const collected: Repo[] = []
    let total = 0
    for (let page = 1; page <= 10; page++) {
      const { items, total: t } = await search(q, page)
      if (page === 1) total = t
      collected.push(...items)
      if (items.length < 100) break
      await new Promise((resolve) => setTimeout(resolve, 2200))
    }
    await fs.writeFile(file, JSON.stringify({ topic: spec.topic, category: spec.category, funnel: spec.funnel, query: q, total, items: collected }, null, 0))
    fetched++
    console.log(`  ${spec.topic} ${slice}: ${collected.length}/${total}`)
    await new Promise((resolve) => setTimeout(resolve, 2200))
  }
}

console.log(`harvest done: ${fetched} queries fetched, ${cached} already cached, output in ${outDir}`)
