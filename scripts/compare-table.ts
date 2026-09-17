/**
 * 分類ページ用の「比較表」。ライセンス・日本語ロケール（実測）・最終更新・スター・当社の日本語デモ・導入キットを
 * 1行1製品で横に並べる。/ai-system/c/<分類>/（exbridge）と /oss/c/<分類>/（kurage）の両方が使う。
 *
 * なぜ要るか（2026-09-17 GSC 実測）: 「顧客管理 オープンソース」「biツール オープンソース」「crm オープンソース 比較」
 * などの語で分類ページは 14〜29 位に出ているがクリックされない。1ページ目の競合は比較表を持つ。
 * 既存の「まずどれを見れば」表は根拠が文章の1セルに畳まれていて、列で比べられない。
 * 数字は各リポジトリの GitHub 公開情報を当社で数えたもの（作文しない）。
 */
import { DEMOS, demoUrl } from './demos'
import { KAPP_KITS } from './kapp-kits'

export type CmpRow = {
  slug: string
  name: string
  license?: string | null
  japaneseStatus?: string
  jaFileCount?: number
  stars?: number | null
  githubPushedAt?: string | null
  featured?: boolean
}

export type CmpOpts = {
  /** 詳細ページの土台 URL（末尾スラッシュ無し）。行の名前リンク先は `${base}/${slug}/` */
  base: string
  /** 計測用 ref */
  ref: string
  /** 検索で使われる一般名（例: 顧客管理システム（CRM）） */
  noun: string
  h: (s: string) => string
  attr: (s: string) => string
  /** 「2026年9月17日」の形 */
  today: string
  /** 表に出す上限（既定 12） */
  max?: number
  /** 集計用の全件（省略時は rows） */
  all?: CmpRow[]
}

const monthsSince = (iso?: string | null): number | null => {
  const t = Date.parse(String(iso || ''))
  return Number.isNaN(t) ? null : (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.4)
}

const jaCell = (r: CmpRow): string => {
  const s = r.japaneseStatus || ''
  const n = typeof r.jaFileCount === 'number' ? `（${r.jaFileCount}ファイル）` : ''
  if (s === '日本語ファイルあり') return `あり${n}`
  if (s === '日本語ファイルが一部のみ') return `一部${n}`
  if (s === '日本語ファイルなし') return 'なし'
  if (!s || s === '未調査') return '未調査'
  return s
}

const updCell = (r: CmpRow): string => {
  const m = monthsSince(r.githubPushedAt)
  if (m === null) return '—'
  if (m < 1) return '1か月以内'
  if (m < 12) return `約${Math.round(m)}か月前`
  return `約${Math.round(m / 12)}年前`
}

export function compareTable(rows: CmpRow[], o: CmpOpts): string {
  const { h, attr } = o
  const max = o.max ?? 12
  const all = o.all ?? rows
  const shown = rows.slice(0, max)
  if (!shown.length) return ''
  const hasJa = (r: CmpRow) => r.japaneseStatus === '日本語ファイルあり' || r.japaneseStatus === '日本語ファイルが一部のみ'
  const jaCount = all.filter(hasJa).length
  const noJaCount = all.filter((r) => r.japaneseStatus === '日本語ファイルなし').length
  const demoRows = all.filter((r) => DEMOS[r.slug])
  const kitRows = all.filter((r) => KAPP_KITS[r.slug] && !KAPP_KITS[r.slug].product)
  const uniq = (xs: string[]) => [...new Set(xs)]
  const tr = shown.map((r) => {
    const kit = KAPP_KITS[r.slug]
    const kitCell = kit
      ? `<a href="https://kappstore.exbridge.jp/app.php?id=${kit.id}&ref=${attr(o.ref)}-cmp">${kit.product ? '当社製品あり' : '導入キットあり'}</a>`
      : '—'
    const demoCell = DEMOS[r.slug]
      ? `<a href="${demoUrl(r.slug, `${o.ref}-cmp`)}" target="_blank" rel="noopener">触れる</a>`
      : '—'
    const stars = r.stars == null ? '—' : Number(r.stars).toLocaleString('en-US')
    return `<tr><th><a href="${o.base}/${attr(r.slug)}/">${h(r.name)}</a></th>` +
      `<td data-label="ライセンス">${h(r.license || '不明')}</td>` +
      `<td data-label="日本語ロケール（実測）">${h(jaCell(r))}</td>` +
      `<td data-label="最終更新">${h(updCell(r))}</td>` +
      `<td data-label="GitHubスター">${stars}</td>` +
      `<td data-label="当社の日本語デモ">${demoCell}</td>` +
      `<td data-label="導入キット">${kitCell}</td></tr>`
  }).join('')
  const jaLine = `掲載${all.length}件のうち、GitHub の公開ファイルに日本語ロケールが実在するのは${jaCount}件、無いのは${noJaCount}件（${o.today}時点）。` +
    (demoRows.length ? `当社が日本語化して触れる状態で公開しているのは${demoRows.length}件（${uniq(demoRows.map((r) => r.name)).slice(0, 6).map(h).join('・')}）。` : '') +
    (kitRows.length ? `導入キット（手順書・docker構成・バックアップまで）があるのは${uniq(kitRows.map((r) => r.name)).slice(0, 6).map(h).join('・')}。` : '')
  return `<section><div class="panel">
<h2 id="compare">${h(o.noun)}のオープンソース 比較表（ライセンス・日本語対応・導入キット）</h2>
<p>${jaLine}</p>
<div class="table-wrap"><table class="stack-table"><thead><tr><th>名前</th><th>ライセンス</th><th>日本語ロケール（実測）</th><th>最終更新</th><th>GitHubスター</th><th>当社の日本語デモ</th><th>導入キット</th></tr></thead><tbody>
${tr}
</tbody></table></div>
<p class="note">日本語ロケールは各リポジトリの公開ファイル一覧から日本語の実ファイルを数えた結果、最終更新は GitHub の最終 push 日です。ライセンスは導入前に必ず原文で確認してください。上限${max}件、並びは規模・日本語・デモ・更新の実測値による機械的な順位です。</p>
</div></section>`
}
