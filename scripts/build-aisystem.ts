/**
 * exbridge.jp/ai-system/ を生成する。
 *
 * kurage の /oss/<slug>/ は「そのOSSは何か」を主題にしている（供給側の語）。
 * こちらは「その業務をAIでどうやるか」を主題にする（需要側の語）。
 * 同じOSSについて2ページ作るので、H1・見出し・本文構成・誘導先を全部変える。
 * 重複扱いを避けるのと、検索意図が違うのが理由。
 *
 * 出力:
 *   dist/ai-system/index.html                トップ
 *   dist/ai-system/c/<capability>/index.html できること別の一覧
 *   dist/ai-system/<slug>/index.html         OSS 1件ごと（できること＋OSS名が主題）
 *
 * 使い方: npx tsx scripts/build-aisystem.ts
 */
import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import { CAPABILITIES, GROUPS, OTHER, MIN_MEMBERS, classify, matches, type Capability } from './capability'
import { displayName } from './display-names'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'ai-system')

// SaaS代替ページ(/saas/)との相互リンク用。分類ページから「いま使っているサービス名」で引ける入口へ渡す。
type SaasRow = { slug: string; name: string; category: string; ossCats: string[]; volume: number }
const SAAS_LIST = JSON.parse(await fs.readFile(path.join(root, 'data', 'saas-list.json'), 'utf8')) as SaasRow[]
// saas-list.json の ossCats はカタログ側の分類名。できること(capability)の key と名前が違うものをここで橋渡しする。
const SAAS_CAT_OF_CAP: Record<string, string[]> = {
  bi: ['analytics'], task: ['project'], helpdesk: ['support'], wiki: ['knowledge'], manual: ['knowledge'],
  attendance: ['hr'], payroll: ['hr'], mailmarketing: ['marketing'], ec: ['commerce'], pos: ['commerce'],
  paperless: ['dms'], invoice: ['accounting'], team: ['groupware'], calendar: ['groupware'],
  shortdrama: ['media'], aivideo: ['media'], translate: ['knowledge'],
}
function saasFor(cap: Capability): SaasRow[] {
  const cats = new Set([cap.key, cap.group, ...(SAAS_CAT_OF_CAP[cap.key] || [])])
  return SAAS_LIST.filter((s) => s.ossCats.some((c) => cats.has(c)) || cats.has(s.category))
    .sort((a, b) => b.volume - a.volume).slice(0, 6)
}
const BASE = `${SITE}/ai-system`


import { SITE, KURAGE, TRIAL, GA } from './site'
import { DEMOS, PROTO, demoPanel, demoUrl } from './demos'
import { kappKitPanel, kappKitCards, kappKitNames } from './kapp-kits'
import { ORG, orgLd, TODAY, TODAY_JA, h, attr, json, items, jaVerdict, styles,
         relatedNews, shell as baseShell, visibleLength, fitLength, type Project } from './page-shell'

/** このサイトのフッターと計測用ref。枠は page-shell.ts と共通。 */
const SHELL = {
  refPrefix: 'exbridge-ai-system',
  base: `${SITE}/ai-system`,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${SITE}/contact.php">お問い合わせ</a>　<a href="${SITE}/ai-development.html">AI開発・活用支援</a>　<a href="${SITE}/ai-system/">AIでできること一覧</a>　<a href="${SITE}/solution/">業種別ソリューション</a>　<a href="${KURAGE}/oss/?ref=exbridge-ai-system">業務OSSカタログ</a>　<a href="${PROTO}/?ref=exbridge-ai-system">触れるデモ一覧</a>　<a href="https://kappstore.exbridge.jp/?ref=exbridge-ai-system">買い切りの業務システム（Kurage App Store）</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[]) => baseShell(t, d, u, b, l, SHELL)

function ctaBlock(cap: Capability, name: string, subject?: string): string {
  const s = subject || cap.label
  return `<div class="cta">
<h2>${h(s)}を、まず15時間で試す</h2>
<p>名古屋市内なら、1日3時間×5日間の計15時間・税別15万円で試せます。<strong>初日3時間のヒアリングと提案は無料</strong>です。御社のPCと御社名義のAIエージェントで目の前で開発するので、作り方ごと社内に残ります。成果物とソースコードはお客様のものです。</p>
<a class="btn btn-main" href="${TRIAL}?ref=ai-system-${attr(subject ? 'index' : cap.key)}">AI導入お試し実験を見る</a>
<a class="btn" href="${KURAGE}/vibe-prototype.html?ref=exbridge-ai-system">動くデモを先に見る（110,000円〜）</a>
<a class="btn" href="${SITE}/contact.php?subject=${encodeURIComponent(s + 'の相談')}">${h(name)}について相談する</a>
</div>`
}

/** GitHubの日付を「2026年8月」の形にする。取れなければ null */
function ymOf(s?: string | null): string | null {
  const t = Date.parse(String(s || ''))
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function detailPage(p: Project, cap: Capability, siblings: Project[]): string {
  const url = `${BASE}/${p.slug}/`
  const uses = items(p.useCases)
  const since = ymOf(p.githubCreatedAt)
  const lastPush = ymOf(p.githubPushedAt)
  // このページにしか無い実測値。定型文だけのページにしないための材料。
  const facts = [
    since ? `GitHubでの公開は${since}` : '',
    p.language ? `主な開発言語は${p.language}` : '',
    typeof p.stars === 'number' && p.stars > 0 ? `GitHubスターは${p.stars.toLocaleString('en-US')}` : '',
    lastPush ? `最終更新は${lastPush}` : '',
  ].filter(Boolean)
  // 詳細ページに来る検索はほぼ指名検索（codealmanac / decap cms / vikunja タスク管理…）。
  // 製品名を先頭に出す。従来は「顧客管理（CRM）をTwentyで実現する」で製品名が中ほどにあり、
  // 「twenty crm」(月170・競合低)では90日間1回も表示されなかった。
  const title = fitLength(32,
    `${p.name}とは｜${cap.label}に使える無料のオープンソース`,
    `${p.name}とは｜${cap.label}のオープンソース`,
    `${p.name}｜${cap.label}のオープンソース`,
    `${p.name}｜${cap.label}`)
  const desc = fitLength(120,
    `${p.name}は、${cap.label}に使えるオープンソースです。${p.summary}ライセンスと日本語対応を実測して掲載。名古屋のシステム開発会社が日本語化から導入まで行います。初日の相談は無料です。`,
    `${p.name}は、${cap.label}に使えるオープンソースです。${p.summary}ライセンスと日本語対応の実測つき。日本語化から導入まで対応します。`,
    `${p.name}は、${cap.label}に使えるオープンソースです。ライセンスと日本語対応の実測つき。日本語化から導入まで対応します。`,
    `${p.name}は、${cap.label}に使えるオープンソースです。日本語対応を実測して掲載しています。`)
  const body = `<section class="hero"><div class="wrap">
<p class="kicker">AIでできること / ${h(cap.label)}</p>
<h1>${h(p.name)}とは？<br>${h(cap.label)}に使えるオープンソース</h1>
<p class="lead">${h(p.name)}は、${h(cap.label)}に使えるオープンソースです。${h(cap.question)}——その課題に対して、${h(p.name)}を土台にした仕組みを作ります。<strong>ソフト自体は無料</strong>で、ゼロから作るより早く、月額のユーザー課金もありません。</p>
${DEMOS[p.slug] ? `<p><a class="btn btn-main" href="${demoUrl(p.slug, `ai-system-hero-${p.slug}`)}" target="_blank" rel="noopener">${h(p.name)}の日本語デモを触る</a></p>` : ''}
</div></section>
${relatedNews('oss', p.slug)}
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">AIでできること</a> / <a href="${BASE}/c/${attr(cap.key)}/">${h(cap.label)}</a> / ${h(p.name)}</nav>

<section><div class="panel">
<h2>${h(p.name)}とは？</h2>
<p>${h(p.name)}とは、${h(p.summary)}${h(cap.label)}の用途に使えるオープンソースで、ソースコードが公開されているため自社のサーバーに置いて動かせます。<strong>ソフト自体の費用はかかりません</strong>。</p>
${facts.length ? `<p>${h(facts.join('、'))}です（当社がGitHubの公開情報から確認した値、${TODAY_JA}時点）。</p>` : ''}
<p>${h(jaVerdict(p))}${DEMOS[p.slug] ? `当社が日本語化したものを、ログイン情報つきで公開しています。` : ''}</p>
</div></section>

<section><div class="panel">
<h2>${h(cap.label)}とは？</h2>
<p>${h(cap.label)}とは、${h(cap.question)}という状態を、仕組みで解消することです。${h(p.name)}は、この用途に使えるオープンソースのひとつです。</p>
<ul class="checks">${uses.slice(0, 5).map((u) => `<li>${h(u)}</li>`).join('')}</ul>
</div></section>

<section><div class="panel">
<h2>${h(p.name)}を使うと何が変わるのか</h2>
<p>${h(p.description)}</p>
<p>すでに世界で使われている完成品を土台にするので、同じものをゼロから作るより短い期間で済みます。当社は、この土台に対して日本語化、画面や項目の変更、権限、帳票、既存システムとの連携を加えて、御社の業務に合う状態にします。</p>
</div></section>

<section><div class="panel">
<h2>${h(p.name)}の日本語対応（実測）</h2>
<p>${h(jaVerdict(p))}</p>
<div class="table-wrap"><table><tbody>
<tr><th>ライセンス</th><td>${h(p.license)}</td></tr>${p.licenseNote ? `<tr><th>利用条件</th><td>${h(p.licenseNote)}</td></tr>` : ''}
${p.language ? `<tr><th>主な言語</th><td>${h(p.language)}</td></tr>` : ''}
${typeof p.stars === 'number' ? `<tr><th>GitHubスター</th><td>${p.stars.toLocaleString('en-US')}</td></tr>` : ''}
<tr><th>日本語ロケール</th><td>${h(p.japaneseStatus)}${typeof p.jaFileCount === 'number' ? `（${p.jaFileCount}ファイル）` : ''}</td></tr>
${since ? `<tr><th>公開開始</th><td>${h(since)}</td></tr>` : ''}
${lastPush ? `<tr><th>最終更新</th><td>${h(lastPush)}</td></tr>` : ''}
</tbody></table></div>
<p class="note">GitHubの公開ファイル一覧から日本語ロケールの実ファイルを数えた結果です。配布用のビルド成果物は除いています。技術的な詳細は<a href="${KURAGE}/oss/${attr(p.slug)}/?ref=exbridge-ai-system">${h(p.name)}のOSS情報</a>にまとめています。</p>
</div></section>

${demoPanel(p.slug, p.name, `ai-system-${p.slug}`)}

${((kit) => (kit ? `<section><div class="panel kit">${kit}</div></section>` : ''))(kappKitPanel(p.slug, `ai-system-${attr(p.slug)}`, h(p.name)))}

<section><div class="panel">
<h2>進め方は？</h2>
<p>進め方とは、現場を見て対象を決め、動くものを見ていただきながら作り、御社の環境へ導入するまでの流れのことです。書類で仕様を固めてから作る進め方はしません。</p>
<div class="grid">
<div class="card"><h3>1日目（無料）</h3><p>現場に伺い、いまのやり方を見せていただきます。${h(cap.label)}のどこから手を付けるかを決めます。</p></div>
<div class="card"><h3>2〜4日目</h3><p>${h(p.name)}を土台に、御社のPCで目の前で開発します。動くものを見ながらその場で直します。</p></div>
<div class="card"><h3>5日目</h3><p>御社の環境へ導入し、ソースコードと開発ノウハウをお渡しします。以後は自社で改造できます。</p></div>
<div class="card"><h3>その後</h3><p>追加の作り込みが必要なら、範囲を決めてあらためてお見積もりします。延長を前提にした進め方はしません。</p></div>
</div>
</div></section>

<section><div class="panel">
<h2>この方法が向かないのは？</h2>
<p>向かないのは、基幹システムの全面刷新や、複数部門にまたがる大規模な仕組みのことです。15時間という枠では作り切れません。また、決まった手順を正確に繰り返すだけの処理は、AIを使わないほうが速く確実です。当社ではその部分は普通のプログラムとして作ります。</p>
</div></section>

${ctaBlock(cap, p.name)}

${siblings.length ? `<section><div class="panel">
<h2>${h(cap.label)}に使える他のオープンソース</h2>
<p>同じ用途に使える土台は他にもあります。ライセンス、日本語対応、規模を比べて選べます。</p>
<div class="table-wrap"><table><thead><tr><th>名前</th><th>できること</th><th>日本語</th><th>デモ</th></tr></thead><tbody>
${siblings.map((s) => `<tr><th><a href="${BASE}/${attr(s.slug)}/">${h(s.name)}</a></th><td>${h(s.summary)}</td><td>${h(s.japaneseStatus)}</td><td>${DEMOS[s.slug] ? `<a href="${demoUrl(s.slug, `ai-system-sib-${s.slug}`)}" target="_blank" rel="noopener">触れる</a>` : '—'}</td></tr>`).join('')}
</tbody></table></div>
<p class="note"><a href="${BASE}/c/${attr(cap.key)}/">${h(cap.label)}に使えるOSSの一覧を見る</a></p>
</div></section>` : ''}
</main>`

  const faqs = [
    { q: `${p.name}は無料で使えますか？`, a: `ソフト自体は無料です。${p.name}はライセンス${p.license}のオープンソースとして公開されていて、条件を守れば費用をかけずに自社のサーバーに置いて使えます。${p.licenseNote ? p.licenseNote : ''}かかるのはサーバー代と、日本語化や自社向けの変更にかかる費用です。ユーザー数に応じた月額課金はありません。` },
    { q: `${p.name}は日本語で使えますか？`, a: `${jaVerdict(p)}判定は、GitHubの公開ファイル一覧から日本語ロケールの実ファイルを数えた結果です（配布用のビルド成果物は除外）。日本語化が必要な場合は、当社がその作業を含めて導入します。` },
    { q: `${cap.label}は${p.name}で本当にできますか？`, a: `${p.summary} この用途に使えるオープンソースとして公開されており、当社ではこれを土台に日本語化と自社向けの変更を行って導入します。` },
    { q: '費用はどのくらいかかりますか？', a: '名古屋市内であれば、1日3時間×5日間の計15時間・税別15万円のお試し導入があります。初日3時間のヒアリングと提案は無料で、進めるとお決めいただいた場合のみ費用が発生します。' },
    { q: '作ったものは自社のものになりますか？', a: 'なります。ソースコード一式をお渡しします。以後は自社で改造しても、他社に依頼しても構いません。当社に縛られる契約にはしません。' },
    { q: '社内にIT担当者がいなくても導入できますか？', a: 'できます。いまの紙やExcelのやり方をそのまま見せていただければ、こちらで形にします。専門用語で話を進めることはしません。' },
  ]
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Service', name: `${cap.label}の構築（${p.name}を利用）`, description: desc, url,
      serviceType: `${cap.label}、AI活用支援、業務システム開発`, areaServed: { '@type': 'City', name: '名古屋市' },
      provider: { '@type': 'Organization', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      offers: { '@type': 'Offer', priceCurrency: 'JPY', price: '150000', url: TRIAL,
        description: '初日3時間のヒアリングと提案は無料。計15時間・税別150,000円。名古屋市内限定。' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'ja',
      dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'AIでできること', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: cap.label, item: `${BASE}/c/${cap.key}/` },
      { '@type': 'ListItem', position: 4, name: p.name, item: url }] },
  ]
  const faqHtml = `<main class="wrap"><section><div class="panel"><h2>よくあるご質問</h2>
${faqs.map((f) => `<div class="card" style="margin:0 0 10px"><h3>${h(f.q)}</h3><p>${h(f.a)}</p></div>`).join('')}
</div></section></main>`
  return shell(title, desc, url, body + faqHtml, ld)
}

/**
 * 経営者が言葉にする課題と、対応する「できること」ページの対応表。
 *
 * なぜ手書きか: 分類は業務名（社内Wiki、在庫管理…）で並んでいるが、
 * 経営者は「人手が足りない」「属人化している」という言い方で検索・相談する。
 * 入口の言葉と中身の言葉が違うので、ここで橋をかける。
 * caps に含まれない key は表示時に落とす（リンク切れを作らない）。
 */
const ISSUES: Array<{ issue: string; effect: string; keys: string[] }> = [
  { issue: '人手が足りない。募集しても採用できない',
    effect: 'いま人がやっている入力・転記・問い合わせ対応をAIに寄せると、同じ人数で回る量が増えます。増えた余力は、採用しないと着手できなかった仕事に回せます。',
    keys: ['ocr', 'chatbot', 'automation', 'helpdesk'] },
  { issue: '特定の人しかできない仕事があり、その人が休むと止まる',
    effect: '手順と判断の根拠を文書にして検索できる状態にすると、担当が代われる仕事が増えます。退職時に知識ごと失われる状態を止められます。',
    keys: ['manual', 'wiki', 'knowledge', 'rag'] },
  { issue: '残業が減らない。定時で終わらない',
    effect: '毎日繰り返している定型作業を機械に移すと、人の時間は判断が要る仕事だけに残ります。作業時間を記録して、どこに時間が消えているかを先に測ります。',
    keys: ['automation', 'timetrack', 'workflow', 'report'] },
  { issue: '紙とハンコで承認が止まる。書類が溜まる',
    effect: '申請と承認を画面で回すと、誰の手元で止まっているかが見えます。紙の書類は読み取って検索できる形にすれば、探す時間そのものが消えます。',
    keys: ['workflow', 'ocr', 'dms', 'esign'] },
  { issue: '経営の数字が月末にならないと分からない',
    effect: '売上・原価・在庫を同じ場所に集めて自動で集計すると、判断が月末待ちでなくなります。手集計のExcelを廃止できます。',
    keys: ['bi', 'report', 'visualize', 'spreadsheet'] },
  { issue: '同じ問い合わせに何度も答えている',
    effect: '過去の回答をAIに答えさせると、一次対応が人の手を離れます。人は例外だけを見ればよくなり、対応の質も揃います。',
    keys: ['chatbot', 'faq', 'helpdesk', 'rag'] },
  { issue: '社内の資料が探せない。前に作ったものが見つからない',
    effect: '言葉が違っても意味で探せる検索にすると、作り直しが減ります。「探す時間」は業務時間の中で最も気づかれにくい損失です。',
    keys: ['knowledge', 'search', 'vectordb', 'dms'] },
  { issue: '見積・請求・経費の処理に人手がかかる',
    effect: '発行と突合を自動化すると、月末の集中がなくなります。入力ミスによる回収漏れも減ります。',
    keys: ['invoice', 'quote', 'expense', 'accounting'] },
  { issue: '在庫と発注をExcelで管理していて、欠品と過剰が起きる',
    effect: '在庫と受発注を同じ台帳に載せると、欠品も抱えすぎも数字で見えます。運転資金の使い方が変わります。',
    keys: ['inventory', 'order', 'purchase', 'warehouse'] },
  { issue: '勤怠・シフト・給与の管理が紙とExcelのまま',
    effect: '打刻と集計をつなぐと、締めの作業が短くなります。労務のリスク（残業時間の把握漏れ）も見えるようになります。',
    keys: ['attendance', 'shift', 'payroll', 'hr'] },
  { issue: '営業の状況が個人の頭の中にあり、引き継げない',
    effect: '顧客と商談を記録に残すと、担当が代わっても続けられます。誰に何を提案したかが会社の資産になります。',
    keys: ['crm', 'sfa', 'mailmarketing', 'contact'] },
  { issue: '欲しい画面を作るたびに外注していて、費用も時間もかかる',
    effect: '自社で直せる形にすると、小さな改善が止まりません。作り方ごと社内に残すことを、当社は導入の前提にしています。',
    keys: ['lowcode', 'form', 'database', 'api'] },
]

function capabilityPage(cap: Capability, all: Project[], related: Capability[], counts: Map<string, number>): string {
  const url = `${BASE}/c/${cap.key}/`
  const groupLabel = GROUPS.find((g) => g.key === cap.group)?.label || ''
  const total = all.length
  const shown = all.slice(0, MAX_LIST)
  const cut = total > shown.length
  // 検索結果で末尾が切れると、いちばん効く語（無料・比較）が読者に届かない。
  // 全角32以内に収まる形を長いほうから選ぶ。社名はGoogleが自動で付けるので入れない。
  // 検索語は「勤怠管理システム オープンソース」「タスク管理 OSS」の形（GSC実測）。
  // 分類名(label)ではなく検索で使われる一般名(noun)を主語にし、「オープンソース」と「OSS」の両方を入れる。
  const noun = cap.noun || cap.label
  const terms = cap.terms || []
  const title = fitLength(32,
    `${noun}のオープンソース（OSS）${total}件｜無料で使える製品を比較`,
    `${noun}のオープンソース（OSS）${total}件を比較`,
    `${noun}のオープンソース${total}件｜無料で使えるもの`,
    `${noun}のオープンソース${total}件を比較`,
    `${noun}のオープンソース${total}件`)
  const desc = fitLength(120,
    `${noun}をオープンソース（OSS）で。${cap.question}という課題に使える無料のオープンソースを${total}件掲載。ライセンス・日本語対応・更新状況の実測つきで比較。名古屋のシステム開発会社が導入まで行います。`,
    `${cap.question}という課題に使える無料のオープンソースを${total}件掲載。有料クラウドとの違い、日本語対応の実測、選び方まで。名古屋のシステム開発会社が導入まで行います。`,
    `${cap.question}という課題に使える無料のオープンソースを${total}件掲載。有料クラウドとの違いと選び方、日本語対応の実測つき。`)

  // 実測の内訳。数字は当社が数えたもので、出所を本文に書く。
  const noJa = all.filter((p) => p.japaneseStatus === '日本語ファイルなし').length
  const hasJa = all.filter((p) => p.japaneseStatus && p.japaneseStatus !== '日本語ファイルなし' && p.japaneseStatus !== '未調査').length
  const licenses = new Map<string, number>()
  for (const p of all) licenses.set(p.license || '不明', (licenses.get(p.license || '不明') || 0) + 1)
  const topLicense = [...licenses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const starsSorted = all.map((p) => Number(p.stars || 0)).sort((a, b) => a - b)
  const median = starsSorted.length ? starsSorted[Math.floor(starsSorted.length / 2)] : 0
  const jaPct = total ? Math.round((noJa / total) * 100) : 0

  // 検索して来る人が最初に知りたいのは「136件の一覧」ではなく「どれを見ればいいか」。
  // 1ページ目の競合はどこも『おすすめN選』の形をしている。ただし作文はしない。
  // 当てはまりの強い30件から、当社の実測値だけで機械的に上位5件を出す。
  const hasJaFile = (p: Project) =>
    !!p.japaneseStatus && p.japaneseStatus !== '日本語ファイルなし' && p.japaneseStatus !== '未調査'

  // 更新が止まっているものは候補にしない。本文の注意点で「止まっている製品は土台に
  // 選ばない」と書いているので、実装でもそのとおりにする。
  // 取得できていない場合は null。手作り掲載（featured）は収集対象外で日付が無いため、
  // 「不明」を「古い」と同じ扱いにすると当社が日本語化した本命が全部消える。
  const monthsSincePush = (p: Project): number | null => {
    const t = Date.parse(String(p.githubPushedAt || ''))
    return Number.isNaN(t) ? null : (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.4)
  }

  // 名前がその分類の一般名詞のままのもの（例: 顧客管理の "crm"）は候補から外す。
  // 比較表に「crm」という行が出ると、何のことか読者に伝わらない。
  const genericName = (p: Project) => {
    const n = p.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    return n === cap.key || n === cap.key + 'app' || n === cap.key + 'system' || n.length <= 2
  }

  // 規模を主、日本語とデモを従にする。日本語の有無を主にすると、
  // スター5万件の本命が、スター200件の小さな実装に負けて表から消える。
  // スター未取得(null)を0点にするのも誤り。手作り掲載は収集していないだけで、
  // 実際は EspoCRM や Krayin CRM のような本命が入っている。中庸の点を置く。
  const pickScore = (p: Project) => {
    const m = monthsSincePush(p)
    return (p.stars == null ? 2.5 : Math.log10(p.stars + 1)) +
      (p.featured ? 2.0 : 0) +
      (hasJaFile(p) ? 0.6 : 0) +
      (DEMOS[p.slug] ? 1.5 : 0) -
      (m !== null && m > 12 ? 1.5 : 0)
  }
  // 候補プールは「当てはまりの強い40件」＋「手作り掲載の全件」。
  // 手作り分は要約が短く当てはまり点が伸びないので、40件で切ると
  // 当社が日本語化して触れるデモまで出している本命（EspoCRM / Krayin CRM）が落ちる。
  const pool = [...new Map([...all.slice(0, 40), ...all.filter((p) => p.featured)]
    .map((p) => [p.slug, p])).values()]
  const seenName = new Set<string>()
  const picks = pool
    .filter((p) => {
      const m = monthsSincePush(p)
      return !genericName(p) && !(m !== null && m > 24)
    })
    .sort((a, b) => pickScore(b) - pickScore(a))
    // 同じ表示名が2行並ぶと表の信用が落ちる（勤怠で Frappe HR が2回出ていた）
    .filter((p) => !seenName.has(p.name) && seenName.add(p.name))
    .slice(0, 6)
  const reasonOf = (p: Project) => {
    const r: string[] = []
    if (Number(p.stars || 0) > 0) r.push(`GitHubスター${Number(p.stars).toLocaleString('en-US')}`)
    // 「未調査」を「なし」と書くと事実誤認になる（Twentyは実際には全訳済みだった）
    const s = p.japaneseStatus || ''
    const n = typeof p.jaFileCount === 'number' ? `${p.jaFileCount}ファイル` : ''
    r.push(
      s === '日本語ファイルなし' ? '日本語ロケールなし＝日本語化から着手'
      : s === '日本語ファイルあり' ? `日本語ロケールあり${n ? `（${n}）` : ''}`
      : s === '日本語ファイルが一部のみ' ? `日本語ロケールは一部のみ${n ? `（${n}）` : ''}`
      : s === '未調査' || !s ? '日本語ロケールは未調査'
      : s)
    if (p.license) r.push(`ライセンス${p.license}`)
    const m = monthsSincePush(p)
    if (m !== null) r.push(m < 3 ? '開発は現在も活発' : m < 12 ? `最終更新は約${Math.round(m)}か月前` : '更新はやや停滞')
    if (DEMOS[p.slug]) r.push('当社が日本語化したデモを公開中')
    return r.join('／')
  }

  const faqs = [
    { q: `${cap.label}のオープンソースは、無料で使えますか？`, a: `ソフト自体は無料です。掲載している${total}件はいずれもソースコードが公開されていて、ライセンスの条件を守れば費用をかけずに自社サーバーに置いて使えます。ユーザー数に応じた月額課金もありません。無料にならないのはサーバー代と、日本語化や自社向けの変更にかかる費用です。この2つを含めても、有料のクラウドサービスを人数分契約し続けるより安くなる場合があります。` },
    { q: `有料のクラウドサービスと、どちらを選ぶべきですか？`, a: `人数が少なく、標準の機能でそのまま足りるなら有料のクラウドサービスのほうが手間がかかりません。オープンソースが向くのは、利用人数が多くて月額が積み上がる場合、自社の業務に合わせて画面や項目を変えたい場合、データを自社のサーバーに置きたい場合です。当社は初日3時間の無料ヒアリングで現場を見たうえで、クラウドのほうが向いていればその旨をお伝えします。` },
    { q: `社内に技術者がいなくても導入できますか？`, a: `できます。オープンソースは置いただけでは使えず、サーバーの用意、日本語化、項目の設計、既存データの移行が必要です。その部分を当社が行います。導入後は自社で直せるように、ソースコードと手順をお渡しします。` },
    { q: `${cap.label}にオープンソースを使うと、何が違うのですか？`, a: `ゼロから作る場合と比べて、出来上がっている土台をそのまま使える分だけ短い期間で導入できます。ユーザー数に応じた月額課金も発生しません。当社が掲載している${total}件は、いずれも公開されているソースコードを自社サーバーに置いて動かせるものです。` },
    { q: '日本語で使えますか？', a: `掲載${total}件のうち${noJa}件（${jaPct}%）は、GitHubの公開ファイルを数えた時点で日本語のロケールファイルがありませんでした。日本語で使う場合は日本語化から着手します。当社はこの作業を含めて導入します。` },
    { q: '費用はどのくらいかかりますか？', a: '名古屋市内であれば、1日3時間×5日間の計15時間・税別15万円のお試し導入があります。初日3時間のヒアリングと提案は無料で、進めるとお決めいただいた場合のみ費用が発生します。作るものが決まっている場合は税込110,000円からのプロトタイプ制作もあります。' },
    { q: 'どれを選べばよいかわからないのですが、相談だけでもよいですか？', a: '構いません。初日3時間のヒアリングは無料です。現場のやり方を見せていただいたうえで、どれを土台にするか、そもそもオープンソースを使わないほうがよいかを含めて提案します。' },
  ]
  // 検索で実際に使われている言い回し（cap.terms）に、実測値で答える問いを先頭に足す。
  const kitList = all.map((p) => ({ slug: p.slug, name: h(p.name) }))
  const kitCards = kappKitCards(kitList, `ai-system-c-${cap.key}`)
  const kitNames = kappKitNames(kitList)
  if (terms.length) {
    faqs.unshift(
      { q: `${noun}のオープンソース（OSS）で、日本語で使えるものはありますか？`,
        a: `あります。掲載${total}件のうち${hasJa}件は、GitHubの公開ファイルに日本語ロケールが実在しました（${TODAY_JA}時点）。当社の実測で上位に挙げたのは${picks.slice(0, 3).map((p) => p.name).join('・')}です。日本語ロケールが無いものでも、当社が日本語化して導入できます。` },
      { q: `${noun}のOSSを自社サーバーで動かすには、何が必要ですか？`,
        a: `Linuxのサーバー1台（VPSで可）、docker、HTTPS用のリバースプロキシ、日次バックアップの4点です。多くの製品はデータベースを別コンテナで持つため、月数百円の共有レンタルサーバーでは動きません。${kitNames ? `${kitNames}については、当社が実際に立てた手順書とテンプレートを日本語導入・運用キットとして販売しています。` : '手順は各製品の公式ドキュメントに沿って進めます。'}` },
    )
  }
  const saasHits = saasFor(cap)

  // この分類が経営課題のどれに効くかは ISSUES にある分だけ出す。
  // 96枚に同じ一般論を貼ると、ページの見分けがつかなくなるので作文しない。
  const issueBlock = ISSUES.filter((it) => it.keys.includes(cap.key))
    .map((it) => `<div class="card"><h3>${h(it.issue)}</h3><p>${h(it.effect)}</p></div>`).join('')

  const body = `<section class="hero"><div class="wrap">
<p class="kicker">AIでできること / ${h(groupLabel)}</p>
<h1>${h(noun)}に使える<br>オープンソース（OSS）${total}件</h1>
<p class="lead">${terms.length ? `${h(noun)}をオープンソース（OSS）で用意したい方向けの一覧です。` : ''}${h(cap.question)}——その課題に使えるオープンソースを${total}件、ライセンス・日本語対応・更新状況を実測して並べました。<strong>ソフト自体はどれも無料</strong>で、自社サーバーに置いて使えます。ユーザー数に応じた月額課金はありません。名古屋市内なら、計15時間・税別15万円で導入まで試せます。</p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">AIでできること</a> / ${h(cap.label)}</nav>
<section><div class="panel">
<h2>${h(cap.label)}とは？</h2>
<p>${h(cap.label)}とは、${h(cap.question)}という状態を仕組みで解消することです。ゼロから作らなくても、同じ用途で世界中に使われているオープンソースがあります。当社はそれを土台に、日本語化と自社向けの変更を加えて導入します。月額のユーザー課金は発生しません。</p>
</div></section>
<section><div class="panel">
<h2>${h(cap.label)}のオープンソース、まずどれを見ればよいですか？</h2>
<p>${total}件すべてを比べる必要はありません。当社が実測した<strong>規模（GitHubスター）・日本語ロケールの有無・そのまま触れるデモがあるか</strong>の3点で、当てはまりの強い上位から${picks.length}件を挙げます。名前がその分類の一般名詞のままのものと、1年以上更新が止まっているものは外しています。どれもソフト自体は無料なので、気になったものは自社サーバーに置いて試せます。</p>
<div class="table-wrap"><table class="stack-table"><thead><tr><th>名前</th><th>どんなものか</th><th>選ぶ根拠（当社の実測）</th></tr></thead><tbody>
${picks.map((p) => `<tr><th><a href="${BASE}/${attr(p.slug)}/">${h(p.name)}</a>${DEMOS[p.slug] ? ` <a class="demo-tag" href="${demoUrl(p.slug, `ai-system-pick-${cap.key}`)}" target="_blank" rel="noopener">デモを触る</a>` : ''}</th><td data-label="どんなものか">${h(p.summary)}</td><td data-label="選ぶ根拠（当社の実測）">${h(reasonOf(p))}</td></tr>`).join('')}
</tbody></table></div>
<p class="note">この並びは実測値による機械的な順位で、広告や紹介料による順位付けはしていません（${TODAY_JA}時点）。${total}件すべての一覧は<a href="#list">このページの下</a>にあります。</p>
</div></section>
${kitCards ? `<section><div class="panel">
<h2>${h(noun)}を自分で入れるなら（導入キット・買い切り製品）</h2>
<p>この分類のうち、当社が実際に立てて手順書・設計テンプレート・docker構成・バックアップまでまとめた導入キットと、同じ用途で当社が作った設置手順つきの買い切り製品です。開発を依頼せず自社で立てたい場合の早道です。</p>
${kitCards}
</div></section>` : ''}
${saasHits.length ? `<section><div class="panel">
<h2>いま使っている有料サービスの代わりを探しているなら</h2>
<p>サービス名から、同じ業務に使えるオープンソースを引けるページもあります。費用の仕組みの違いと、置き換えの候補、使い続けたほうがよい場合まで書いています。</p>
<p class="note">${saasHits.map((s) => `<a href="${SITE}/saas/${attr(s.slug)}.html?ref=ai-system-c-${attr(cap.key)}">${h(s.name)}の代わりになるオープンソース</a>`).join('　')}</p>
</div></section>` : ''}
<section><div class="panel">
<h2>有料のクラウドサービスと、オープンソースは何が違いますか？</h2>
<p>違いは主に、<strong>費用のかかり方・データの置き場所・変更できる範囲</strong>の3つです。${h(cap.label)}を無料で始めたい場合、この表のどちらが自社に合うかを先に決めると迷わなくなります。</p>
<div class="table-wrap"><table class="stack-table"><thead><tr><th>比べる点</th><th>オープンソース（自社サーバー）</th><th>有料のクラウドサービス</th></tr></thead><tbody>
<tr><th>ソフトの費用</th><td data-label="オープンソース（自社サーバー）"><strong>無料</strong>。ソースコードが公開されている</td><td data-label="有料のクラウドサービス">ユーザー数×月額。人が増えると増える</td></tr>
<tr><th>実際にかかる費用</th><td data-label="オープンソース（自社サーバー）">サーバー代と、導入・日本語化・改造の費用</td><td data-label="有料のクラウドサービス">月額利用料（＋初期費用）</td></tr>
<tr><th>データの置き場所</th><td data-label="オープンソース（自社サーバー）">自社が決めたサーバー</td><td data-label="有料のクラウドサービス">提供会社のサーバー</td></tr>
<tr><th>画面・項目の変更</th><td data-label="オープンソース（自社サーバー）">ソースを直せる範囲すべて</td><td data-label="有料のクラウドサービス">提供会社が用意した設定の範囲まで</td></tr>
<tr><th>日本語</th><td data-label="オープンソース（自社サーバー）">掲載${total}件のうち${noJa}件（${jaPct}%）は日本語ロケールなし。日本語化が要る</td><td data-label="有料のクラウドサービス">国内サービスなら最初から日本語</td></tr>
<tr><th>サポート</th><td data-label="オープンソース（自社サーバー）">自社、または委託先が見る</td><td data-label="有料のクラウドサービス">提供会社のサポート窓口</td></tr>
<tr><th>やめるとき</th><td data-label="オープンソース（自社サーバー）">データもソフトも手元に残る</td><td data-label="有料のクラウドサービス">解約前にデータの持ち出しが要る</td></tr>
</tbody></table></div>
<p>当社は、この表の左側（オープンソースを自社サーバーに置く形）を選んだ会社に対して、日本語化・画面の変更・既存システムとの連携を行っています。右側のほうが向いていると判断した場合は、その旨をお伝えします。</p>
</div></section>
<section><div class="panel">
<h2>この分類の実測データ</h2>
<p>実測データとは、掲載している${total}件について当社がGitHubの公開情報から数えた内訳のことです。日本語対応は、配布用のビルド成果物を除いた日本語ロケールの実ファイル数で判定しています。</p>
<div class="table-wrap"><table><tbody>
<tr><th>掲載件数</th><td>${total}件</td></tr>
<tr><th>日本語ロケールなし</th><td>${noJa}件（${jaPct}%）— 日本語化から着手します</td></tr>
<tr><th>日本語ロケールあり</th><td>${hasJa}件</td></tr>
<tr><th>GitHubスター中央値</th><td>${median.toLocaleString('en-US')}</td></tr>
<tr><th>多いライセンス</th><td>${topLicense.map(([n, c]) => `${h(n)}（${c}件）`).join('、') || '不明'}</td></tr>
</tbody></table></div>
<p class="note">出所: 各リポジトリのGitHub公開情報を当社で集計（${TODAY_JA}時点）。ライセンスは導入前に必ず個別に確認します。</p>
</div></section>
<section><div class="panel">
<h2 id="list">掲載している${total}件をすべて見る</h2>
<p>この一覧とは、${h(cap.label)}という用途に当てはまるオープンソースを、当てはまりの強い順に並べたもののことです。${cut ? `全${total}件のうち上位${shown.length}件を掲載しています。` : ''}名前をクリックすると、その土台で何をどう作るかの説明に移ります。</p>
${shown.some((p) => DEMOS[p.slug]) ? `<p class="demo-line">このうち${shown.filter((p) => DEMOS[p.slug]).length}件は、当社が日本語化したものを<a href="${PROTO}/?ref=ai-system-c-${attr(cap.key)}">デモサイト</a>で公開しています。ログイン情報も出しているので、問い合わせなしでそのまま触れます。</p>` : ''}
<div class="table-wrap"><table><thead><tr><th>名前</th><th>できること</th><th>ライセンス</th><th>スター</th><th>最終更新</th><th>日本語</th><th>デモ</th></tr></thead><tbody>
${shown.map((p) => `<tr><th><a href="${BASE}/${attr(p.slug)}/">${h(p.name)}</a></th><td>${h(p.summary)}</td><td>${h(p.license || '—')}</td><td>${typeof p.stars === 'number' ? p.stars.toLocaleString('en-US') : '—'}</td><td>${h(ymOf(p.githubPushedAt) || '—')}</td><td>${h(p.japaneseStatus)}</td><td>${DEMOS[p.slug] ? `<a href="${demoUrl(p.slug, `ai-system-c-${cap.key}`)}" target="_blank" rel="noopener">触れる</a>` : '—'}</td></tr>`).join('')}
</tbody></table></div>
</div></section>
${issueBlock ? `<section><div class="panel">
<h2>${h(cap.label)}は、経営のどんな課題につながっていますか？</h2>
<div class="grid">${issueBlock}</div>
<p class="note">課題の出方は業種によって違います。<a href="${BASE}/">AI導入で解決できる経営課題の一覧</a>に、当社が名古屋の経営者から実際に相談を受ける12の言い方をまとめています。</p>
</div></section>` : ''}
<section><div class="panel">
<h2>オープンソースで${h(cap.label)}をやるときの注意点は？</h2>
<p>注意点とは、ソフトが無料であることと、導入して使い続けられることが別だという話です。当社が実際に構築して踏んだものを挙げます。</p>
<div class="grid">
<div class="card"><h3>日本語が入っていないことが多い</h3><p>掲載${total}件のうち${noJa}件（${jaPct}%）は、GitHubの公開ファイルを数えた時点で日本語ロケールがありませんでした。管理画面が英語のままだと現場が使えないので、日本語化が最初の作業になります。</p></div>
<div class="card"><h3>「実行ファイル1つ」でも周辺が要る</h3><p>データベースやキャッシュを別に用意する必要があるものが多く、月数百円の共有レンタルサーバーでは動かない場合があります。どのサーバーが要るかは導入前に実測して判断します。</p></div>
<div class="card"><h3>ライセンスは種類ごとに条件が違う</h3><p>この分類で多いのは${topLicense.map(([n, c]) => `${h(n)}（${c}件）`).join('、') || '不明'}です。自社で使う分は自由でも、外部にサービスとして提供する場合に条件が付くものがあります。導入前に個別に確認します。</p></div>
<div class="card"><h3>更新が止まっている製品がある</h3><p>公開されていても開発が続いているとは限りません。当社はスター数と更新状況を見て、止まっている製品は土台に選びません。</p></div>
</div>
</div></section>
<section><div class="panel">
<h2>どれを選べばよいですか？</h2>
<p>選び方とは、機能の多さではなく、ライセンス・日本語対応・自社の業務との距離で絞ることです。一覧の「日本語」欄が「日本語ファイルなし」であれば、日本語化から着手します。当社は初日3時間の無料ヒアリングで現場を見てから、どれを土台にするかを提案します。土台選びだけを相談していただいても構いません。</p>
</div></section>
${ctaBlock(cap, cap.label)}
${related.length ? `<section><div class="panel"><h2>${h(groupLabel)}の他のできること</h2>
<p>関連するできることとは、同じ業務領域にあり、並べて検討されることが多いテーマのことです。${h(cap.label)}と一緒に手を付けると効果が出やすい範囲でもあります。</p>
<div class="cat-grid">${related.map((c) => `<a class="cat-card" href="${BASE}/c/${attr(c.key)}/"><b>${h(c.label)}</b><span>${h(c.question)}（${counts.get(c.key) || 0}件）</span></a>`).join('')}</div>
<p class="note"><a href="${BASE}/">AIでできること一覧をすべて見る</a></p>
</div></section>` : ''}
<section><div class="panel"><h2>よくあるご質問</h2>
${faqs.map((f) => `<div class="card" style="margin:0 0 10px"><h3>${h(f.q)}</h3><p>${h(f.a)}</p></div>`).join('')}
</div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'ItemList', name: `${cap.label}に使えるオープンソース`, numberOfItems: total,
      itemListElement: shown.slice(0, 100).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/${p.slug}/`, name: p.name })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'ja',
      dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'AIでできること', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: cap.label, item: url }] },
  ]
  return shell(title, desc, url, body, ld)
}

function indexPage(caps: Capability[], counts: Map<string, number>, total: number): string {
  const title = 'AIでできること一覧｜AI導入で何ができるか、どんな経営課題が解決できるか | 株式会社エクスブリッジ'
  const desc = `AI導入で何ができるようになるのか、経営のどんな課題が解決できるのかを、${caps.length}種類の用途と${total}件のオープンソースで具体的に示します。人手不足、属人化、残業、紙の承認、月末待ちの数字。名古屋のシステム開発会社が、初日3時間無料のヒアリングから動くシステムまで作ります。`
  const has = (k: string) => caps.some((c) => c.key === k)
  const capOf = (k: string) => caps.find((c) => c.key === k)!

  const issueCards = ISSUES.map((it) => {
    const links = it.keys.filter(has)
    if (!links.length) return ''
    return `<div class="card"><h3>${h(it.issue)}</h3><p>${h(it.effect)}</p>
<p class="note">${links.map((k) => `<a href="${BASE}/c/${attr(k)}/">${h(capOf(k).label)}（${counts.get(k) || 0}件）</a>`).join('　')}</p></div>`
  }).join('')

  const sections = GROUPS.map((g) => {
    const list = caps.filter((c) => c.group === g.key)
    if (!list.length) return ''
    return `<h3>${h(g.label)}</h3>
<div class="cat-grid">${list.map((c) => `<a class="cat-card" href="${BASE}/c/${attr(c.key)}/"><b>${h(c.label)}</b><span>${h(c.question)}（${counts.get(c.key) || 0}件）</span></a>`).join('')}</div>`
  }).join('')

  const faqs = [
    { q: 'AI導入で、具体的に何ができるようになりますか？',
      a: `大きく分けて4つです。第一に、人がやっている入力・転記・集計を機械が肩代わりします。第二に、社内に散らばった資料や過去の回答から、聞けば答えが返る状態を作ります。第三に、紙とハンコで止まっていた申請・承認・記録を画面で回します。第四に、月末にならないと分からなかった売上・原価・在庫の数字が、その日のうちに見えるようになります。当社は${caps.length}種類の用途に分けて、${total}件のオープンソースを土台として掲載しています。` },
    { q: 'AIにできないことは何ですか？',
      a: '責任を伴う最終判断はできません。誰と取引するか、いくらで売るか、誰を採用するかは人が決めることです。また、決まった手順を正確に繰り返すだけの処理は、AIを使わないほうが速く確実で安価です。当社ではその部分は普通のプログラムとして作ります。AIを入れること自体は目的ではありません。' },
    { q: 'AI導入は本当に利益につながりますか？',
      a: '順番があります。まず作業時間が減り、次にその時間が別の仕事に回り、そこで初めて売上や利益が動きます。時間が減っただけでは利益は変わりません。だから当社は、削減した時間を何に使うかを最初のヒアリングで決めてから作ります。効果が出ない見込みなら、作らないほうがよいと申し上げます。' },
    { q: '中小企業でも導入できますか。社内にIT担当者がいません。',
      a: 'できます。担当者がいない会社ほど向いています。いまの紙とExcelのやり方をそのまま見せていただければ、こちらで形にします。専門用語で話を進めることはしません。名古屋市内であれば、1日3時間×5日間の計15時間・税別15万円で実際に動くシステムを1つ以上作るお試し導入があります。' },
    { q: '費用はどのくらいかかりますか？',
      a: '名古屋市内なら、計15時間・税別15万円のお試し導入があります。初日3時間のヒアリングと提案は無料で、進めるとお決めいただいた場合のみ費用が発生します。作るものが決まっている場合は税込110,000円からのプロトタイプ制作、既存のオープンソースを土台にする場合も税込110,000円からのカスタマイズがあります。月額のユーザー課金は発生しません。' },
    { q: '社内のデータが外部に出ることはありませんか？',
      a: '用途に応じて、社内やお客様のサーバーで動くローカルLLMを使う構成にできます。外部のAIサービスに社内データを送らない形での構築実績があります。掲載しているオープンソースは、いずれも自社サーバーに置いて動かせるものです。' },
    { q: '失敗したという話も聞きます。何が原因ですか？',
      a: '多いのは、対象を決めずに「AIで何かできないか」から始めた場合です。動くものを見ないまま仕様を固め、出来上がってから現場と食い違うという流れになります。当社は初日に現場を見て対象を1つに絞り、2日目から目の前で動くものを作って見ていただく進め方をとります。' },
    { q: '作ったシステムは自社のものになりますか？',
      a: 'なります。ソースコード一式をお渡しします。開発はお客様のPCとお客様名義のAIエージェントで行うので、作り方ごと社内に残ります。以後は自社で改造しても、他社に依頼しても構いません。当社に縛られる契約にはしません。' },
  ]

  const body = `<section class="hero"><div class="wrap">
<p class="kicker">AIでできること</p>
<h1>AI導入で、<br>何ができるようになるのか。</h1>
<p class="lead">「AIで何ができるのか」「うちの会社の何が解決するのか」——その問いに、抽象論ではなく用途${caps.length}種類と、実際に土台として使えるオープンソース${total}件で答えます。名古屋市内なら、計15時間・税別15万円で実際に1つ作って確かめられます。<strong>初日3時間の相談は無料</strong>です。</p>
<p><a class="btn btn-main" href="${TRIAL}?ref=ai-system-hero">AI導入お試し実験を見る</a> <a class="btn" href="${SITE}/contact.php?subject=${encodeURIComponent('AI導入で何ができるかの相談')}">何ができるか相談する</a></p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / AIでできること</nav>

<section><div class="panel">
<h2>AIでできることとは？</h2>
<p>AIでできることとは、いま人が時間を使っている作業を、AIと既存のソフトウェアに肩代わりさせることです。具体的には次の4つに分かれます。</p>
<ul class="checks">
<li><strong>読む・写す</strong>——紙やPDF、メールの内容を読み取って、システムに入力する</li>
<li><strong>探す・答える</strong>——社内の資料や過去の回答から、聞かれたことに答える</li>
<li><strong>流す・記録する</strong>——申請、承認、予約、勤怠、在庫の動きを画面で回して残す</li>
<li><strong>集める・見せる</strong>——売上、原価、在庫、工数を集計して、判断できる形にする</li>
</ul>
<p>この4つはどれも、同じ用途で世界中に使われているオープンソースが既にあります。ゼロから作る必要はありません。当社はそれを土台に、日本語化と自社向けの変更を加えて導入します。月額のユーザー課金は発生しません。</p>
</div></section>

<section><div class="panel">
<h2>AI導入で解決できる経営課題は？</h2>
<p>解決できる経営課題とは、原因が「人の時間の使い方」にある課題のことです。下の12は、当社が名古屋の経営者から実際に相談を受ける言い方で並べています。それぞれ、どの用途で手を付けるかまで示しました。</p>
<div class="grid">${issueCards}</div>
</div></section>

<section><div class="panel">
<h2>AI導入は、利益にどうつながるのか？</h2>
<p>利益につながる道筋とは、作業時間の削減がそのまま利益になるのではなく、次の順番を通って初めて数字が動く、ということです。ここを飛ばすと「効率化したのに利益が変わらない」が起きます。</p>
<div class="grid">
<div class="card"><h3>1. 作業時間が減る</h3><p>入力・転記・集計・問い合わせ対応など、人がやっていた定型作業が機械に移ります。ここまでは比較的短期間で起きます。</p></div>
<div class="card"><h3>2. 空いた時間の行き先を決める</h3><p>ここが分かれ目です。行き先を決めないと、空いた時間は別の雑務で埋まります。当社は最初のヒアリングで「減った時間を何に使うか」を先に決めます。</p></div>
<div class="card"><h3>3. 人が価値を生む仕事に移る</h3><p>提案、開発、新規の顧客開拓、既存顧客との関係づくり——採用しないと着手できなかった仕事に、いまの人員で手が回るようになります。</p></div>
<div class="card"><h3>4. 売上と利益が動く</h3><p>同じ人数で扱える量が増え、着手できなかった案件が動きます。原価と在庫が数字で見えることで、値付けと仕入れの判断も変わります。</p></div>
<div class="card"><h3>5. 待遇に返す</h3><p>増えた利益を給与や労働時間に返すと、採用と定着が変わります。人手不足を採用だけで解こうとしない、という選択肢が持てます。</p></div>
</div>
<p class="note">当社は効果を数値で保証しません。業種と業務によって差が大きく、根拠のない数字を掲げないためです。代わりに、初日3時間の無料ヒアリングでどの作業に何時間かかっているかを実際に測り、見込みが立たない場合は「作らないほうがよい」と申し上げます。</p>
</div></section>

<section><div class="panel">
<h2>AI導入のメリットとデメリットは？</h2>
<p>メリットとは、人の時間が空くこと、判断に使える数字が早く出ること、そして知識が人から会社に移ることです。デメリットとは、導入そのものに手間がかかること、間違いを含んだ出力を人が確認しなければならないこと、そして対象を絞らずに始めると効果が出ないことです。当社は後者を隠さずに前提として説明します。</p>
<div class="table-wrap"><table><thead><tr><th>観点</th><th>メリット</th><th>デメリット・注意点</th></tr></thead><tbody>
<tr><th>時間</th><td>入力・転記・集計・一次対応が人の手を離れる</td><td>導入初期は、現場の手順を見せてもらう時間が必要になる</td></tr>
<tr><th>正確さ</th><td>転記ミスや記入漏れが減り、記録が残る</td><td>AIの出力は間違うことがあり、責任のある場面では人の確認が要る</td></tr>
<tr><th>費用</th><td>ユーザー数に応じた月額課金が発生しない構成にできる</td><td>サーバー費用と、作った後の保守は残る</td></tr>
<tr><th>知識</th><td>手順と判断の根拠が文書として会社に残り、属人化が解ける</td><td>元の知識が誰の頭にもない場合、まず言語化から始める必要がある</td></tr>
<tr><th>情報管理</th><td>社内サーバーで動かせば、外部のAIサービスにデータを送らずに済む</td><td>社内で動かす分、機材と運用の準備が要る</td></tr>
<tr><th>効果</th><td>空いた時間の行き先を決めれば、売上と利益に返る</td><td>対象を絞らず「AIで何かできないか」から始めると効果が出ない</td></tr>
</tbody></table></div>
<p class="note">デメリットのうち「間違いを含む出力」は用途の選び方で避けられます。決まった手順を正確に繰り返す処理は、AIを使わず普通のプログラムとして作るのが確実です。</p>
</div></section>

<section><div class="panel">
<h2>何から始めればよいですか？</h2>
<p>始め方とは、対象を1つに絞って、動くものを見ながら作ることです。当社は書類で仕様を固めてから作る進め方をとりません。名古屋市内であれば、1日3時間×5日間の計15時間で、実際に現場で使えるシステムを1つ以上作ります。</p>
<div class="grid">
<div class="card"><h3>1日目（無料）</h3><p>現場に伺い、いまのやり方を見せていただきます。どの作業に時間がかかっているかを測り、最初に手を付ける1つを決めます。ここまでで費用は発生しません。</p></div>
<div class="card"><h3>2〜3日目</h3><p>御社のPCと御社名義のAIエージェントで、目の前で開発します。動くものを見ながらその場で直すので、要件のすれ違いが起きません。</p></div>
<div class="card"><h3>4日目</h3><p>実際のデータを入れて動かします。ここで初めて分かる不足を直します。簡単なもので早く終われば、2つ目に着手します。</p></div>
<div class="card"><h3>5日目</h3><p>御社の環境へ構築し、ソースコードと開発ノウハウをお渡しします。以後は自社で改造できます。</p></div>
</div>
</div></section>

<section><div class="panel">
<h2>AIを使わないほうがよい業務は？</h2>
<p>使わないほうがよい業務とは、決まった手順を正確に繰り返すだけの処理のことです。この種の処理は、普通のプログラムのほうが速く、確実で、安く済みます。また、責任を伴う最終判断——誰と取引するか、いくらで売るか、誰を採用するか——は人が決めることです。当社はAIを入れること自体を目的にしないので、該当する部分は普通のプログラムとして作ります。</p>
</div></section>

<section><div class="panel">
<h2>AIでできることを、やりたいことから探す</h2>
<p>やりたいことから探すとは、製品名ではなく業務の名前で入口を選ぶことです。下の${caps.length}種類から近いものを選ぶと、その用途に使えるオープンソース${total}件が、ライセンスと日本語対応の実測つきで並びます。</p>
${sections}
</div></section>

${ctaBlock(caps[0], 'AI導入', 'AI導入')}

<section><div class="panel">
<h2>名古屋でAI導入を相談するには？</h2>
<p>相談先とは、提案書ではなく動くものを見せられる相手のことです。株式会社エクスブリッジは名古屋市瑞穂区の法人（2004年設立・法人番号4180001056508）で、AIを使った業務システムの開発と、既存のオープンソースを土台にしたカスタマイズを行っています。このページに載せている${total}件は、当社が実際に日本語対応まで調べたうえで掲載しているものです。</p>
<p>「何ができるか分からない」「どこから手を付けるか決まっていない」という段階での相談が最も多く、その状態を前提にしています。初日3時間のヒアリングと提案は無料です。<a href="${SITE}/contact.php?subject=${encodeURIComponent('AI導入で何ができるかの相談')}">お問い合わせフォーム</a>から受け付けています。</p>
</div></section>

<section><div class="panel"><h2>よくあるご質問</h2>
${faqs.map((f) => `<div class="card" style="margin:0 0 10px"><h3>${h(f.q)}</h3><p>${h(f.a)}</p></div>`).join('')}
</div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'Service', name: 'AI導入支援・AI活用支援（名古屋）',
      description: 'AI導入で何ができるかの整理から、実際に動く業務システムの開発・導入まで。初日3時間の相談は無料。',
      url: `${BASE}/`, serviceType: 'AI導入支援、AI活用支援、AIシステム開発、業務システム開発',
      areaServed: [{ '@type': 'City', name: '名古屋市' }, { '@type': 'AdministrativeArea', name: '愛知県' }],
      provider: { '@id': `${SITE}/#organization` },
      offers: { '@type': 'Offer', priceCurrency: 'JPY', price: '150000', url: TRIAL,
        description: '初日3時間のヒアリングと提案は無料。計15時間・税別150,000円。名古屋市内限定。' } },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: 'AIでできること', numberOfItems: caps.length,
      itemListElement: caps.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/c/${c.key}/`, name: c.label })) },
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: `${BASE}/`, description: desc,
      inLanguage: 'ja', dateModified: TODAY,
      isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'AIでできること', item: `${BASE}/` }] },
  ]
  return shell(title, desc, `${BASE}/`, body, ld)
}

const payload = await getPayload({ config })
const result = await payload.find({ collection: 'oss-projects', limit: 0, pagination: false, sort: 'name', depth: 0 })
const projects = result.docs as unknown as Project[]
if (!projects.length) throw new Error('OSSレコードがありません')

// 表示名の正規化は build-catalog.ts が取り込み時に当てているが、DBに既に
// 入っている分は古い表記のまま残る。描画時にも当てて、比較表に
// 「idurar-erp-crm」のようなリポジトリ名がそのまま出るのを防ぐ。
for (const p of projects) p.name = displayName(p.slug, p.name)

/** 一覧ページ1枚に載せる上限。多すぎるページは読めないので切るが、切ったことは本文に書く。 */
const MAX_LIST = 150

// keywords は説明と同じ重み（先頭2要素）で見る。カタログが「ブログ」「CMS」と
// 付けているのに、要約の言い回しだけで主題が決まってしまうのを防ぐ。
const textOf = (p: Project) => [p.summary, [p.description, ...items(p.keywords)].join(' '), ...items(p.useCases)]

// 1) まず全分類との当てはまりを測る。一覧ページには主題が別のOSSも載せる。
//    主題1つだけで振り分けると、分類を細かくした分だけ1件しかないページが増える。
const members = new Map<string, Array<{ p: Project; s: number }>>()
for (const p of projects) {
  for (const { cap, s } of matches(textOf(p))) {
    const list = members.get(cap.key) || []
    list.push({ p, s })
    members.set(cap.key, list)
  }
}

// 2) 薄いページを作らない。当てはまりが MIN_MEMBERS 未満の分類はページにしない。
const pageCaps = CAPABILITIES.filter((c) => (members.get(c.key) || []).length >= MIN_MEMBERS)
const allowed = new Set(pageCaps.map((c) => c.key))

// 3) 主題（詳細ページのH1・タイトル・パンくずに使う）は、ページのある分類から選ぶ。
//    ページの無い分類を主題にすると、パンくずの行き先が404になる。
const capOf = new Map<string, Capability>()
const primary = new Map<string, Project[]>()
for (const p of projects) {
  const cap = classify(textOf(p), allowed, p.category)
  capOf.set(p.slug, cap)
  const list = primary.get(cap.key) || []
  list.push(p)
  primary.set(cap.key, list)
}

// どの分類にも当てはまらなかったOSSの受け皿
const otherList = primary.get(OTHER.key) || []
const usedCaps = otherList.length ? [...pageCaps, OTHER] : pageCaps

const byStars = (a: Project, b: Project) => Number(b.stars || 0) - Number(a.stars || 0)
function listOf(cap: Capability): Project[] {
  if (cap.key === OTHER.key) return [...otherList].sort(byStars)
  return (members.get(cap.key) || [])
    .sort((a, b) => b.s - a.s || byStars(a.p, b.p))
    .map((x) => x.p)
}
const counts = new Map(usedCaps.map((c) => [c.key, listOf(c).length]))

// kurage /oss/<slug>/ から exbridge の分類ページへ内部リンクを張るための対応表。
// build-static.ts が読む。ページのある分類だけ書く（404へのリンクを作らない）。
await fs.writeFile(path.join(root, 'data', 'capability-map.json'), JSON.stringify({
  generatedAt: TODAY,
  caps: Object.fromEntries(usedCaps.map((c) => [c.key, { label: c.label, noun: c.noun || null }])),
  primary: Object.fromEntries(projects.map((p) => [p.slug, capOf.get(p.slug)!.key])),
}))

await fs.rm(distRoot, { recursive: true, force: true })
await fs.mkdir(distRoot, { recursive: true })
await fs.writeFile(path.join(distRoot, 'index.html'), indexPage(usedCaps, counts, projects.length))

for (const cap of usedCaps) {
  const all = listOf(cap)
  const related = usedCaps.filter((c) => c.group === cap.group && c.key !== cap.key)
  const dir = path.join(distRoot, 'c', cap.key)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'index.html'), capabilityPage(cap, all, related, counts))
}

for (const p of projects) {
  const cap = capOf.get(p.slug)!
  const siblings = listOf(cap).filter((s) => s.slug !== p.slug).slice(0, 5)
  const dir = path.join(distRoot, p.slug)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'index.html'), detailPage(p, cap, siblings))
}

const urls = [`${BASE}/`, ...usedCaps.map((c) => `${BASE}/c/${c.key}/`), ...projects.map((p) => `${BASE}/${p.slug}/`)]
const today = new Date().toISOString().slice(0, 10)
await fs.writeFile(path.join(distRoot, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${h(u)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u === `${BASE}/` ? '0.9' : u.includes('/c/') ? '0.8' : '0.7'}</priority></url>`).join('\n') +
  `\n</urlset>\n`)

payload.logger.info(`ai-system: ${projects.length}ページ + できること${usedCaps.length}枚 + index/sitemap`)

process.exit(0)
