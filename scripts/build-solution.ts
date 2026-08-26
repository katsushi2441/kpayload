/**
 * /solution/ — 業種・業務別ITソリューションの静的ページを生成する。
 * /saas/(サービス名から引く)・/oss/(OSSから引く)・/ai-system/(やりたいことから引く)に次ぐ
 * 4つ目の入り口。「その業種の有名SaaS」→「OSS・買い切りでの固定費削減」→
 * kappstore商品・Brain手順書・vibe-oss/vibe-prototype への導線を張る。
 *
 * データ: data/solution-list.json（saasSlugs は saas-list.json、ossPicks は payload DB を参照）
 * 出力:   dist/solution/<slug>.html + index.html + sitemap.xml
 * 方針は build-saas.ts と同じ: 金額の断定をしない・置き換え不能なものは不能と書く・商標明記。
 */
import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import { SITE, KURAGE, TRIAL } from './site'
import { DEMOS, PROTO, demoUrl } from './demos'
import { TODAY, h, attr, shell as baseShell, type Project } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'solution')
const BASE = `${SITE}/solution`

const SHELL = {
  refPrefix: 'exbridge-solution',
  base: BASE,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${SITE}/contact.php">無料相談</a>　<a href="${BASE}/">業種・業務別ソリューション</a>　<a href="${SITE}/saas/">SaaSとOSSの対応表</a>　<a href="${SITE}/ai-system/?ref=exbridge-solution">AIでできること</a>　<a href="${KURAGE}/oss/?ref=exbridge-solution">業務OSSカタログ</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[]) => baseShell(t, d, u, b, l, SHELL)

type SolutionPage = {
  slug: string; kind: 'industry' | 'gyomu'; name: string; kicker: string
  saasSlugs: string[]; extraSaas: string[]; ossPicks: string[]
  products: Array<{ name: string; url: string; price: string }>
  brain: Array<{ label: string; url: string }>
  lps: Array<{ label: string; url: string }>
  facts: string
  lead?: string; verdict?: string; faqs?: Array<{ q: string; a: string }>
}
type Saas = { slug: string; name: string; vendor: string; what: string }

const pages = JSON.parse(await fs.readFile(path.join(root, 'data', 'solution-list.json'), 'utf8')) as SolutionPage[]
const saasList = JSON.parse(await fs.readFile(path.join(root, 'data', 'saas-list.json'), 'utf8')) as Saas[]
const saasBySlug = new Map(saasList.map((s) => [s.slug, s]))

const payload = await getPayload({ config })
const result = await payload.find({ collection: 'oss-projects', limit: 0, pagination: false, sort: 'name', depth: 0 })
const bySlug = new Map((result.docs as unknown as Project[]).map((p) => [p.slug, p]))

function licenseVerdict(p: Project): string {
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

function ossCell(p: Project, slug: string): string {
  const links: string[] = []
  if (DEMOS[p.slug]) links.push(`<a href="${demoUrl(p.slug, `solution-${slug}`)}" target="_blank" rel="noopener">触れる</a>`)
  else if (p.demoUrl) links.push(`<a href="${attr(p.demoUrl)}?ref=solution-${attr(slug)}" target="_blank" rel="noopener">触れる</a>`)
  const buy = p.buyUrl || (p.lpUrl && p.lpUrl.includes('kappstore') ? p.lpUrl : '')
  if (buy) links.push(`<a href="${attr(buy)}${buy.includes('?') ? '&' : '?'}ref=solution-${attr(slug)}" target="_blank" rel="noopener">買い切り</a>`)
  return links.join(' / ') || '—'
}

const KIND_LABEL = { industry: '業種', gyomu: '業務' } as const

function detailPage(p: SolutionPage): string {
  const url = `${BASE}/${p.slug}.html`
  const saas = p.saasSlugs.map((s) => saasBySlug.get(s)).filter(Boolean) as Saas[]
  const oss = p.ossPicks.map((s) => bySlug.get(s)).filter(Boolean) as Project[]
  const title = `${p.name}のITコストを下げる｜有名SaaSとオープンソース代替・買い切りの選択肢 | 株式会社エクスブリッジ`
  const desc = `${p.name}で使われる${[...saas.map((s) => s.name), ...p.extraSaas].slice(0, 4).join('、')}などのITサービスは、人数×月額の固定費が積み上がります。置き換えられる業務と置き換えられない業務を正直に仕分けし、オープンソース・買い切りで固定費を減らす道筋を、名古屋のシステム開発会社がまとめました。`
  const faqs = p.faqs || []

  const body = `<section class="hero"><div class="wrap">
<p class="kicker">${KIND_LABEL[p.kind]}別ソリューション｜${h(p.kicker)}</p>
<h1>${h(p.name)}のITコストを、<br>オープンソースと買い切りで見直す。</h1>
<p class="lead">${h(p.lead || p.facts)}</p>
<p><a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent(p.name + 'のIT費用の相談')}">無料で相談する（Zoom可）</a> <a class="btn" href="${KURAGE}/vibe-oss.html?ref=solution-${attr(p.slug)}">OSSカスタマイズ（110,000円〜）</a></p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">業種・業務別ソリューション</a> / ${h(p.name)}</nav>

${saas.length || p.extraSaas.length ? `<section><div class="panel">
<h2>${h(p.name)}でよく使われているサービス</h2>
<p>まず現状の定番から。以下は${h(p.name)}で広く使われているサービスです。名前をクリックすると、そのサービスの費用の仕組みとオープンソース代替の詳細ページに移ります。</p>
<div class="table-wrap"><table><thead><tr><th>サービス</th><th>提供元</th><th>どんなもの？</th></tr></thead><tbody>
${saas.map((s) => `<tr><th><a href="${SITE}/saas/${attr(s.slug)}.html">${h(s.name)}</a></th><td>${h(s.vendor)}</td><td>${h(s.what)}</td></tr>`).join('')}
${p.extraSaas.map((n) => `<tr><th>${h(n)}</th><td>—</td><td>（対応表ページは準備中）</td></tr>`).join('')}
</tbody></table></div>
<p class="note">これらは便利なサービスであり、当社は「全部やめましょう」とは言いません。下の仕分けをご覧ください。</p>
</div></section>` : ''}

<section><div class="panel">
<h2>置き換えられる業務・置き換えられない業務（正直な仕分け）</h2>
<p>${h(p.verdict || p.facts)}</p>
</div></section>

${oss.length ? `<section><div class="panel">
<h2>${h(p.name)}で使えるオープンソース・買い切り</h2>
<p>以下は、上の「分離できる業務」に充てられるオープンソースです。ライセンスと日本語対応は当社がGitHubの公開情報から実測しています。</p>
<div class="table-wrap"><table><thead><tr><th>名前</th><th>できること</th><th>ライセンス</th><th>受託での構築・納品</th><th>日本語</th><th>デモ・購入</th></tr></thead><tbody>
${oss.map((o) => `<tr><th><a href="${SITE}/ai-system/${attr(o.slug)}/?ref=solution-${attr(p.slug)}">${h(o.name)}</a></th><td>${h(o.summary)}</td><td>${h(o.license)}</td><td>${h(licenseVerdict(o))}</td><td>${h(o.japaneseStatus)}</td><td>${ossCell(o, p.slug)}</td></tr>`).join('')}
</tbody></table></div>
</div></section>` : ''}

${p.products.length ? `<section><div class="panel">
<h2>すぐ導入できる買い切り製品（ソースコード込み）</h2>
<p>当社が開発・販売している買い切りの業務システムです。月額はかからず、ソースコードごとお渡しするので自社で改造できます（MITライセンス）。</p>
<div class="cat-grid">
${p.products.map((pr) => `<a class="cat-card" href="${attr(pr.url)}&ref=solution-${attr(p.slug)}" target="_blank" rel="noopener"><b>${h(pr.name)}</b><span>買い切り ${h(pr.price)}（税込）・Kurage App Store</span></a>`).join('')}
</div>
${p.brain.length ? `<p style="margin-top:12px">構築手順を自分で読みたい方へ: ${p.brain.map((b) => `<a href="${attr(b.url)}?ref=solution-${attr(p.slug)}" target="_blank" rel="noopener">${h(b.label)}</a>`).join('　')}</p>` : ''}
${p.lps.length ? `<p class="note">${p.lps.map((l) => `<a href="${attr(l.url)}?ref=solution-${attr(p.slug)}">${h(l.label)}</a>`).join('　')}</p>` : ''}
</div></section>` : ''}

<div class="cta">
<h2>${h(p.name)}のIT費用、いくら減らせるか一緒に数えます</h2>
<p><strong>初日のヒアリングと提案は無料</strong>です。いまの月額の一覧を見せていただければ、「残すもの・やめるもの・置き換えるもの」を仕分けしてお返しします。Zoomでも対面（名古屋近郊）でも。</p>
<a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent(p.name + 'のIT費用の相談')}">無料で相談する</a>
<a class="btn" href="${KURAGE}/vibe-oss.html?ref=solution-${attr(p.slug)}">OSSカスタマイズ（110,000円〜）</a>
<a class="btn" href="${KURAGE}/vibe-prototype.html?ref=solution-${attr(p.slug)}">動くデモを先に見る</a>
<a class="btn" href="${TRIAL}?ref=solution-${attr(p.slug)}">AI導入お試し実験</a>
</div>

${faqs.length ? `<section><div class="panel"><h2>よくあるご質問</h2>
${faqs.map((f) => `<div class="card" style="margin:0 0 10px"><h3>${h(f.q)}</h3><p>${h(f.a)}</p></div>`).join('')}
</div></section>` : ''}

<section><div class="panel">
<p class="note">記載のサービス名・製品名は各社の商標または登録商標です。本ページは当社が独自にまとめた比較情報であり、各提供元が提供・監修するものではありません。料金や機能は変更される場合があるため、最新の情報は各公式サイトをご確認ください。</p>
</div></section>
</main>`

  const ld = [
    ...(faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
    { '@context': 'https://schema.org', '@type': 'Service', name: `${p.name}向けIT費用削減・OSS導入支援`,
      description: desc, url, serviceType: 'OSS導入・日本語化・カスタマイズ・買い切り業務システム',
      areaServed: [{ '@type': 'City', name: '名古屋市' }, { '@type': 'Country', name: '日本' }],
      provider: { '@id': `${SITE}/#organization` },
      offers: { '@type': 'Offer', priceCurrency: 'JPY', price: '110000', url: `${KURAGE}/vibe-oss.html`,
        description: '土台にするOSSが決まっている場合。合計10時間以内・税込110,000円から。' } },
    ...(oss.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: `${p.name}で使えるオープンソース`,
      numberOfItems: oss.length,
      itemListElement: oss.map((o, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/ai-system/${o.slug}/`, name: o.name })) }] : []),
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'ja',
      dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: '業種・業務別ソリューション', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url }] },
  ]
  return shell(title, desc, url, body, ld)
}

function indexPage(): string {
  const title = '業種・業務別ITソリューション｜SaaSの固定費をOSSと買い切りで減らす | 株式会社エクスブリッジ'
  const desc = `介護・保育・美容・飲食・宿泊・建設・医療・不動産などの業種別と、問い合わせ管理・議事録・CRM・人事・経理・予約などの業務別に、有名SaaSとオープンソース代替をまとめました。置き換えられない業務は「できない」と明記。名古屋のシステム開発会社が導入まで行います。`
  const ind = pages.filter((p) => p.kind === 'industry')
  const gyo = pages.filter((p) => p.kind === 'gyomu')
  const card = (p: SolutionPage) => `<a class="cat-card" href="${BASE}/${attr(p.slug)}.html"><b>${h(p.name)}</b><span>${h(p.kicker)}</span></a>`
  const body = `<section class="hero"><div class="wrap">
<p class="kicker">業種・業務別ソリューション</p>
<h1>あなたの業種のIT費用、<br>「本体は残して、まわりを買い切りに」。</h1>
<p class="lead">業種特化SaaSの本体（制度対応・集客網・取引網）は簡単には置き換えられません。当社は無理に「全部やめましょう」とは言いません。<strong>分離できる業務だけをオープンソースと買い切りに移して、人数×月額の固定費を減らす</strong>——その仕分けを業種別・業務別にまとめました。</p>
<p><a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent('IT費用の見直し相談')}">無料で相談する（Zoom可）</a> <a class="btn" href="${SITE}/saas/">サービス名から探す</a></p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / 業種・業務別ソリューション</nav>
<section><div class="panel">
<h2>業種から探す</h2>
<div class="cat-grid">${ind.map(card).join('')}</div>
</div></section>
<section><div class="panel">
<h2>業務から探す</h2>
<div class="cat-grid">${gyo.map(card).join('')}</div>
</div></section>
<section><div class="panel">
<h2>4つの入り口</h2>
<p>目的に合わせてどうぞ。<a href="${SITE}/saas/">サービス名から探す（SaaSとOSSの対応表）</a>／<a href="${SITE}/ai-system/?ref=solution-index">やりたいことから探す（AIでできること）</a>／<a href="${KURAGE}/oss/?ref=solution-index">OSSカタログから探す</a>／このページ（業種・業務から探す）。</p>
</div></section>
<section><div class="panel">
<p class="note">記載のサービス名・製品名は各社の商標または登録商標です。本ページは当社が独自にまとめた比較情報であり、各提供元が監修するものではありません。</p>
</div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: `${BASE}/`, description: desc,
      inLanguage: 'ja', dateModified: TODAY,
      isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: '業種・業務別ITソリューション', numberOfItems: pages.length,
      itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/${p.slug}.html`, name: p.name })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: '業種・業務別ソリューション', item: `${BASE}/` }] },
  ]
  return shell(title, desc, `${BASE}/`, body, ld)
}

await fs.rm(distRoot, { recursive: true, force: true })
await fs.mkdir(distRoot, { recursive: true })
await fs.writeFile(path.join(distRoot, 'index.html'), indexPage())
for (const p of pages) {
  await fs.writeFile(path.join(distRoot, `${p.slug}.html`), detailPage(p))
}
const urls = [`${BASE}/`, ...pages.map((p) => `${BASE}/${p.slug}.html`)]
await fs.writeFile(path.join(distRoot, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${h(u)}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>${u.endsWith('/solution/') ? '0.9' : '0.8'}</priority></url>`).join('\n') +
  `\n</urlset>\n`)
const missing = pages.filter((p) => !p.lead || !p.verdict || !(p.faqs || []).length)
payload.logger.info(`solution: ${pages.length}ページ + index/sitemap`)
if (missing.length) payload.logger.warn(`編集文(lead/verdict/faqs)未設定: ${missing.map((p) => p.slug).join(', ')}`)
