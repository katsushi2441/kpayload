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
import { TODAY, h, attr, shell as baseShell, fitLength, type Project } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'solution')
const BASE = `${SITE}/solution`

const SHELL = {
  refPrefix: 'exbridge-solution',
  base: BASE,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${SITE}/contact.php">無料相談</a>　<a href="${BASE}/">業種・業務別ソリューション</a>　<a href="${SITE}/saas/">SaaSとOSSの対応表</a>　<a href="${SITE}/ai-system/?ref=exbridge-solution">AIでできること</a>　<a href="${KURAGE}/oss/?ref=exbridge-solution">業務OSSカタログ</a>　<a href="${SITE}/outsourcing/">業務のAI自動化</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[], pvTags?: string[], ogImage?: string) =>
  baseShell(t, d, u, b, l, { ...SHELL, pvTags, ogImage: ogImage ?? SHELL.ogImage })

type SolutionPage = {
  slug: string; kind: 'industry' | 'gyomu'; name: string; kicker: string
  saasSlugs: string[]; extraSaas: string[]; ossPicks: string[]
  products: Array<{ name: string; url: string; price: string }>
  brain: Array<{ label: string; url: string }>
  lps: Array<{ label: string; url: string }>
  facts: string
  lead?: string; verdict?: string; faqs?: Array<{ q: string; a: string }>
  /** 「ITコストを下げる/SaaS代替」の型が合わないページ用の見出し上書き。
   *  例: 既存システムの機能拡張は受託開発の相談であってSaaS代替ではない(2026-09-05)。 */
  titleOverride?: string; h1Override?: string; descOverride?: string
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
  const title = p.titleOverride || `${p.name}のITコストを下げる｜有名SaaSとオープンソース代替・買い切りの選択肢 | 株式会社エクスブリッジ`
  const desc = p.descOverride || `${p.name}で使われる${[...saas.map((s) => s.name), ...p.extraSaas].slice(0, 4).join('、')}などのITサービスは、人数×月額の固定費が積み上がります。置き換えられる業務と置き換えられない業務を正直に仕分けし、オープンソース・買い切りで固定費を減らす道筋を、名古屋のシステム開発会社がまとめました。`
  const faqs = p.faqs || []

  const body = `<section class="hero"><div class="wrap">
<p class="kicker">${KIND_LABEL[p.kind]}別ソリューション｜${h(p.kicker)}</p>
<h1>${p.h1Override ? h(p.h1Override).replaceAll('&lt;br&gt;', '<br>') : `${h(p.name)}のITコストを、<br>オープンソースと買い切りで見直す。`}</h1>
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
<h2>すぐ導入できる買い切り商品（Kurage App Store）</h2>
<p>当社が販売している買い切り商品です。月額はかかりません。<b>業務アプリ</b>はソースコード込み（MITライセンス）で自社改造OK、<b>日本語導入キット</b>は無料のオープンソース本体を共有レンタルサーバーに日本語で立てるための実測手順書＋ツール一式です。</p>
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
  return shell(title, desc, url, body, ld, [p.slug], `${SITE}/images/ogp/sol-${p.slug}.png`)
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


// ===================== 業種×業務マトリクス (2026-09-01) =====================
// 24ページの平面構造では粒度が粗い、という指摘を受けての拡張。
// 業種36×業務15(除外つき)=476ページを、業務ごとのOSS実測表(カタログ2,800件から抽出)と
// 自社製品(kappstore)を差し込んで生成する。文章は業種context×業務painの合成+固有FAQ。
type MG = { slug: string; name: string; cats: string[]; rx: string; pain: string
  products: Array<{ name: string; url: string; price: string }> }
type MI = { slug: string; name: string; kicker: string; context: string; skip: string[] }
const matrix = JSON.parse(await fs.readFile(path.join(root, 'data', 'solution-matrix.json'), 'utf8')) as { gyomu: MG[]; industries: MI[] }
const allProjects = result.docs as unknown as Project[]

function pickOss(g: MG): Project[] {
  const rx = g.rx ? new RegExp(g.rx, 'i') : null
  // rx一致は開発者向けカテゴリを除外する。「transcri」等が学習用リポジトリに
  // 誤爆して、業務ページの表にECチュートリアルが並んだ(2026-09-01実測)。
  const RX_EXCLUDE = new Set(['aidev', 'devtools', 'devsupport', 'media', 'sitegen'])
  // 自社製品はfeaturedフラグが立っていないものがある(kaima等)ので、リポジトリで判定
  const own = (p: Project) => (p.githubUrl || '').includes('katsushi2441')
  const hit = allProjects.filter((p) => {
    if (g.cats.includes(p.category)) return true
    if (!rx || RX_EXCLUDE.has(p.category)) return false
    if (!p.featured && !own(p) && Number(p.stars || 0) < 50) return false
    // 説明文まで対象にすると無関係な語の混入で誤爆する(EC教材が議事録表に出た)
    return rx.test(`${p.name} ${p.summary || ''}`)
  })
  const score = (p: Project) =>
    (p.featured || own(p) ? 1e9 : 0) + (DEMOS[p.slug] ? 1e8 : 0) +
    ((p.japaneseStatus || '').includes('日本語') && !(p.japaneseStatus || '').includes('なし') ? 1e7 : 0) +
    Number(p.stars || 0)
  return hit.sort((a, b) => score(b) - score(a)).slice(0, 6)
}
const ossByGyomu = new Map(matrix.gyomu.map((g) => [g.slug, pickOss(g)]))

function pairPage(ind: MI, g: MG): string {
  const url = `${BASE}/${ind.slug}/${g.slug}.html`
  const oss = ossByGyomu.get(g.slug) || []
  const title = fitLength(32,
    `${ind.name}の${g.name}を安くする｜OSSと買い切り`,
    `${ind.name}の${g.name}｜OSSと買い切り`,
    `${ind.name}の${g.name}を安くする`)
  const desc = `${ind.name}の${g.name}——${g.pain}。有名サービスの月額を払い続けなくても、オープンソースと買い切りで持てる範囲を、実測（ライセンス・日本語対応）つきでまとめました。名古屋のシステム開発会社が導入まで行います。初日の相談は無料です。`
  const faqs = [
    { q: `${ind.name}でも${g.name}のシステムを自前で持てますか？`,
      a: `持てます。${ind.context}${g.name}はその中でも分離しやすい業務で、下に挙げたオープンソースや当社の買い切り商品を土台にすれば、月額課金なしで運用できます。` },
    { q: `いま使っているサービスからの乗り換えは大変ではないですか？`,
      a: `既存データの持ち出しと移行が主な作業です。当社は初日のヒアリング（無料）で、いまのやり方を見せていただいてから、移行の範囲と費用をお出しします。無理に全部を置き換える提案はしません。` },
    { q: `費用はどのくらいかかりますか？`,
      a: `買い切り商品はソースコード込みで表示価格のみ、月額はありません。オープンソースを御社仕様に直す場合は税込110,000円からのカスタマイズ、名古屋市内なら計15時間・税別15万円のお試し導入もあります。` },
  ]
  const others = matrix.gyomu.filter((x) => x.slug !== g.slug && !ind.skip.includes(x.slug)).slice(0, 6)
  const otherInds = matrix.industries.filter((x) => x.slug !== ind.slug && !x.skip.includes(g.slug)).slice(0, 8)
  const body = `<section class="hero"><div class="wrap">
<p class="kicker">${h(ind.name)}｜${h(ind.kicker)}</p>
<h1>${h(ind.name)}の${h(g.name)}を、<br>買い切りとオープンソースで。</h1>
<p class="lead">${h(g.pain)}——${h(ind.name)}の現場からよく伺う悩みです。${h(ind.context)}</p>
<p><a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent(`${ind.name}の${g.name}の相談`)}">無料で相談する（Zoom可）</a></p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">業種・業務別</a> / <a href="${BASE}/${attr(ind.slug)}/">${h(ind.name)}</a> / ${h(g.name)}</nav>
${g.products.length ? `<section><div class="panel">
<h2>すぐ導入できる買い切り（Kurage App Store）</h2>
<p>当社が販売している${h(g.name)}向けの買い切り商品です。月額はかかりません。デモを触ってから判断できます。</p>
<div class="cat-grid">
${g.products.map((pr) => `<a class="cat-card" href="${attr(pr.url)}&ref=solution-${attr(ind.slug)}-${attr(g.slug)}" target="_blank" rel="noopener"><b>${h(pr.name)}</b><span>買い切り ${h(pr.price)}（税込）</span></a>`).join('')}
</div></div></section>` : ''}
${oss.length ? `<section><div class="panel">
<h2>${h(g.name)}に使えるオープンソース</h2>
<p>カタログ${allProjects.length.toLocaleString('en-US')}件から、${h(g.name)}に当てはまるものを実測値（規模・日本語対応・デモの有無）で並べています。ライセンスの範囲で無料で使えます。</p>
<div class="table-wrap"><table><thead><tr><th>名前</th><th>できること</th><th>ライセンス</th><th>日本語</th><th>デモ・購入</th></tr></thead><tbody>
${oss.map((o) => `<tr><th><a href="${SITE}/ai-system/${attr(o.slug)}/?ref=solution-${attr(ind.slug)}-${attr(g.slug)}">${h(o.name)}</a></th><td>${h(o.summary)}</td><td>${h(o.license)}</td><td>${h(o.japaneseStatus)}</td><td>${ossCell(o, `${ind.slug}-${g.slug}`)}</td></tr>`).join('')}
</tbody></table></div></div></section>` : ''}
<div class="cta">
<h2>${h(ind.name)}の${h(g.name)}、何から手を付けるか一緒に決めます</h2>
<p><strong>初日のヒアリングと提案は無料</strong>です。いまのやり方（紙・Excel・使用中のサービス）を見せていただければ、残すもの・置き換えるものを仕分けしてお返しします。</p>
<a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent(`${ind.name}の${g.name}の相談`)}">無料で相談する</a>
<a class="btn" href="${KURAGE}/vibe-oss.html?ref=solution-${attr(ind.slug)}-${attr(g.slug)}">OSSカスタマイズ（110,000円〜）</a>
<a class="btn" href="${KURAGE}/vibe-prototype.html?ref=solution-${attr(ind.slug)}-${attr(g.slug)}">動くデモを先に見る</a>
</div>
<section><div class="panel"><h2>よくあるご質問</h2>
${faqs.map((f) => `<div class="card" style="margin:0 0 10px"><h3>${h(f.q)}</h3><p>${h(f.a)}</p></div>`).join('')}
</div></section>
<section><div class="panel"><h2>${h(ind.name)}の他の業務</h2>
<div class="cat-grid">${others.map((x) => `<a class="cat-card" href="${BASE}/${attr(ind.slug)}/${attr(x.slug)}.html"><b>${h(x.name)}</b><span>${h(x.pain)}</span></a>`).join('')}</div>
<p class="note">他の業種で${h(g.name)}を見る: ${otherInds.map((x) => `<a href="${BASE}/${attr(x.slug)}/${attr(g.slug)}.html">${h(x.name)}</a>`).join('　')}</p>
</div></section>
<section><div class="panel"><p class="note">記載のサービス名・製品名は各社の商標または登録商標です。本ページは当社が独自にまとめた情報であり、各提供元が監修するものではありません。</p></div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'Service', name: `${ind.name}向け${g.name}システムの導入`, description: desc, url,
      serviceType: `${g.name}システム導入・OSSカスタマイズ`, areaServed: [{ '@type': 'City', name: '名古屋市' }, { '@type': 'Country', name: '日本' }],
      provider: { '@id': `${SITE}/#organization` },
      offers: { '@type': 'Offer', priceCurrency: 'JPY', price: '110000', url: `${KURAGE}/vibe-oss.html` } },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'ja', dateModified: TODAY,
      isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` }, publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: '業種・業務別ソリューション', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: ind.name, item: `${BASE}/${ind.slug}/` },
      { '@type': 'ListItem', position: 4, name: g.name, item: url }] },
  ]
  return shell(title, desc, url, body, ld, [ind.slug, g.slug], `${SITE}/images/ogp/sol-${ind.slug}.png`)
}

function industryHub(ind: MI): string {
  const url = `${BASE}/${ind.slug}/`
  const gy = matrix.gyomu.filter((g) => !ind.skip.includes(g.slug))
  const flat = pages.find((p) => p.slug === ind.slug)
  const title = fitLength(32, `${ind.name}のIT費用を安くする｜業務別の道具箱`, `${ind.name}のITを安くする｜業務別`)
  const desc = `${ind.context} ${ind.name}の${gy.slice(0, 5).map((g) => g.name).join('・')}などを、オープンソースと買い切りで安く持つ方法を業務別にまとめました。`
  const body = `<section class="hero"><div class="wrap">
<p class="kicker">業種別ソリューション｜${h(ind.kicker)}</p>
<h1>${h(ind.name)}のITを、<br>業務ごとに安くする。</h1>
<p class="lead">${h(ind.context)}</p>
<p><a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent(ind.name + 'のIT費用の相談')}">無料で相談する（Zoom可）</a></p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">業種・業務別</a> / ${h(ind.name)}</nav>
<section><div class="panel"><h2>${h(ind.name)}の業務から選ぶ</h2>
<div class="cat-grid">${gy.map((g) => `<a class="cat-card" href="${BASE}/${attr(ind.slug)}/${attr(g.slug)}.html"><b>${h(g.name)}</b><span>${h(g.pain)}</span></a>`).join('')}</div>
${flat ? `<p class="note" style="margin-top:10px"><a href="${BASE}/${attr(ind.slug)}.html">${h(ind.name)}の全体像（有名SaaSとの仕分け）はこちら</a></p>` : ''}
</div></section>
<section><div class="panel"><p class="note">記載のサービス名・製品名は各社の商標または登録商標です。</p></div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, description: desc, inLanguage: 'ja',
      dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: '業種・業務別ソリューション', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: ind.name, item: url }] },
  ]
  return shell(title, desc, url, body, ld, [ind.slug], `${SITE}/images/ogp/sol-${ind.slug}.png`)
}

await fs.rm(distRoot, { recursive: true, force: true })
await fs.mkdir(distRoot, { recursive: true })
for (const p of pages) {
  let html = detailPage(p)
  // 既存の業種ページに、マトリクス(業務別ページ)への導線を差し込む
  const ind = matrix.industries.find((i) => i.slug === p.slug)
  if (ind) {
    const gy = matrix.gyomu.filter((g) => !ind.skip.includes(g.slug))
    const block = `<section><div class="panel"><h2>${h(ind.name)}の業務別に見る</h2>
<div class="cat-grid">${gy.map((g) => `<a class="cat-card" href="${BASE}/${attr(ind.slug)}/${attr(g.slug)}.html"><b>${h(g.name)}</b><span>${h(g.pain)}</span></a>`).join('')}</div>
</div></section>\n</main>`
    html = html.replace('</main>', block)
  }
  await fs.writeFile(path.join(distRoot, `${p.slug}.html`), html)
}
let pairCount = 0
for (const ind of matrix.industries) {
  const dir = path.join(distRoot, ind.slug)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'index.html'), industryHub(ind))
  for (const g of matrix.gyomu) {
    if (ind.skip.includes(g.slug)) continue
    await fs.writeFile(path.join(dir, `${g.slug}.html`), pairPage(ind, g))
    pairCount++
  }
}
await fs.writeFile(path.join(distRoot, 'index.html'), indexPage())
const urls = [`${BASE}/`,
  ...pages.map((p) => `${BASE}/${p.slug}.html`),
  ...matrix.industries.map((i) => `${BASE}/${i.slug}/`),
  ...matrix.industries.flatMap((i) => matrix.gyomu.filter((g) => !i.skip.includes(g.slug)).map((g) => `${BASE}/${i.slug}/${g.slug}.html`))]
await fs.writeFile(path.join(distRoot, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${h(u)}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>${u.endsWith('/solution/') ? '0.9' : u.endsWith('/') ? '0.8' : '0.7'}</priority></url>`).join('\n') +
  `\n</urlset>\n`)
payload.logger.info(`solution: 既存${pages.length} + 業種ハブ${matrix.industries.length} + ペア${pairCount} + index/sitemap = ${urls.length}URL`)

// Payloadの接続が残りプロセスが終わらない(build-aisystemと同じ。2026-09-04に10分ハングを実測)。書き出し後に明示終了する。
process.exit(0)
