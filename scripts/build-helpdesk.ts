/**
 * 6つ目の入口 exbridge.jp/helpdesk/ を作る。
 *
 * 入口の違い:
 *   /oss/        OSSの名前が入口       「そのOSSは何か」
 *   /ai-system/  やりたいことが入口     「その業務をどうやるか」
 *   /saas/       SaaSの名前が入口       「いま使っているサービスの代わりに何ができるか」
 *   /solution/   業種・業務が入口
 *   /zenn/       技術記事が入口
 *   /helpdesk/   困っている状況が入口   「IT担当がいない。どう任せればいいか」
 *
 * ねらい（2026-08-30）:
 *   情シス代行・IT顧問を探している人が、どの入口から来ても
 *   AI-IT顧問契約（月15時間・税別15万円・名古屋市内限定）にたどり着くようにする。
 *
 * 書かないこと（/saas/ と同じ規律）:
 *   - 他社の会社名・サービス名（比較サイトの受け売りを事実として書かない）
 *   - 他社の具体的な金額（改定されると嘘になる。相場は「幅」でしか書かない）
 *   - 他社の否定（他の形のほうが合う場合は、必ずそう書く）
 */
import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE, KURAGE } from './site'
import { PROTO } from './demos'
import { ORG, orgLd, TODAY, h, attr, json, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'helpdesk')
const BASE = `${SITE}/helpdesk`
const KOMON = `${SITE}/ai-it-komon.html`

const SHELL = {
  refPrefix: 'exbridge-helpdesk',
  base: BASE,
  footerLinks: `<a href="${SITE}/profile.html">会社概要</a>　<a href="${SITE}/contact.php?ref=exbridge-helpdesk">お問い合わせ</a>　<a href="${BASE}/">IT担当を外に持つ方法</a>　<a href="${KOMON}">AI-IT顧問契約</a>　<a href="${SITE}/saas/">SaaSとOSSの対応表</a>　<a href="${KURAGE}/oss/?ref=exbridge-helpdesk">業務OSSカタログ</a>　<a href="${PROTO}/?ref=exbridge-helpdesk">触れるデモ一覧</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[]) => baseShell(t, d, u, b, l, SHELL)

type Page = {
  slug: string; name: string; kind: 'type' | 'worry'; kw: string
  what: string; good: string; weak: string; souba: string; body: string
}

const list = JSON.parse(await fs.readFile(path.join(root, 'data', 'helpdesk-list.json'), 'utf8')) as Page[]
const types = list.filter((p) => p.kind === 'type')
const worries = list.filter((p) => p.kind === 'worry')

/** どのページの末尾にも置く、AI-IT顧問契約への案内。ここが入口の出口。 */
const komonBlock = (slug: string) => `
<section class="panel komon">
  <h2>当社の場合：AI-IT顧問契約</h2>
  <p>株式会社エクスブリッジは、<b>月15時間・税別150,000円</b>で、ITでできることをひととおり引き受けています（<b>名古屋市内限定</b>）。
     ネットワークの調査、システムの設計と開発、Webサイトの制作、Webマーケティングまでを月額に含みます。</p>
  <p>そのかわり、<b>毎日のヘルプデスク当番と24時間365日の障害対応は引き受けません</b>。
     問い合わせ対応が中心の会社さまには、上に書いた「情シス代行」や「ヘルプデスク代行」の形のほうが合います。</p>
  <ul class="chk">
    <li>納品物は、予定・実績報告書／システム設計書／プログラム（ソース）／Webサイト</li>
    <li>月次契約。年間契約や最低契約期間はありません</li>
    <li>初回のご相談は無料。合わないと思えば、その場でそう申し上げます</li>
  </ul>
  <p class="cta-row"><a class="btn btn-main" href="${KOMON}?ref=hd-${attr(slug)}">AI-IT顧問契約のページを見る</a>
     <a class="btn" href="${SITE}/contact.php?ref=hd-${attr(slug)}&subject=AI-IT顧問契約について">無料で相談する</a></p>
</section>`

const relatedBlock = (self: Page) => {
  const same = list.filter((p) => p.slug !== self.slug && p.kind === self.kind).slice(0, 6)
  const other = list.filter((p) => p.kind !== self.kind).slice(0, 4)
  const li = (p: Page) => `<li><a href="${BASE}/${attr(p.slug)}.html">${h(p.name)}</a></li>`
  return `<section class="panel"><h2>ほかの探し方</h2>
    <div class="cols">
      <div><h3>${self.kind === 'type' ? '任せ方の種類' : 'よくある状況'}</h3><ul class="plain">${same.map(li).join('')}</ul></div>
      <div><h3>${self.kind === 'type' ? 'よくある状況' : '任せ方の種類'}</h3><ul class="plain">${other.map(li).join('')}</ul></div>
    </div>
    <p class="small"><a href="${BASE}/">すべて見る</a></p></section>`
}

function detailPage(p: Page): string {
  const isType = p.kind === 'type'
  const title = isType
    ? `${p.name}とは｜任せられること・向き不向き・費用の考え方`
    : `${p.name}｜どう解決するか（IT担当がいない中小企業向け）`
  const desc = (p.what + (p.body || '')).slice(0, 118)
  const faq = [
    { q: `${p.name}は、どんな会社に向いていますか？`, a: p.good || p.what },
    { q: `費用はどのくらいかかりますか？`, a: p.souba || '任せる範囲によって変わります。同じ月額でも、問い合わせ対応だけのものと、作る作業まで含むものでは中身が違います。金額を比べる前に、何をどこまでやるか、時間の上限があるか、成果物が残るかの3つを確かめてください。' },
    { q: `エンジニアを雇うのと比べてどうですか？`, a: '年収500万円のエンジニアを1人雇うと、社会保険料の会社負担を含めて年間およそ600万円かかります。さらに採用費、PC、教育の時間が乗ります。外部に任せる形は、この固定費を持たずに同じ役割を確保するための選択肢です。ただし常駐が必要な仕事は外部では代わりになりません。' },
  ]
  const ld = [
    orgLd(),
    { '@context': 'https://schema.org', '@type': 'Article', headline: title,
      description: desc, datePublished: TODAY, dateModified: TODAY,
      mainEntityOfPage: `${BASE}/${p.slug}.html`, author: { '@type': 'Organization', name: ORG.name },
      publisher: { '@type': 'Organization', name: ORG.name } },
    { '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'IT担当を外に持つ', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: p.name, item: `${BASE}/${p.slug}.html` }] },
  ]
  const body = `<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">IT担当を外に持つ</a> / ${h(p.name)}</nav>
<section class="detail-hero">
  <span class="eyebrow">${isType ? '任せ方の種類' : 'よくある状況'}</span>
  <h1>${h(title)}</h1>
  <p class="lead">${h(p.what)}</p>
</section>
${p.body ? `<section class="panel"><h2>どう考えるか</h2><p>${h(p.body)}</p></section>` : ''}
${isType ? `
<section class="panel"><h2>向いている会社</h2><p>${h(p.good)}</p></section>
<section class="panel"><h2>気をつけるところ</h2><p>${h(p.weak)}</p></section>
<section class="panel"><h2>費用の考え方</h2><p>${h(p.souba)}</p>
  <p class="small">金額は各社・各プランで大きく異なります。ここに書いているのは公開情報から見た一般的な幅で、特定の会社の価格ではありません。実際の金額は各社へご確認ください。</p></section>` : ''}
<section class="panel"><h2>比べるときに見る3つ</h2>
  <ul class="chk">
    <li><b>何をどこまでやるか</b> — 問い合わせ対応だけか、作る作業まで含むか</li>
    <li><b>時間の上限があるか</b> — 月◯時間までか、無制限か、超えたらどうなるか</li>
    <li><b>成果物が残るか</b> — 報告書だけか、設計書やソースコードが手元に残るか</li>
  </ul>
  <p>同じ「月額◯万円」でも、この3つで中身がまったく変わります。金額を並べるのは、そのあとです。</p></section>
${komonBlock(p.slug)}
${relatedBlock(p)}
</main>`
  return shell(title, desc, `${BASE}/${p.slug}.html`, body, ld)
}

function indexPage(): string {
  const title = 'IT担当を外に持つ方法｜情シス代行・IT顧問・開発外注の違いと選び方'
  const desc = '社内にIT担当がいない中小企業向けに、外部へ任せる形（情シス代行、IT顧問、ヘルプデスク代行、常駐、開発外注など）の違いと、よくある状況ごとの考え方をまとめました。費用は一般的な幅で示しています。'
  const card = (p: Page) => `<a class="card" href="${BASE}/${attr(p.slug)}.html"><h3>${h(p.name)}</h3><p>${h(p.what.slice(0, 78))}…</p><span class="kw">${h(p.kw)}</span></a>`
  const ld = [
    orgLd(),
    { '@context': 'https://schema.org', '@type': 'ItemList', name: title,
      numberOfItems: list.length,
      itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1,
        name: p.name, url: `${BASE}/${p.slug}.html` })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'IT担当を外に持つ', item: `${BASE}/` }] },
  ]
  const body = `<main class="wrap">
<section class="detail-hero">
  <span class="eyebrow">IT担当を外に持つ</span>
  <h1>社内にIT担当がいないとき、どう任せればいいか。</h1>
  <p class="lead">外に任せる形はいくつもあり、名前が似ていても中身が違います。
    どれが向いているかは、困っていることによって変わります。まず自社に近いところから読んでください。</p>
</section>
<section class="panel"><h2>任せ方の種類（${types.length}件）</h2>
  <p class="small">世の中にある形を整理したものです。特定の会社のサービスを指すものではありません。</p>
  <div class="grid">${types.map(card).join('')}</div></section>
<section class="panel"><h2>よくある状況から探す（${worries.length}件）</h2>
  <div class="grid">${worries.map(card).join('')}</div></section>
${komonBlock('index')}
</main>`
  return shell(title, desc, `${BASE}/`, body, ld)
}

await fs.rm(distRoot, { recursive: true, force: true })
await fs.mkdir(distRoot, { recursive: true })
await fs.writeFile(path.join(distRoot, 'index.html'), indexPage())
for (const p of list) {
  await fs.writeFile(path.join(distRoot, `${p.slug}.html`), detailPage(p))
}
const urls = [`${BASE}/`, ...list.map((p) => `${BASE}/${p.slug}.html`)]
await fs.writeFile(path.join(distRoot, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${h(u)}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>${u.endsWith('/helpdesk/') ? '0.9' : '0.8'}</priority></url>`).join('\n') +
  `\n</urlset>\n`)

console.log(`helpdesk: ${list.length}ページ + index/sitemap → ${distRoot}`)
