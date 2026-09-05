/**
 * 3つ目の入口 exbridge.jp/saas/ を作る。
 *
 * 入口の違い:
 *   /oss/        OSSの名前が入口   「そのOSSは何か」
 *   /ai-system/  やりたいことが入口 「その業務をどうやるか」
 *   /saas/       SaaSの名前が入口   「いま使っている（検討している）サービスの代わりに何ができるか」
 *
 * なぜSaaS名なのか（2026-08-24 実測・キーワードプランナー日本）:
 *   「SaaS名 + 代替」はほぼ0件だった。「代替」は日本語の検索で使われない。
 *   一方「SaaS名 + 料金」には需要があり、競合も低い。
 *     kintone 料金 2,400 / マネーフォワード 料金 2,900 / freee 料金 1,300
 *     dropbox 料金 2,900 / zoom 料金 3,600 / slack 料金 2,400 …計36,000件/月
 *   「kintone OSS」「kintone オープンソース」は測定下限未満。つまり
 *   OSSという言葉で探している人はいない。ページ側で気づかせる設計にする。
 *
 * 書かないこと:
 *   - 他社の具体的な金額（未検証の数字は書かない。公式へリンクする）
 *   - 他社製品の否定（比較は事実だけ。SaaSのほうが良い場合も必ず書く）
 *   商標は各社のものである旨を明記する。
 */
import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import { SITE, KURAGE, TRIAL } from './site'
import { DEMOS, PROTO, demoUrl } from './demos'
import { kappKitCards } from './kapp-kits'
import { CAPABILITIES } from './capability'
import { ORG, orgLd, TODAY, TODAY_JA, h, attr, json, items, jaVerdict, styles,
         relatedNews, shell as baseShell, type Project } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'saas')
const BASE = `${SITE}/saas`

// できること(/ai-system/c/)への相互リンク。分類ページは build-aisystem が先に生成している前提で、
// 実在するディレクトリだけにリンクする（404を作らない）。
const capDirs = new Set<string>(await fs.readdir(path.join(root, 'dist', 'ai-system', 'c')).catch(() => [] as string[]))
// saas-list.json の ossCats はカタログ側の分類名。できることの key と違うものを橋渡しする。
const CAP_OF_SAAS_CAT: Record<string, string[]> = {
  analytics: ['bi', 'visualize'], project: ['project', 'task', 'kanban'], support: ['helpdesk', 'faq'], knowledge: ['wiki', 'manual'],
  hr: ['attendance', 'payroll'], marketing: ['mailmarketing', 'marketing'], commerce: ['ec', 'pos'], dms: ['dms', 'paperless'],
  accounting: ['accounting', 'invoice'], groupware: ['team', 'calendar'], contract: ['esign'],
  media: ['shortdrama', 'aivideo'],
}
function capLinks(s: Saas): string {
  const keys = new Set<string>()
  for (const c of s.ossCats) for (const k of CAP_OF_SAAS_CAT[c] || [c]) keys.add(k)
  const caps = CAPABILITIES.filter((c) => keys.has(c.key) && capDirs.has(c.key))
  if (!caps.length) return ''
  return `<section><div class="panel">
<h2>やりたいことから探すなら</h2>
<p>${h(s.name)}に限らず、同じ業務に使えるオープンソース（OSS）をライセンス・日本語対応・更新状況の実測つきで比較した一覧です。</p>
<p class="note">${caps.map((c) => `<a href="${SITE}/ai-system/c/${attr(c.key)}/?ref=saas-${attr(s.slug)}">${h(c.noun || c.label)}のオープンソース一覧・比較</a>`).join('　')}</p>
</div></section>`
}

const SHELL = {
  refPrefix: 'exbridge-saas',
  base: BASE,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${SITE}/contact.php">お問い合わせ</a>　<a href="${BASE}/">SaaSとOSSの対応表</a>　<a href="${SITE}/solution/">業種・業務別ソリューション</a>　<a href="${SITE}/ai-system/?ref=exbridge-saas">AIでできること</a>　<a href="${KURAGE}/oss/?ref=exbridge-saas">業務OSSカタログ</a>　<a href="${PROTO}/?ref=exbridge-saas">触れるデモ一覧</a>　<a href="${SITE}/outsourcing/">業務のAI自動化</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[], pvTags?: string[]) =>
  baseShell(t, d, u, b, l, { ...SHELL, pvTags })

type Saas = {
  slug: string; name: string; kana: string; vendor: string; category: string
  what: string; volume: number; ossCats: string[]; ossPicks: string[]
  /** 選び方の注意。製品ごとに事情が違うので、書けるものだけ手で書く */
  note?: string
}

const saasList = JSON.parse(await fs.readFile(path.join(root, 'data', 'saas-list.json'), 'utf8')) as Saas[]

const payload = await getPayload({ config })
const result = await payload.find({ collection: 'oss-projects', limit: 0, pagination: false, sort: 'name', depth: 0 })
const projects = result.docs as unknown as Project[]
const bySlug = new Map(projects.map((p) => [p.slug, p]))
const byCategory = new Map<string, Project[]>()
for (const p of projects) {
  const list = byCategory.get(p.category) || []
  list.push(p)
  byCategory.set(p.category, list)
}

/**
 * 推薦するOSS。名指しを優先し、足りなければ同カテゴリで補う。
 *
 * 補うときは「そのまま業務に使える完成品」(funnel=oss)だけにする。
 * 開発者向けの道具(funnel=prototype)を混ぜると、kintoneの代わりに
 * UIフレームワークを勧めることになる（実際に filament と strapi が
 * 混ざった。2026-08-24）。
 */
function ossFor(s: Saas): { list: Project[]; named: number } {
  const picked: Project[] = []
  const seen = new Set<string>()
  for (const slug of s.ossPicks) {
    const p = bySlug.get(slug)
    if (p && !seen.has(p.slug)) { picked.push(p); seen.add(p.slug) }
  }
  // 名指しが2件以上あるなら、カテゴリ補完はしない。
  // 正しいものが並んでいるところに1件でも的外れが混ざると、全部の信用が落ちる。
  const named = picked.length
  if (named >= 2) return { list: picked.slice(0, 8), named }

  // 数合わせをしない。カテゴリ補完は3件までで打ち切る。
  // 6件に揃えようとすると、Slackの代わりにお絵かきツール、Boxの代わりに
  // ファイル転送CLIが並ぶ（2026-08-24 に実際そうなった）。
  // 関係ないものを混ぜると、並んでいる正しいものまで信用されない。
  for (const cat of s.ossCats) {
    // 補完もライセンスの自由度が高い順にする。スター数だけで並べると、
    // 再販できないものが上に来て、当社が受託で使えないものを勧めることになる。
    const freedom = (p: Project) => ({ osi: 0, 'osi-copyleft': 1, 'osi-network-copyleft': 2,
      dual: 3, 'source-available': 4 } as Record<string, number>)[p.licenseTier || 'osi'] ?? 5
    const pool = (byCategory.get(cat) || [])
      .filter((p) => p.funnel !== 'prototype')
      .sort((a, b) => freedom(a) - freedom(b) || Number(b.stars || 0) - Number(a.stars || 0))
    for (const p of pool) {
      if (picked.length >= 3) break
      if (!seen.has(p.slug)) { picked.push(p); seen.add(p.slug) }
    }
  }
  return { list: picked.slice(0, 6), named }
}

/**
 * ライセンスから「当社が改変して納品できるか」を一言にする。
 * ライセンス名だけ出しても、再販できないことは読み取れない。
 */
function licenseVerdict(p: Project): string {
  // 手で作った46件には licenseTier が無い。SPDX名から補う
  // （空欄のままだと、制限が無いものほど情報が出ない逆転が起きる）。
  let tier = p.licenseTier
  if (!tier) {
    const l = (p.license || '').toUpperCase()
    if (/^(MIT|APACHE|BSD|ISC|MPL|ZLIB|UNLICENSE|CC0)/.test(l)) tier = 'osi'
    else if (/^AGPL/.test(l)) tier = 'osi-network-copyleft'
    else if (/^(GPL|LGPL|EPL|OSL|CDDL)/.test(l)) tier = 'osi-copyleft'
  }
  switch (tier) {
    case 'osi': return '制限なし'
    case 'osi-copyleft': return '可（配布時はソース公開の義務）'
    case 'osi-network-copyleft': return '可（社外公開時は改変部分の公開義務）'
    case 'source-available': return '自社利用のみ可・再販不可'
    case 'dual': return '一部の機能が別ライセンス'
    default: return '—'
  }
}

/**
 * 比較表のいちばん右。触れるデモと、買い切りで買える先を出す。
 * 自社製品(kappstore掲載)は lpUrl に商品ページが入っている。
 */
function cell(p: Project, saasSlug: string): string {
  const links: string[] = []
  if (DEMOS[p.slug]) {
    links.push(`<a href="${demoUrl(p.slug, `saas-${saasSlug}`)}" target="_blank" rel="noopener">触れる</a>`)
  } else if (p.demoUrl) {
    links.push(`<a href="${attr(p.demoUrl)}?ref=saas-${attr(saasSlug)}" target="_blank" rel="noopener">触れる</a>`)
  }
  const buy = p.buyUrl || (p.lpUrl && p.lpUrl.includes('kappstore') ? p.lpUrl : '')
  if (buy) {
    links.push(`<a href="${attr(buy)}${buy.includes('?') ? '&' : '?'}ref=saas-${attr(saasSlug)}" target="_blank" rel="noopener">買い切り</a>`)
  }
  return links.join(' / ') || '—'
}

/**
 * 推薦したOSSのうち、proto.exbridge.jp で実際に触れるものを出す。
 * 表の「触れる」リンクだけだと見落とされるので、IDとパスワードごと本文に置く。
 */
function demoBlock(s: Saas, oss: Project[]): string {
  const withDemo = oss.filter((p) => DEMOS[p.slug])
  if (!withDemo.length) return ''
  return `<section><div class="panel demo-panel">
<h2>${h(s.name)}の代わりになるか、いま触って確かめられます</h2>
<p>上の候補のうち${withDemo.length}件は、当社が日本語化して稼働させたものを公開しています。<strong>問い合わせも資料請求も要りません。</strong>${h(s.name)}で今やっている作業が同じようにできるか、ご自分の目で確かめてください。</p>
${withDemo.map((p) => `<div class="card" style="margin:0 0 10px"><h3>${h(p.name)}</h3><p>${h(DEMOS[p.slug].point)}</p>${DEMOS[p.slug].user ? `<dl class="demo-cred"><div><dt>ユーザー</dt><dd><code>${h(DEMOS[p.slug].user)}</code></dd></div><div><dt>パスワード</dt><dd><code>${h(DEMOS[p.slug].pass)}</code></dd></div></dl>` : `<p class="note">ログイン不要でそのまま使えます。</p>`}<p class="demo-actions"><a class="btn btn-main" href="${demoUrl(p.slug, `saas-${s.slug}`)}" target="_blank" rel="noopener">${h(p.name)}のデモを開く</a> <a class="btn" href="${SITE}/ai-system/${attr(p.slug)}/?ref=saas-${attr(s.slug)}">${h(p.name)}の詳細</a></p></div>`).join('')}
<p class="demo-note">デモのためメールは送信されません。データは公開の場所にあるので、実在の個人情報は入れないでください。定期的に初期化します。　<a href="${PROTO}/?ref=saas-${attr(s.slug)}">他のデモも見る</a></p>
</div></section>`
}

function detailPage(s: Saas, oss: Project[], others: Saas[], named: number): string {
  const url = `${BASE}/${s.slug}.html`
  // 検索語は「notion オープンソース」「backlog oss」「trello 料金」の形（GSC実測 2026-09-04）。
  // 「代わりになるオープンソース（OSS）」を先頭に置き、費用の話は後ろに回す。
  const title = `${s.name}の代わりになるオープンソース（OSS）${oss.length}件｜費用の見直し | 株式会社エクスブリッジ`
  const desc = `${s.name}のオープンソース版・OSSの代替を探している方へ。${s.name}（${s.vendor}）の料金は利用人数×月額で毎年かかり続けます。同じ業務をオープンソースで行えばライセンス費はかからず、ソースコードは自社に残ります。${oss.length}件の候補を、ライセンスと日本語対応の実測つきで掲載。`
  const kitCards = kappKitCards(oss.map((p) => ({ slug: p.slug, name: h(p.name) })), `saas-${s.slug}`)

  const faqs = [
    { q: `${s.name}のオープンソース版（OSS）はありますか？`,
      a: `${s.name}そのもののソースコードは公開されていませんが、同じ用途で使えるオープンソースはあります。当社が挙げているのは${oss.slice(0, 3).map((p) => p.name).join('・')}${oss.length > 3 ? `ほか${oss.length - 3}件` : ''}で、いずれもソースコードが公開されていて自社サーバーに置いて使えます。ライセンスと日本語対応は本文の表に実測を載せています。` },
    { q: `${s.name}の代わりにオープンソースを使うと、何が変わりますか？`,
      a: `毎年かかり続ける利用料が、最初の構築費用とサーバー代に置き換わります。ソースコードは自社に残るので、値上げや仕様変更に振り回されません。一方で、障害対応やバージョン更新は自社（または当社）の責任になります。人数が少なく標準機能で足りるうちは、${s.name}をそのまま使うほうが安く済むこともあります。` },
    { q: 'なぜ今、その選択肢が現実的になったのですか？',
      a: 'オープンソースを自社業務に合わせて直す作業に、これまでは人手と期間がかかっていました。AIエージェントと対話しながら実装するバイブコーディングで、その部分の費用が大きく下がりました。結果として、月額を払い続けるより、一度作って自社資産にするほうが総額で見合う場面が増えています。' },
    { q: `${s.name}から移行する場合、データは移せますか？`,
      a: `多くの場合、CSVやAPIでの書き出しに対応しているため移行できます。ただし項目の対応づけや、添付ファイル・履歴の扱いは製品ごとに違います。初日3時間の無料ヒアリングで、実際のデータを見たうえで可否と手間をお伝えします。移せないと判断した場合は、その旨を正直に申し上げます。` },
    { q: '費用はどのくらいかかりますか？',
      a: '土台にするオープンソースが決まっている場合は、合計10時間以内・税込110,000円からのカスタマイズと導入があります。何を使うか決まっていない場合は、名古屋市内なら1日3時間×5日間の計15時間・税別15万円のお試し導入で、実際に動くものを1つ以上作ります。初日3時間のヒアリングと提案は無料です。' },
    { q: '作ったものは自社のものになりますか？',
      a: 'なります。ソースコード一式をお渡しします。開発はお客様のPCとお客様名義のAIエージェントで行うので、作り方ごと社内に残ります。以後は自社で改造しても、他社に依頼しても構いません。' },
  ]

  const body = `<section class="hero"><div class="wrap">
<p class="kicker">SaaSとオープンソース</p>
<h1>${h(s.name)}の代わりになる<br>オープンソース（OSS）${oss.length}件</h1>
<p class="lead">${h(s.name)}は${h(s.what)}便利なサービスですが、料金は<strong>利用する人数×月額</strong>で、使い続ける限りかかり続けます。同じ業務をオープンソースで行えば、ライセンス費はかからず、ソースコードは自社に残ります。ここでは${h(s.name)}の代わりになるオープンソース（OSS）${oss.length}件を、ライセンスと日本語対応の実測つきで並べました。</p>
<p><a class="btn btn-main" href="${TRIAL}?ref=saas-${attr(s.slug)}">AI導入お試し実験を見る</a> <a class="btn" href="${KURAGE}/vibe-oss.html?ref=saas-${attr(s.slug)}">OSSのカスタマイズ（110,000円〜）</a></p>
</div></section>
${relatedNews('saas', s.slug)}
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">SaaSとOSSの対応表</a> / ${h(s.name)}</nav>

<section><div class="panel">
<h2>${h(s.name)}とは？</h2>
<p>${h(s.name)}とは、${h(s.what)}提供元は${h(s.vendor)}です。読み方は「${h(s.kana)}」。導入している企業は多く、標準機能だけで業務が回るのであれば、そのまま使い続けるのが最も手間がかかりません。</p>
<p class="note">料金の詳細は提供元の公式サイトをご確認ください。本ページでは金額を掲載していません（改定があるため、当社が転載すると古い情報が残ります）。</p>
</div></section>

<section><div class="panel">
<h2>${h(s.name)}の費用は、どういう仕組みですか？</h2>
<p>費用の仕組みとは、<strong>利用する人数と期間に比例して増える</strong>ということです。1人あたり月額◯円という形なので、社員が増えれば増え、使い続ける限り終わりません。3年、5年と積み上がると、システムを1つ作る金額を超えることがあります。</p>
<div class="table-wrap"><table><thead><tr><th>観点</th><th>${h(s.name)}（月額サービス）</th><th>オープンソース＋バイブコーディング</th></tr></thead><tbody>
<tr><th>費用の形</th><td>人数×月額が毎年かかり続ける</td><td>最初の構築費用と、以後はサーバー代のみ</td></tr>
<tr><th>ソースの所有</th><td>提供元が保有する</td><td>自社が保有する（お渡しします）</td></tr>
<tr><th>業務への適合</th><td>標準機能の範囲に業務を合わせる</td><td>自社の業務に合わせて画面と項目を変えられる</td></tr>
<tr><th>値上げ・仕様変更</th><td>提供元の判断に従うことになる</td><td>自社で決められる</td></tr>
<tr><th>障害対応・更新</th><td>提供元が行う</td><td>自社または委託先の責任になる</td></tr>
<tr><th>導入までの早さ</th><td>申し込んだその日から使える</td><td>構築の期間が必要（当社は計15時間を目安）</td></tr>
</tbody></table></div>
</div></section>

<section><div class="panel">
<h2>なぜ今、オープンソースが現実的になったのですか？</h2>
<p>理由は、<strong>オープンソースを自社業務に合わせて直す費用が下がったこと</strong>です。以前は、完成品を業務に合わせるだけで人手と期間がかかり、その分だけ月額サービスのほうが安く見えていました。</p>
<p>AIエージェントと対話しながら実装する「バイブコーディング」で、この部分の費用が大きく下がりました。当社の場合、土台にするオープンソースが決まっていれば<strong>合計10時間以内・税込110,000円から</strong>、日本語化・画面・項目・権限・連携の変更とサーバー導入までを行います。月額を払い続ける金額と比べてみてください。</p>
<ul class="checks">
<li><strong>固定費が消える</strong>——毎年かかり続ける利用料が、最初の構築費用に置き換わります</li>
<li><strong>業務に合う</strong>——標準機能に業務を合わせるのではなく、業務に合わせて画面と項目を変えられます</li>
<li><strong>資産とノウハウが残る</strong>——ソースコードと、AIを使った直し方が社内に残ります</li>
</ul>
</div></section>

<section><div class="panel">
<h2>${named >= 2 ? `${h(s.name)}と同じことができるオープンソース${oss.length}件` : `${h(s.name)}と近い分野で使われているオープンソース`}</h2>
<p>${named >= 2
  ? `以下は、${h(s.name)}が扱う業務と同じ用途に使えるオープンソースです。当社がGitHubの公開情報からライセンスと日本語対応を実測して並べています。名前をクリックすると、そのソフトで何をどう作るかの説明に移ります。`
  : `${h(s.name)}をそのまま置き換えられる定番は、現在調査中です。以下は近い分野で使われているもので、そのままの置き換えにはなりません。<strong>実際に何を土台にするかは、業務内容を伺ってから提案します</strong>。無理に当てはめて提案することはしません。`}</p>
<div class="table-wrap"><table><thead><tr><th>名前</th><th>できること</th><th>ライセンス</th><th>受託での構築・納品</th><th>日本語</th><th>デモ・購入</th></tr></thead><tbody>
${oss.map((p) => `<tr><th><a href="${SITE}/ai-system/${attr(p.slug)}/?ref=saas-${attr(s.slug)}">${h(p.name)}</a></th><td>${h(p.summary)}</td><td>${h(p.license)}</td><td>${h(licenseVerdict(p))}</td><td>${h(p.japaneseStatus)}</td><td>${cell(p, s.slug)}</td></tr>`).join('')}
</tbody></table></div>
<p class="note">並びはライセンスの自由度が高い順です。「制限なし」のものは、当社が改変して納品することに制約がありません。「再販不可」のものは御社が自社の業務で使う分には問題ありませんが、第三者へのホスティング提供はできません。日本語欄が「日本語ファイルなし」であれば、日本語化から着手します。</p>
${s.note ? `<div class="card" style="margin-top:14px"><h3>${h(s.name)}を置き換えるときの注意</h3><p>${h(s.note)}</p></div>` : ''}
</div></section>
${kitCards ? `<section><div class="panel">
<h2>自分で入れるなら（導入キット・買い切り製品）</h2>
<p>上の候補のうち、当社が実際に立てて手順書・設計テンプレート・docker構成・バックアップまでまとめた導入キットと、同じ用途で当社が作った設置手順つきの買い切り製品です。開発を依頼せず自社で${h(s.name)}から移りたい場合の早道です。</p>
${kitCards}
</div></section>` : ''}
${capLinks(s)}
${demoBlock(s, oss)}

<section><div class="panel">
<h2>${h(s.name)}を使い続けたほうがよいのは、どんな場合ですか？</h2>
<p>使い続けたほうがよい場合とは、<strong>標準機能で業務が回っていて、人数が少なく、社内に運用を見る人がいない場合</strong>です。人数が数名なら月額の総額は小さく、構築費用のほうが高くつきます。また障害対応や更新を自社で持てないなら、提供元に任せられる価値は大きいです。</p>
<p>当社は、見込みが立たない場合に「作らないほうがよい」と申し上げます。無理に置き換えることが目的ではありません。判断材料として、いまの利用人数と月額、そして不便に感じている点を教えていただければ、比較してお伝えします。</p>
</div></section>

<div class="cta">
<h2>${h(s.name)}からの見直しを、まず15時間で試す</h2>
<p>名古屋市内なら、1日3時間×5日間の計15時間・税別15万円で試せます。<strong>初日3時間のヒアリングと提案は無料</strong>です。土台にするオープンソースが決まっている場合は、税込110,000円からのカスタマイズと導入があります。</p>
<a class="btn btn-main" href="${TRIAL}?ref=saas-${attr(s.slug)}">AI導入お試し実験を見る</a>
<a class="btn" href="${KURAGE}/vibe-oss.html?ref=saas-${attr(s.slug)}">OSSのカスタマイズを見る</a>
<a class="btn" href="${KURAGE}/vibe-prototype.html?ref=saas-${attr(s.slug)}">動くデモを先に見る</a>
<a class="btn" href="${SITE}/contact.php?subject=${encodeURIComponent(s.name + 'の見直し相談')}">${h(s.name)}について相談する</a>
</div>

${others.length ? `<section><div class="panel"><h2>他のサービスから探す</h2>
<div class="cat-grid">${others.map((o) => `<a class="cat-card" href="${BASE}/${attr(o.slug)}.html"><b>${h(o.name)}</b><span>${h(o.vendor)}</span></a>`).join('')}</div>
<p class="note"><a href="${BASE}/">SaaSとOSSの対応表をすべて見る</a>　<a href="${SITE}/ai-system/?ref=saas-${attr(s.slug)}">やりたいことから探す</a></p>
</div></section>` : ''}

<section><div class="panel"><h2>よくあるご質問</h2>
${faqs.map((f) => `<div class="card" style="margin:0 0 10px"><h3>${h(f.q)}</h3><p>${h(f.a)}</p></div>`).join('')}
</div></section>

<section><div class="panel">
<p class="note">${h(s.name)}は${h(s.vendor)}の商標または登録商標です。本ページは当社が独自にまとめた比較情報であり、${h(s.vendor)}が提供・監修するものではありません。料金や機能は変更される場合があるため、最新の情報は提供元の公式サイトをご確認ください。</p>
</div></section>
</main>`

  const ld = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'Service', name: `${s.name}からのオープンソース移行支援`,
      description: desc, url, serviceType: 'OSS導入・日本語化・カスタマイズ・システム移行',
      areaServed: [{ '@type': 'City', name: '名古屋市' }, { '@type': 'Country', name: '日本' }],
      provider: { '@id': `${SITE}/#organization` },
      offers: { '@type': 'Offer', priceCurrency: 'JPY', price: '110000', url: `${KURAGE}/vibe-oss.html`,
        description: '土台にするOSSが決まっている場合。合計10時間以内・税込110,000円から。' } },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: `${s.name}と同じことができるオープンソース`,
      numberOfItems: oss.length,
      itemListElement: oss.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/ai-system/${p.slug}/`, name: p.name })) },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'ja',
      dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'SaaSとOSSの対応表', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: s.name, item: url }] },
  ]
  return shell(title, desc, url, body, ld, [s.slug])
}

function indexPage(list: Array<{ s: Saas; oss: Project[] }>): string {
  const title = 'SaaSの費用を、オープンソースで見直す｜サービス名から探す対応表 | 株式会社エクスブリッジ'
  const desc = `kintone、freee、Slack、Backlog、Zendesk など${list.length}のクラウドサービスについて、同じ業務をオープンソースで行う選択肢をまとめました。ライセンス費はかからず、ソースコードは自社に残ります。名古屋のシステム開発会社が導入まで行います。`
  const rows = [...list].sort((a, b) => b.s.volume - a.s.volume)
  const body = `<section class="hero"><div class="wrap">
<p class="kicker">SaaSとオープンソース</p>
<h1>SaaSの月額費用も、<br>パッケージソフトの年次ライセンス費用も、<br>OSS × AI開発でゼロにできます。</h1>
<p class="lead">クラウドサービスの月額も、パッケージソフトの保守・ライセンス更新料も、使い続ける限り毎年かかり続けます。同じ業務をオープンソースで行えば、<strong>この「払い続ける費用」がゼロになります</strong>（かかるのは最初の構築費用と、以後のサーバー代だけです）。これまではOSSを自社業務に合わせて直す手間が壁でしたが、<strong>AIによるバイブコーディングでその費用が大きく下がり</strong>、現実的な選択肢になりました。</p>
<p><a class="btn btn-main" href="${TRIAL}?ref=saas-index">AI導入お試し実験を見る</a> <a class="btn" href="${SITE}/ai-system/?ref=saas-index">やりたいことから探す</a></p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / SaaSとOSSの対応表</nav>
<section><div class="panel">
<h2>この対応表とは？</h2>
<p>この対応表とは、いま使っている（あるいは検討している）クラウドサービスの名前から、同じ業務に使えるオープンソースを引けるようにしたものです。サービス名をクリックすると、費用の仕組みの違い、置き換えの候補、向き不向きが読めます。</p>
<p>当社は置き換えを勧めることが目的ではありません。人数が少なく標準機能で足りるなら、そのまま使うほうが安く済みます。判断材料として並べています。</p>
</div></section>
<section><div class="panel">
<h2>サービス名から探す</h2>
<div class="table-wrap"><table><thead><tr><th>サービス</th><th>提供元</th><th>置き換えの候補</th></tr></thead><tbody>
${rows.map(({ s, oss }) => `<tr><th><a href="${BASE}/${attr(s.slug)}.html">${h(s.name)}</a></th><td>${h(s.vendor)}</td><td>${oss.slice(0, 3).map((p) => h(p.name)).join('、')}${oss.length > 3 ? ` ほか${oss.length - 3}件` : ''}</td></tr>`).join('')}
</tbody></table></div>
</div></section>
<section><div class="panel">
<h2>なぜ今なのですか？</h2>
<p>理由は、オープンソースを自社業務に合わせて直す費用が下がったことです。以前はその作業に人手と期間がかかり、月額を払い続けるほうが安く見えていました。AIエージェントと対話しながら実装するバイブコーディングで、その前提が変わりました。固定費が消え、業務に合わせられ、ソースコードとノウハウが自社に残ります。</p>
</div></section>
<section><div class="panel">
<p class="note">記載のサービス名・製品名は各社の商標または登録商標です。本ページは当社が独自にまとめた比較情報であり、各提供元が監修するものではありません。料金や機能は変更される場合があるため、最新の情報は各公式サイトをご確認ください。</p>
</div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'ItemList', name: 'SaaSとオープンソースの対応表', numberOfItems: rows.length,
      itemListElement: rows.map(({ s }, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/${s.slug}.html`, name: s.name })) },
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: `${BASE}/`, description: desc,
      inLanguage: 'ja', dateModified: TODAY,
      isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'SaaSとOSSの対応表', item: `${BASE}/` }] },
  ]
  return shell(title, desc, `${BASE}/`, body, ld)
}

const withOss = saasList.map((s) => {
  const r = ossFor(s)
  return { s, oss: r.list, named: r.named }
})
const thin = withOss.filter((x) => x.named < 2)

await fs.rm(distRoot, { recursive: true, force: true })
await fs.mkdir(distRoot, { recursive: true })
await fs.writeFile(path.join(distRoot, 'index.html'), indexPage(withOss))
for (const { s, oss, named } of withOss) {
  const others = saasList.filter((o) => o.slug !== s.slug && o.category === s.category).slice(0, 6)
  await fs.writeFile(path.join(distRoot, `${s.slug}.html`), detailPage(s, oss, others, named))
}

const urls = [`${BASE}/`, ...saasList.map((s) => `${BASE}/${s.slug}.html`)]
await fs.writeFile(path.join(distRoot, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${h(u)}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>${u.endsWith('/saas/') ? '0.9' : '0.8'}</priority></url>`).join('\n') +
  `\n</urlset>\n`)

payload.logger.info(`saas: ${saasList.length}ページ + index/sitemap`)
if (thin.length) {
  payload.logger.warn(`推薦できるOSSが2件未満: ${thin.map((x) => x.s.slug).join(', ')}`)
}

process.exit(0)
