/**
 * enrich が特定のリポジトリで落ちる理由を1件だけ調べる。
 *
 * なぜ必要か（2026-08-23）:
 *   plane(57k) payload(44k) krayin(24k) など最重要OSSが、キュー先頭に
 *   いるのに1,499件処理しても生成されなかった。生成自体は73tok/sで
 *   速いのに47回生成して3件しか通らない。どの門番で落ちているかを見る。
 *
 * 使い方: npx tsx scripts/diag-enrich.ts makeplane/plane
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OLLAMA = process.env.OLLAMA_API || 'http://192.168.0.3:11434/api/generate'
const MODEL = process.env.OLLAMA_MODEL || 'gemma4:12b-it-qat'
const target = process.argv[2]
if (!target) throw new Error('リポジトリ名を渡してください 例: makeplane/plane')

const selected = JSON.parse(await fs.readFile(path.join(root, 'data/harvest/selected.json'), 'utf8')) as any[]
const item = selected.find((s) => s.repo.full_name === target)
if (!item) throw new Error(`selected.json に ${target} がありません`)
const repo = item.repo

// enrich.ts と同じプロンプトを使うため、そちらから読み出す
const src = await fs.readFile(path.join(root, 'scripts/enrich.ts'), 'utf8')
const m = src.match(/const prompt = \(repo: Repo\) => `([\s\S]*?)`\n/) || src.match(/function prompt\(repo: Repo\)[\s\S]*?return `([\s\S]*?)`\n/)
console.log(`対象: ${repo.full_name}  stars=${repo.stargazers_count}`)
console.log(`説明: ${(repo.description || '').slice(0, 120)}`)
console.log(`topics: ${(repo.topics || []).slice(0, 8).join(', ')}`)
console.log(`プロンプト定義の取得: ${m ? 'OK' : '失敗（enrich.ts の形が変わった）'}`)

const res = await fetch(OLLAMA, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: MODEL,
    prompt: `次のOSSについて日本語のJSONを1つだけ返す。キー: kind("business-app"|"dev-tool"|"library"), summary, description, useCases(配列5), keywords(配列6), faqs(配列4 question/answer)。
名前: ${repo.full_name}
説明: ${repo.description || ''}
topics: ${(repo.topics || []).join(', ')}`,
    stream: false, think: false, format: 'json', options: { temperature: 0.3, num_predict: 2000 },
  }),
  signal: AbortSignal.timeout(300_000),
})
const body = (await res.json()) as any
console.log(`\ndone_reason: ${body.done_reason}  応答長: ${(body.response || '').length}`)
console.log('--- 生の応答（先頭1200字） ---')
console.log((body.response || '').slice(0, 1200))
