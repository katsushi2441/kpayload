/**
 * 「開発に使う」側のカテゴリを細かく分け直す。
 *
 * enrich.ts は dev-tool と判定したものを全部 devtools に入れていたため、
 * 449件が1カテゴリに固まり、カテゴリページが363KBまで膨らんだ
 * (他カテゴリは20〜55KB)。カタログが1,937件に伸びると実用外になる。
 *
 * 再判定はLLMを使わず、名前・要約・トピックの規則で行う。
 * 449件をLLMで判定し直すと数時間かかるうえ、分類の揺れも出るため。
 *
 * 使い方:
 *   npx tsx scripts/recategorize.ts --dry-run   # 振り分け結果だけ見る
 *   npx tsx scripts/recategorize.ts             # data/oss-catalog-harvested.json を更新
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'data', 'oss-catalog-harvested.json')

type Rec = {
  name: string
  slug: string
  category: string
  funnel: string
  summary: string
  description: string
  keywords?: Array<{ text: string }>
}

// 上から順に当てる。最初に一致したものを採用する。
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

const LABEL: Record<string, string> = {
  aidev: 'AI開発基盤', analytics: '分析・BI', lowcode: 'ローコード開発',
  sitegen: 'サイト構築・静的生成', automation: '自動化・連携', monitoring: '監視・運用',
  media: '動画・音声・配信', database: 'データベース', devsupport: '開発支援ツール',
  devtools: '開発者ツール',
}

function classify(rec: Rec): string {
  const hay = [rec.name, rec.summary, rec.description, ...(rec.keywords || []).map((k) => k.text)].join(' ')
  for (const [cat, rx] of RULES) {
    if (rx.test(hay)) return cat
  }
  return 'devtools'
}

const dryRun = process.argv.includes('--dry-run')
const records = JSON.parse(await fs.readFile(target, 'utf8')) as Rec[]
const before = records.filter((r) => r.category === 'devtools').length

const moved: Record<string, number> = {}
for (const rec of records) {
  if (rec.category !== 'devtools') continue
  const next = classify(rec)
  moved[next] = (moved[next] || 0) + 1
  if (!dryRun) rec.category = next
}

console.log(`devtools ${before}件 の振り分け:`)
for (const [cat, n] of Object.entries(moved).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(LABEL[cat] || cat).padEnd(20)} ${String(n).padStart(4)}件  (${cat})`)
}
if (dryRun) {
  console.log('\ndry-run のため書き込みません')
} else {
  await fs.writeFile(target, JSON.stringify(records, null, 2))
  console.log(`\n${target} を更新しました`)
}
