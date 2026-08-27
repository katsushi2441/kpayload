/**
 * /zenn/ — 「OSS × テーマ」のキーワードで来た人に、Zennの該当記事と当社の実務情報を渡す入口。
 *
 * 1つのZenn記事につき1ページ。URLは <oss>-<theme>.html（例: payload-cms-customize.html）で、
 * 「payload カスタマイズ」のような検索語に対して1ページが正面から当たるようにする。
 *
 * なぜ作るか（2026-08-28）:
 *   OSS名だけの検索は競合が多いが、「OSS名 + やりたいこと」の複合語は当社が取れる。
 *   その検索で来た人が最初に読みたいのはZennの実践記事なので、それを紹介した上で、
 *   当社の /oss/（カタログ）・/ai-system/（できること）・/saas/（置き換え表）・
 *   /solution/（業種別）・Kurageの解説動画・受託と買い切りへ橋を架ける。
 *
 * データ: data/zenn-list.json（zenn-collect.py が集め、zenn-enrich.py が codex で言葉を付ける）
 * 出力:   dist/zenn/<slug>.html + index.html + sitemap.xml
 *
 * 方針:
 *   - Zenn記事は「紹介」であって転載しない。タイトル・著者・リンクと、当社が書いた短い紹介文だけ。
 *   - 記事に書かれていないことを足さない（enrich 側のプロンプトで縛る）。
 *   - 当社側リンクは実在確認できるものだけ出す（推測でURLを作らない）。
 */
import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import { SITE, KURAGE } from './site'
import { TODAY, h, attr, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'zenn')
const BASE = `${SITE}/zenn`

const SHELL = {
  refPrefix: 'exbridge-zenn',
  base: BASE,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${SITE}/contact.php">無料相談</a>　<a href="${BASE}/">OSSの実践記事から探す</a>　<a href="${KURAGE}/oss/?ref=exbridge-zenn">業務OSSカタログ</a>　<a href="${SITE}/saas/">SaaSとOSSの対応表</a>　<a href="${SITE}/solution/">業種・業務別ソリューション</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[]) => baseShell(t, d, u, b, l, SHELL)

type ZennPage = {
  slug: string            // <oss>-<theme>
  ossSlug: string         // カタログ側のslug
  ossName: string
  theme: string           // 英数のテーマ（customize / self-host など）
  keyword: string         // 日本語の検索キーワード（例: Payload CMS カスタマイズ）
  pageTitle: string       // <title> と h1 に使う
  lead: string            // このページのリード（codex）
  article: {
    title: string; path: string; emoji?: string | null
    published_at?: string | null; liked?: number
    user?: string | null; name?: string | null
    summary: string       // 記事の紹介文（codex）
    points?: string[]     // 記事に書かれている項目（codex）
  }
  githubUrl?: string
  inCatalog?: boolean
  ossSummary?: string
  category?: string
  related?: string[]      // 同じOSSの他ページ slug
  videos?: Array<{ id: string; title: string }>
  lpUrl?: string | null; buyUrl?: string | null
  brainUrl?: string | null; brainLabel?: string | null
}

const pages = JSON.parse(await fs.readFile(path.join(root, 'data', 'zenn-list.json'), 'utf8')) as ZennPage[]
const byOss = new Map<string, ZennPage[]>()
for (const p of pages) byOss.set(p.ossSlug, [...(byOss.get(p.ossSlug) || []), p])

const payload = await getPayload({ config })
const { docs: allProjects } = await payload.find({ collection: 'oss-projects', limit: 5000, depth: 0 })
const projBySlug = new Map(allProjects.map((p: any) => [p.slug, p]))

// /saas/ と /solution/ は「そのOSSを推薦しているページ」を逆引きする（推測でリンクしない）
type Def = { slug: string; name: string; ossPicks?: string[] }
const saasList = JSON.parse(await fs.readFile(path.join(root, 'data', 'saas-list.json'), 'utf8')) as Def[]
const solList = JSON.parse(await fs.readFile(path.join(root, 'data', 'solution-list.json'), 'utf8')) as Def[]
const saasByOss = new Map<string, Def[]>()
for (const x of saasList) for (const o of x.ossPicks || []) saasByOss.set(o, [...(saasByOss.get(o) || []), x])
const solByOss = new Map<string, Def[]>()
for (const x of solList) for (const o of x.ossPicks || []) solByOss.set(o, [...(solByOss.get(o) || []), x])

const dateJa = (iso?: string | null) => {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}年${m[2]}月${m[3]}日` : ''
}

const card = (href: string, meta: string, title: string, note: string) => `
<a class="lcard" href="${attr(href)}"${href.startsWith('http') && !href.startsWith(SITE) ? ' target="_blank" rel="noopener"' : ''}>
  <div class="lc-m">${h(meta)}</div>
  <div class="lc-t">${h(title)}</div>
  <div class="lc-d">${h(note)}</div>
</a>`

function pageHtml(p: ZennPage): string {
  const a = p.article
  const zennUrl = a.path.startsWith('http') ? a.path : `https://zenn.dev${a.path}`
  const title = p.pageTitle
  const desc = `${p.keyword}について、Zennに公開されている実践記事「${a.title}」を紹介します。あわせて${p.ossName}の導入情報・SaaSからの置き換え可否・構築代行の入口もまとめました。`
  const url = `${BASE}/${p.slug}.html`

  const proj: any = projBySlug.get(p.ossSlug)
  const ours: string[] = []
  if (proj) {
    ours.push(card(`${KURAGE}/oss/${p.ossSlug}/?ref=exbridge-zenn`, 'OSSカタログ', `${p.ossName} の基本情報`,
      'ライセンス・日本語対応の実測・想定用途・導入の勘所をまとめています。'))
    ours.push(card(`${SITE}/ai-system/${p.ossSlug}/?ref=exbridge-zenn`, 'AIでできること', `${p.ossName} で解決できる業務`,
      '道具の説明ではなく、業務課題の側から引ける解説です。'))
  }
  for (const x of saasByOss.get(p.ossSlug) || []) {
    ours.push(card(`${SITE}/saas/${x.slug}.html?ref=exbridge-zenn`, 'SaaS→OSS', `${x.name} を置き換えられるか`,
      `${x.name}の月額を${p.ossName}などでどこまで代替できるかを正直に仕分けます。`))
  }
  for (const x of solByOss.get(p.ossSlug) || []) {
    ours.push(card(`${SITE}/solution/${x.slug}.html?ref=exbridge-zenn`, '業種・業務別', `${x.name}のITソリューション`,
      'その業種で使われているSaaSと、固定費を減らす道筋。'))
  }
  if (p.githubUrl) ours.push(card(p.githubUrl, 'GitHub', `${p.ossName} のソースコード`, 'ライセンスと更新状況は元リポジトリで確認できます。'))
  if (p.lpUrl) ours.push(card(`${p.lpUrl}${p.lpUrl.includes('?') ? '&' : '?'}ref=exbridge-zenn`, '解説ページ', `${p.ossName} の導入解説`, '選択肢と費用の考え方をまとめています。'))
  if (p.buyUrl) ours.push(card(p.buyUrl, 'Kurage App Store', `${p.ossName} 日本語導入キット`, '実測手順書とAI用の構築指示書つき。買い切りです。'))
  if (p.brainUrl) ours.push(card(p.brainUrl, 'Brain', p.brainLabel || `${p.ossName} 導入手順書`, '同じ手順書をBrainの記事としても読めます。'))

  const rel = (p.related || []).map((s) => pages.find((x) => x.slug === s)).filter(Boolean) as ZennPage[]
  const vids = (p.videos || []).map((v) => `
<a class="vcard" href="${KURAGE}/kuragev.php?id=${attr(v.id)}" target="_blank" rel="noopener">
  <div class="vt"><img src="${KURAGE}/kuragev.php?proxy=thumbnail&job_id=${attr(v.id)}" alt="" loading="lazy"><span class="vp"></span></div>
  <div class="vl">${h(v.title)}</div>
</a>`).join('')

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${url}#page`,
      url, name: title, description: desc, inLanguage: 'ja',
      about: { '@type': 'SoftwareApplication', name: p.ossName, applicationCategory: 'BusinessApplication' },
      isPartOf: { '@type': 'WebSite', url: `${SITE}/`, name: '株式会社エクスブリッジ' },
      mainEntity: {
        '@type': 'Article', headline: a.title, url: zennUrl,
        author: { '@type': 'Person', name: a.name || a.user || 'Zenn' },
        datePublished: a.published_at || undefined,
        publisher: { '@type': 'Organization', name: 'Zenn', url: 'https://zenn.dev/' },
      },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'OSSの実践記事から探す', item: `${BASE}/` },
        { '@type': 'ListItem', position: 3, name: p.keyword, item: url },
      ],
    },
  ]

  const body = `
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ <a href="${BASE}/">OSSの実践記事から探す</a> ／ ${h(p.keyword)}</nav>
<h1>${h(title)}</h1>
<p class="lead">${h(p.lead)}</p>

<section class="zbox">
  <div class="zhead">
    <span class="ze">${h(a.emoji || '📄')}</span>
    <div>
      <div class="zsrc">Zennの記事</div>
      <h2><a href="${attr(zennUrl)}" target="_blank" rel="noopener">${h(a.title)}</a></h2>
      <div class="zm">${h([a.name || a.user, dateJa(a.published_at), a.liked ? `♥${a.liked}` : ''].filter(Boolean).join('　'))}</div>
    </div>
  </div>
  <p class="zsum">${h(a.summary)}</p>
  ${a.points && a.points.length ? `<ul class="zpts">${a.points.map((x) => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
  <p class="zgo"><a class="btn" href="${attr(zennUrl)}" target="_blank" rel="noopener">Zennで記事を読む →</a></p>
  <p class="note">記事は著者の方がZennに公開されているものです。当社は内容を転載していません。上のリンクから元記事が開きます。</p>
</section>

${p.ossSummary ? `<section><h2>${h(p.ossName)} とは</h2><p class="sum">${h(p.ossSummary)}</p></section>` : ''}

${ours.length ? `<section>
  <h2>${h(p.ossName)} を実務で使うための情報</h2>
  <div class="lgrid">${ours.join('')}</div>
</section>` : ''}

${vids ? `<section><h2>動画で見る</h2><div class="vrail">${vids}</div></section>` : ''}

${rel.length ? `<section>
  <h2>${h(p.ossName)} の他のテーマ</h2>
  <ul class="rel">${rel.map((r) => `<li><a href="${BASE}/${attr(r.slug)}.html">${h(r.keyword)}</a></li>`).join('')}</ul>
</section>` : ''}

<section class="cta">
  <h2>読んだうえで、自分でやるか任せるか</h2>
  <p>OSSは「入れる」より「日本語で運用に乗せる」ほうが手間です。記事のとおりに進めて詰まったら、そこから先は任せてください。</p>
  <div class="ctarow">
    <a class="btn" href="${KURAGE}/vibe-oss.html?ref=exbridge-zenn">OSS導入・カスタマイズを頼む（税込110,000円〜）</a>
    <a class="btn" href="${KURAGE}/vibe-prototype.html?ref=exbridge-zenn">動くプロトタイプを1営業日で（税込110,000円〜）</a>
    <a class="btn sub" href="https://kappstore.exbridge.jp/?ref=exbridge-zenn">買い切りの業務システムを見る</a>
    <a class="btn sub" href="${KURAGE}/chat.php?ref=exbridge-zenn">AIに相談する（無料）</a>
    <a class="btn sub" href="${SITE}/contact.php?ref=exbridge-zenn">人に相談する（無料・Zoom可）</a>
  </div>
</section>
</main>`
  return shell(title, desc, url, body + zennStyles(), ld)
}

const zennStyles = () => `<style>
.crumb{font-size:12.5px;color:#5f7078;margin:14px 0 6px}
h1{font-size:26px;line-height:1.5;margin:6px 0 10px}
.lead{color:#425560;font-size:15px;margin:0 0 16px;line-height:1.9}
section{margin:24px 0}
section h2{font-size:18.5px;padding-left:11px;border-left:4px solid #0a9a8f;margin:0 0 10px}
.sum{background:#f3faf9;border:1px solid #dcebe9;border-radius:10px;padding:12px 14px;font-size:14px;margin:0}
.zbox{background:#fff;border:1px solid #dcebe9;border-radius:14px;padding:18px 18px 16px}
.zhead{display:flex;gap:13px;align-items:flex-start;margin-bottom:10px}
.ze{font-size:30px;line-height:1.1;flex:none}
.zsrc{font-size:11px;font-weight:800;color:#0a9a8f;letter-spacing:.05em;margin-bottom:2px}
.zbox h2{font-size:17.5px;border:none;padding:0;margin:0 0 4px;line-height:1.55}
.zbox h2 a{color:#1d3038;text-decoration:none}
.zbox h2 a:hover{color:#0a726b}
.zm{font-size:12px;color:#5f7078}
.zsum{font-size:14px;color:#425560;line-height:1.9;margin:0 0 10px}
.zpts{margin:0 0 12px;padding-left:20px;font-size:13.5px;color:#425560;line-height:1.85}
.zgo{margin:0 0 8px}
.note{font-size:12px;color:#5f7078;margin:0}
.lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:11px}
.lcard{display:block;background:#fff;border:1px solid #dcebe9;border-radius:12px;padding:13px 15px;text-decoration:none;transition:.15s}
.lcard:hover{border-color:#0a9a8f;transform:translateY(-2px)}
.lc-m{font-size:11px;font-weight:800;color:#0a9a8f;letter-spacing:.03em;margin-bottom:3px}
.lc-t{font-weight:800;font-size:14.5px;color:#1d3038;margin-bottom:4px}
.lc-d{font-size:12.5px;color:#5f7078;line-height:1.65}
.vrail{display:flex;gap:12px;overflow-x:auto;padding-bottom:10px}
.vcard{flex:0 0 232px;background:#fff;border:1px solid #dcebe9;border-radius:12px;overflow:hidden;text-decoration:none}
.vcard:hover{border-color:#0a9a8f}
.vt{position:relative;aspect-ratio:16/9;background:#dfeeeb}
.vt img{width:100%;height:100%;object-fit:cover;display:block}
.vp{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 3px 10px rgba(0,0,0,.2)}
.vp::after{content:"";position:absolute;left:16px;top:11px;border-left:12px solid #0a726b;border-top:8px solid transparent;border-bottom:8px solid transparent}
.vl{padding:9px 11px 12px;font-size:13px;font-weight:700;color:#1d3038;line-height:1.5}
.rel{margin:0;padding-left:20px;font-size:14px;line-height:2}
.cta{background:#f3faf9;border:1px solid #dcebe9;border-radius:14px;padding:18px}
.ctarow{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}
.btn{display:inline-block;background:#0a9a8f;color:#fff;font-weight:800;font-size:13.5px;padding:10px 17px;border-radius:99px;text-decoration:none}
.btn.sub{background:#fff;color:#0a726b;border:1px solid #0a9a8f}
.btn:hover{filter:brightness(1.07)}
.idx{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:11px}
@media(max-width:640px){h1{font-size:21px}}
</style>`

function indexHtml(list: ZennPage[]): string {
  const title = 'OSSの実践記事から探す｜Zennの解説と、導入・置き換えの実務'
  const desc = `オープンソースの「やりたいこと」別に、Zennの実践記事と当社の導入情報をまとめています。現在${list.length}ページ。`
  const url = `${BASE}/`
  const groups = new Map<string, ZennPage[]>()
  for (const p of list) groups.set(p.ossName, [...(groups.get(p.ossName) || []), p])

  const sections = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([oss, ps]) => `
<section>
  <h2>${h(oss)}</h2>
  <div class="idx">
    ${ps.map((p) => card(`${BASE}/${p.slug}.html`, p.keyword, p.article.title, p.article.summary.slice(0, 70))).join('')}
  </div>
</section>`).join('')

  const ld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${url}#page`,
    url, name: title, description: desc, inLanguage: 'ja',
    hasPart: list.slice(0, 100).map((p) => ({ '@type': 'WebPage', name: p.keyword, url: `${BASE}/${p.slug}.html` })),
  }]

  const body = `
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ OSSの実践記事から探す</nav>
<h1>OSSの実践記事から探す</h1>
<p class="lead">「このOSSで、これをやりたい」に対して、Zennに公開されている実践記事と、当社が実測した導入情報を並べています。現在 <strong>${list.length}ページ</strong>。</p>
${sections}
<section class="cta">
  <h2>読んで難しいと感じたら</h2>
  <div class="ctarow">
    <a class="btn" href="${KURAGE}/vibe-oss.html?ref=exbridge-zenn">OSS導入・カスタマイズを頼む</a>
    <a class="btn sub" href="${KURAGE}/oss/?ref=exbridge-zenn">OSSカタログ（約2,800件）</a>
    <a class="btn sub" href="${SITE}/contact.php?ref=exbridge-zenn">無料相談（Zoom可）</a>
  </div>
</section>
</main>`
  return shell(title, desc, url, body + zennStyles(), ld)
}

await fs.mkdir(distRoot, { recursive: true })
for (const p of pages) {
  await fs.writeFile(path.join(distRoot, `${p.slug}.html`), pageHtml(p), 'utf8')
}
await fs.writeFile(path.join(distRoot, 'index.html'), indexHtml(pages), 'utf8')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${BASE}/</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
${pages.map((p) => `<url><loc>${BASE}/${p.slug}.html</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`).join('\n')}
</urlset>`
await fs.writeFile(path.join(distRoot, 'sitemap.xml'), sitemap, 'utf8')

console.log(`zenn: ${pages.length}ページ + index/sitemap`)
process.exit(0)
