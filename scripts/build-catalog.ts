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
  japaneseStatus: string
  officialUrl: string
  githubUrl: string
  featured: boolean
  stars: number
  language: string | null
  useCases: Array<{ text: string }>
  keywords: Array<{ text: string }>
  faqs: Array<{ question: string; answer: string }>
}

const jaByRepo = new Map<string, string>()
try {
  for (const name of await fs.readdir(jaDir)) {
    if (!name.endsWith('.json')) continue
    const data = JSON.parse(await fs.readFile(path.join(jaDir, name), 'utf8')) as { full_name: string; status: string }
    jaByRepo.set(data.full_name.toLowerCase(), data.status)
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
  const status = jaByRepo.get(repo)
  if (status) record.japaneseStatus = status
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
