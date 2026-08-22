/**
 * リポジトリに日本語ロケールが入っているかを実測する。
 *
 * 「日本語化して納品する」が売り物なので、ここを推測で書くと商談が壊れる。
 * GitHubのツリーAPI(1リポジトリ1コール)でファイル一覧を取り、日本語ロケールの
 * 実ファイルを数える。
 *
 * 較正の根拠(2026-08-22 実測):
 *   - espocrm/espocrm      … application/Espo/Core/Templates/i18n/ja_JP/*.json が多数 → あり
 *   - krayin/laravel-crm   … public/admin/build/assets/ja.es-*.js の1件のみ。これは
 *                            バンドル済みの成果物で、本体は未対応(実際に我々が全訳PRを出した)
 *   - frappe/helpdesk      … 0件。実際に日本語ファイルが無く、我々がPR #3713を出した
 * よってビルド成果物を除外してから数える。
 *
 * 使い方: npx tsx scripts/detect-ja.ts [件数]
 * 出力:   data/harvest/ja/<owner>__<repo>.json
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const harvestDir = path.join(root, 'data', 'harvest')
const outDir = path.join(harvestDir, 'ja')

const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()

// 配布用に固めたファイル。中に ja が含まれても、本体が日本語対応とは限らない。
const ARTIFACT = /(^|\/)(node_modules|vendor|dist|build|out|target|\.git|coverage|__pycache__)(\/|$)|\.min\.(js|css)$|(^|\/)public\/(admin\/)?(build|assets)\//i
// 日本語ロケールとみなすパス
const JA = /(^|\/)(ja|ja[-_]JP|japanese)([-_.][^/]*)?(\/|$)|(^|\/)(README|readme)[-_.]ja(\.[a-z]+)?$/

type Selected = { repo: { full_name: string } }

const selected = JSON.parse(await fs.readFile(path.join(harvestDir, 'selected.json'), 'utf8')) as Selected[]
await fs.mkdir(outDir, { recursive: true })

const limit = Number(process.argv[2] || '0')
const queue = selected.slice(0, limit > 0 ? limit : undefined)

let done = 0
let fetched = 0
let cachedCount = 0
const tally = new Map<string, number>()

for (const item of queue) {
  const full = item.repo.full_name
  const file = path.join(outDir, `${full.replace('/', '__')}.json`)
  try {
    const prior = JSON.parse(await fs.readFile(file, 'utf8')) as { status: string }
    tally.set(prior.status, (tally.get(prior.status) || 0) + 1)
    cachedCount++
    done++
    continue
  } catch {
    // 未取得
  }

  let status = '未調査'
  let hits: string[] = []
  try {
    const res = await fetch(`https://api.github.com/repos/${full}/git/trees/HEAD?recursive=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kpayload-detect-ja' },
    })
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset') || '0') * 1000
      const waitMs = Math.max(5000, Math.min(120_000, reset - Date.now() + 2000))
      console.log(`  rate limited, waiting ${Math.round(waitMs / 1000)}s`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      continue
    }
    if (res.ok) {
      const body = (await res.json()) as { tree?: Array<{ path: string }>; truncated?: boolean }
      if (body.truncated) {
        status = '未調査'
      } else {
        hits = (body.tree || []).map((node) => node.path).filter((p) => !ARTIFACT.test(p) && JA.test(p))
        status = hits.length >= 5 ? '日本語ファイルあり' : hits.length >= 1 ? '日本語ファイルが一部のみ' : '日本語ファイルなし'
      }
    }
  } catch (error) {
    console.log(`  ! ${full}: ${(error as Error).message}`)
  }

  await fs.writeFile(file, JSON.stringify({ full_name: full, status, hitCount: hits.length, samples: hits.slice(0, 5) }, null, 2))
  tally.set(status, (tally.get(status) || 0) + 1)
  fetched++
  done++
  if (done % 50 === 0) console.log(`  ${done}/${queue.length} 判定済み`)
  await new Promise((resolve) => setTimeout(resolve, 350))
}

console.log(`detect-ja done: 取得${fetched} 既存${cachedCount}`)
for (const [status, count] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${status.padEnd(22)}${count}`)
