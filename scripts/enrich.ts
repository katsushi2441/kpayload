/**
 * 採用した候補に日本語の紹介文を付けて、kpayloadのカタログ形式にする。
 *
 * 生成は Ollama (192.168.0.3) の gemma4。gemma4は思考型なので think:false を必ず渡す。
 * 1件ずつ data/harvest/enriched/<slug>.json に保存し、再実行では作り直さない。
 * 途中で止めても続きから再開できる。
 *
 * 使い方:
 *   npx tsx scripts/enrich.ts            # 全件
 *   npx tsx scripts/enrich.ts 50         # 先頭50件だけ
 *   CONCURRENCY=2 npx tsx scripts/enrich.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const harvestDir = path.join(root, 'data', 'harvest')
const enrichedDir = path.join(harvestDir, 'enriched')

const OLLAMA = process.env.OLLAMA_API || 'http://192.168.0.3:11434/api/generate'
const MODEL = process.env.OLLAMA_MODEL || 'gemma4:12b-it-qat'
const CONCURRENCY = Number(process.env.CONCURRENCY || '2')

type Repo = {
  full_name: string
  html_url: string
  homepage: string | null
  description: string | null
  stargazers_count: number
  language: string | null
  license: { spdx_id?: string | null } | null
  topics: string[]
  created_at?: string
  pushed_at?: string
}
type Selected = { repo: Repo; category: string; funnel: 'oss' | 'prototype'; topics: string[] }

const selected = JSON.parse(await fs.readFile(path.join(harvestDir, 'selected.json'), 'utf8')) as Selected[]
const existing = JSON.parse(await fs.readFile(path.join(root, 'data', 'oss-catalog.json'), 'utf8')) as Array<{ slug: string; githubUrl?: string | null }>

const takenSlugs = new Set(existing.map((item) => item.slug))
const existingRepos = new Set(existing.map((item) => (item.githubUrl || '').toLowerCase().replace(/\/+$/, '')).filter(Boolean))

function makeSlug(repo: Repo): string {
  const short = (repo.full_name.split('/')[1] || repo.full_name).toLowerCase()
  const base = short.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'oss'
  if (!takenSlugs.has(base)) { takenSlugs.add(base); return base }
  const owner = (repo.full_name.split('/')[0] || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const withOwner = `${owner}-${base}`.replace(/^-+|-+$/g, '')
  if (!takenSlugs.has(withOwner)) { takenSlugs.add(withOwner); return withOwner }
  let n = 2
  while (takenSlugs.has(`${base}-${n}`)) n++
  takenSlugs.add(`${base}-${n}`)
  return `${base}-${n}`
}

function prompt(repo: Repo): string {
  return `次のオープンソースソフトウェアを分類し、日本の中小企業の担当者に向けた紹介文をJSONで書いてください。

名前: ${repo.full_name.split('/')[1] || repo.full_name}
説明(英語): ${repo.description || ''}
主なトピック: ${(repo.topics || []).slice(0, 8).join(', ')}
主な言語: ${repo.language || '不明'}
ライセンス: ${repo.license?.spdx_id || '不明'}
スター数: ${repo.stargazers_count}

まず kind を次の3つから選んでください。判断を誤ると誤った提案になるので慎重に。
- "business-app": 業務の担当者がそのまま使う完成したアプリ。導入して画面や項目を自社向けに変えて納品できる。
  例) 顧客管理、問合せ管理、在庫管理、勤怠、会計、予約、EC、社内ポータル、グループウェア
- "dev-tool": 開発者が何かを作るために使う道具。単体では業務担当者の仕事にならない。
  例) 静的サイトジェネレータ、フレームワーク、CLI、データベース、監視基盤、可視化基盤、
      ローカルLLM実行環境、エージェント基盤、CI、コード生成
- "library": 他のプログラムに組み込む部品。単体で起動して使う画面を持たない。
  例) Python/JavaScriptのライブラリ、SDK、画像処理ツールキット、モデル実装

守ること:
- 英語の説明から読み取れる事実だけを書く。機能を創作しない。
- 日本語対応の有無、価格、導入実績は書かない（未確認のため）。
- 「弊社が対応します」などの営業文は書かない。
- summary は「〜です」で終える体言止めにしない文にする。

次のJSONだけを出力してください。前後に説明や\`\`\`は書かないでください。
{"kind":"business-app|dev-tool|library","summary":"一文の要約(60字以内)","description":"4文の説明(300字前後)","useCases":["用途1","用途2","用途3","用途4","用途5"],"keywords":["検索語1","検索語2","検索語3","検索語4","検索語5","検索語6"],"faqs":[{"question":"質問1","answer":"回答1(100字前後)"},{"question":"質問2","answer":"回答2(100字前後)"},{"question":"質問3","answer":"回答3(100字前後)"},{"question":"質問4","answer":"回答4(100字前後)"}]}`
}

type Generated = {
  kind: 'business-app' | 'dev-tool' | 'library'
  summary: string
  description: string
  useCases: string[]
  keywords: string[]
  faqs: Array<{ question: string; answer: string }>
}

function parseGenerated(raw: string): Generated | null {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try { parsed = JSON.parse(text.slice(start, end + 1)) } catch { return null }
  const data = parsed as Partial<Generated>
  if (typeof data.summary !== 'string' || typeof data.description !== 'string') return null
  if (!Array.isArray(data.useCases) || !Array.isArray(data.keywords) || !Array.isArray(data.faqs)) return null
  const kind = data.kind === 'dev-tool' || data.kind === 'library' || data.kind === 'business-app' ? data.kind : null
  if (!kind) return null
  const useCases = data.useCases.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
  const keywords = data.keywords.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8)
  const faqs = data.faqs
    .filter((item): item is { question: string; answer: string } => Boolean(item) && typeof item.question === 'string' && typeof item.answer === 'string')
    .slice(0, 5)
  // 中身が薄いものは載せない。字数が足りないページを量産しても集客にならない。
  const volume = data.summary.length + data.description.length + useCases.join('').length + faqs.map((item) => item.question + item.answer).join('').length
  if (volume < 500) return null
  if (!data.summary.trim() || !data.description.trim() || useCases.length < 3 || !keywords.length || faqs.length < 2) return null
  return { kind, summary: data.summary.trim(), description: data.description.trim(), useCases, keywords, faqs }
}

async function generate(repo: Repo): Promise<Generated | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // gemma4は思考型。think:false を外すと隠れ推論がnum_predictを食って応答が空になる。
        // format:"json" が無いと、項目を増やしたときに括弧が壊れたJSONを返す（実測3/3失敗）。
        body: JSON.stringify({ model: MODEL, prompt: prompt(repo), stream: false, think: false, format: 'json', options: { temperature: 0.3, num_predict: 2000 } }),
        signal: AbortSignal.timeout(300_000),
      })
      if (!res.ok) throw new Error(`ollama ${res.status}`)
      const body = (await res.json()) as { response?: string }
      const parsed = parseGenerated(body.response || '')
      if (parsed) return parsed
    } catch (error) {
      if (attempt === 2) console.log(`  ! ${repo.full_name}: ${(error as Error).message}`)
    }
  }
  return null
}

await fs.mkdir(enrichedDir, { recursive: true })

const limit = Number(process.argv[2] || '0')
const queue = selected
  .filter((item) => !existingRepos.has(item.repo.html_url.toLowerCase().replace(/\/+$/, '')))
  .slice(0, limit > 0 ? limit : undefined)

let done = 0
let made = 0
let skipped = 0
let failed = 0
let dropped = 0
const started = Date.now()

async function worker(): Promise<void> {
  while (queue.length) {
    const item = queue.shift()
    if (!item) return
    const { repo, category, funnel } = item
    const file = path.join(enrichedDir, `${repo.full_name.replace('/', '__')}.json`)
    try {
      await fs.access(file)
      skipped++
      done++
      continue
    } catch {
      // 未生成
    }
    const generated = await generate(repo)
    done++
    if (!generated) { failed++; continue }
    // トピック由来のfunnelより、実物を読んだ分類を優先する。
    if (generated.kind === 'library') { dropped++; continue }
    const resolvedFunnel: 'oss' | 'prototype' = generated.kind === 'business-app' ? 'oss' : 'prototype'
    const resolvedCategory = generated.kind === 'business-app' ? category : (funnel === 'oss' ? 'devtools' : category)
    const homepage = (repo.homepage || '').trim()
    const record = {
      name: repo.full_name.split('/')[1] || repo.full_name,
      slug: makeSlug(repo),
      category: resolvedCategory,
      funnel: resolvedFunnel,
      kind: generated.kind,
      summary: generated.summary,
      description: generated.description,
      license: repo.license?.spdx_id || '不明',
      // 日本語対応は別途 detect-ja で実測する。ここで推測して書かない。
      japaneseStatus: '未調査',
      officialUrl: /^https?:\/\//i.test(homepage) ? homepage : repo.html_url,
      githubUrl: repo.html_url,
      featured: false,
      stars: repo.stargazers_count,
      language: repo.language,
      githubCreatedAt: repo.created_at || null,
      githubPushedAt: repo.pushed_at || null,
      useCases: generated.useCases.map((text) => ({ text })),
      keywords: generated.keywords.map((text) => ({ text })),
      faqs: generated.faqs,
    }
    await fs.writeFile(file, JSON.stringify(record, null, 2))
    made++
    if (done % 20 === 0) {
      const rate = (Date.now() - started) / 1000 / Math.max(1, made)
      console.log(`  ${done} 件処理 (生成${made} 既存${skipped} 部品として除外${dropped} 失敗${failed})  ${rate.toFixed(1)}秒/件`)
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()))
console.log(`enrich done: 生成${made} 既存${skipped} 部品として除外${dropped} 失敗${failed} → ${enrichedDir}`)
