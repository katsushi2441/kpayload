/**
 * 生成済みの紹介文と日本語判定を合わせて、投入用カタログを作る。
 *
 * 手作りの46件(data/oss-catalog.json)とは混ぜない。自動収集分は
 * data/oss-catalog-harvested.json に分けて置き、seedが両方を読む。
 *
 * 使い方: npx tsx scripts/build-catalog.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CATEGORY_FIX, displayName } from './display-names'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const harvestDir = path.join(root, 'data', 'harvest')
const enrichedDir = path.join(harvestDir, 'enriched')
const jaDir = path.join(harvestDir, 'ja')

type Enriched = {
  name: string
  slug: string
  category: string
  funnel: 'oss' | 'prototype'
  summary: string
  description: string
  license: string
  licenseTier?: string
  licenseNote?: string | null
  japaneseStatus: string
  officialUrl: string
  githubUrl: string
  featured: boolean
  stars: number
  language: string | null
  jaFileCount?: number
  jaSamplePaths?: Array<{ text: string }>
  githubCreatedAt?: string | null
  githubPushedAt?: string | null
  kind?: string
  useCases: Array<{ text: string }>
  keywords: Array<{ text: string }>
  faqs: Array<{ question: string; answer: string }>
}

// 「開発に使う」判定のものは enrich.ts が全部 devtools に入れるため、
// 1カテゴリに数百件が集中してカテゴリページが肥大する(2026-08-23に363KBまで膨張)。
// 名前・要約・キーワードの規則で振り分け直す。LLMは使わない（件数分の再生成は現実的でない）。
const RULES: Array<[string, RegExp]> = [
  ['aidev', /(llm|ai\s*エージェント|エージェント基盤|生成ai|rag|プロンプト|chatgpt|claude|gpt|推論|モデル(を|の)?(実行|提供|管理)|ローカルai|ベクトル|埋め込み)/i],
  ['analytics', /(可視化|ダッシュボード|bi\b|ビジネスインテリジェンス|データ分析|メトリク|グラフ|レポーティング|観測|オブザーバ)/i],
  ['lowcode', /(ローコード|ノーコード|low.?code|no.?code|管理画面|社内ツール|内部ツール|admin\s*panel|フォームビルダー|ドラッグ)/i],
  ['sitegen', /(静的サイト|サイトジェネレータ|static\s*site|ウェブサイト(を|の)?(構築|生成)|ブログエンジン|ヘッドレスcms|headless)/i],
  ['automation', /(ワークフロー|自動化|オートメーション|ジョブ|スケジュ|パイプライン|連携基盤|iPaaS|webhook)/i],
  ['monitoring', /(監視|アラート|ログ(収集|管理|基盤)|障害|稼働状況|ヘルスチェック|apm)/i],
  ['media', /(音声|画像(生成|編集)|動画|映像|tts|音楽|字幕|読み上げ)/i],
  ['database', /(データベース|db\b|sql|nosql|データストア|キャッシュ|検索エンジン(を|の)?(構築|提供))/i],
  ['devsupport', /(コード(を|の)?(解析|生成|レビュー|補完)|開発(を|の)?(支援|効率)|リポジトリ|git|ci\/?cd|テスト(自動|フレーム)|デバッグ|ドキュメント(生成|作成))/i],
]

function refineCategory(record: Enriched): string {
  if (record.funnel !== 'prototype' || record.category !== 'devtools') return record.category
  const hay = [record.name, record.summary, record.description,
    ...(record.keywords || []).map((k) => k.text)].join(' ')
  for (const [cat, rx] of RULES) {
    if (rx.test(hay)) return cat
  }
  return 'devtools'
}

const jaByRepo = new Map<string, { status: string; hitCount: number; samples: string[] }>()
try {
  for (const name of await fs.readdir(jaDir)) {
    if (!name.endsWith('.json')) continue
    const data = JSON.parse(await fs.readFile(path.join(jaDir, name), 'utf8')) as { full_name: string; status: string; hitCount?: number; samples?: string[] }
    jaByRepo.set(data.full_name.toLowerCase(), { status: data.status, hitCount: data.hitCount || 0, samples: data.samples || [] })
  }
} catch {
  console.log('日本語判定はまだ無い（detect-ja 未実行）。japaneseStatus は 未調査 のままにする。')
}

const existing = JSON.parse(await fs.readFile(path.join(root, 'data', 'oss-catalog.json'), 'utf8')) as Array<{ slug: string }>
const handmade = new Set(existing.map((item) => item.slug))

const records: Enriched[] = []
const files = (await fs.readdir(enrichedDir)).filter((name) => name.endsWith('.json'))
for (const name of files) {
  const record = JSON.parse(await fs.readFile(path.join(enrichedDir, name), 'utf8')) as Enriched
  if (handmade.has(record.slug)) continue // 手作り分を自動生成で上書きしない
  const repo = (record.githubUrl || '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').toLowerCase()
  const ja = jaByRepo.get(repo)
  if (ja) {
    record.japaneseStatus = ja.status
    record.jaFileCount = ja.hitCount
    record.jaSamplePaths = ja.samples.slice(0, 5).map((text) => ({ text }))
  }
  // 生成側で空文字が混じることがある。投入時に必須エラーで全体が止まるので落とす。
  record.faqs = (record.faqs || []).filter((f) => (f.question || '').trim() && (f.answer || '').trim())
  record.useCases = (record.useCases || []).filter((u) => (u.text || '').trim())
  record.keywords = (record.keywords || []).filter((k) => (k.text || '').trim())
  if (record.faqs.length < 2 || record.useCases.length < 3 || !record.keywords.length) continue
  record.category = CATEGORY_FIX[record.slug] || refineCategory(record)
  // GitHubのリポジトリ名がそのまま製品名になっているので、公式表記に寄せる
  record.name = displayName(record.slug, record.name)
  records.push(record)
}

records.sort((a, b) => (b.stars || 0) - (a.stars || 0))

const out = path.join(root, 'data', 'oss-catalog-harvested.json')
await fs.writeFile(out, JSON.stringify(records, null, 2))

const byFunnel = records.reduce<Record<string, number>>((acc, item) => { acc[item.funnel] = (acc[item.funnel] || 0) + 1; return acc }, {})
const byJa = records.reduce<Record<string, number>>((acc, item) => { acc[item.japaneseStatus] = (acc[item.japaneseStatus] || 0) + 1; return acc }, {})
console.log(`カタログ生成: ${records.length} 件 → ${out}`)
console.log('出口別:', byFunnel)
console.log('日本語対応:', byJa)
