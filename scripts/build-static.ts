import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import { DEMOS, PROTO, demoPanel, demoUrl, DEMO_CSS } from './demos'

type TextItem = { text?: string | null }
type FAQ = { question?: string | null; answer?: string | null }
type Project = {
  name: string
  slug: string
  category: string
  summary: string
  description: string
  license: string
  licenseTier?: string | null
  licenseNote?: string | null
  japaneseStatus: string
  officialUrl: string
  githubUrl?: string | null
  lpUrl?: string | null
  brainUrl?: string | null
  brainLabel?: string | null
  demoUrl?: string | null
  featured?: boolean | null
  useCases?: TextItem[] | null
  keywords?: TextItem[] | null
  faqs?: FAQ[] | null
  sourceLpName?: string | null
  stars?: number | null
  language?: string | null
  priority?: number | null
  jaFileCount?: number | null
  jaSamplePaths?: TextItem[] | null
  githubCreatedAt?: string | null
  githubPushedAt?: string | null
  funnel?: string | null
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'oss')
const publicBase = 'https://kurage.exbridge.jp'
const catalogBase = `${publicBase}/oss`
const mascot = `${publicBase}/images/kurage-mascot-simple-v2.png`
const gaId = 'G-BP0650KDFR'

const categoryLabels: Record<string, string> = {
  crm: '顧客・営業管理', support: 'サポート', project: 'プロジェクト管理', inventory: '在庫管理',
  esign: '電子契約', cms: 'CMS・情報発信', monitoring: '監視・運用', groupware: 'グループウェア',
  media: '動画・音声・配信', finance: '投資・市場分析', marketing: 'マーケティング',
  mobile: 'モバイルアプリ', commerce: 'EC・販売', knowledge: 'ナレッジ・AI',
  office: 'オフィス', database: 'データベース', notes: 'メモ',
  lms: '学習管理・LMS', hr: '人事・勤怠', accounting: '会計・経理', forum: 'コミュニティ・掲示板',
  booking: '予約・受付', survey: 'アンケート・フォーム', pos: 'POS・店舗', dms: '文書管理',
  lowcode: 'ローコード開発', analytics: '分析・BI', aidev: 'AI開発基盤', devtools: '開発者ツール',
  sitegen: 'サイト構築・静的生成', automation: '自動化・連携', devsupport: '開発支援ツール',
}

const h = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const attr = h
const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c')
const textItems = (items?: TextItem[] | null) => (items || []).map((item) => item.text || '').filter(Boolean)
const faqs = (items?: FAQ[] | null) => (items || []).filter((item) => item.question && item.answer)
const categoryLabel = (value: string) => categoryLabels[value] || value

// 出口は2つある。業務アプリは「そのOSSを改造して納品する」(vibe-oss)、
// AI開発ツールは「それを使って作る」(vibe-prototype)。Ollama をカスタマイズ
// しませんかと誘う事故を避けるため、文面とCTAをここで一括して切り替える。
// Search Console の実アクセス。無ければ空で動く。
const trafficBySlug: Record<string, { clicks: number; impressions: number }> = await (async () => {
  try {
    const raw = await fs.readFile(path.join(root, 'data', 'traffic.json'), 'utf8')
    return (JSON.parse(raw) as { traffic?: Record<string, { clicks: number; impressions: number }> }).traffic || {}
  } catch {
    return {}
  }
})()

// 並び順の重み。自社のLP・Brain・デモを持つOSSを常に上に出す。
// アクセスが増えたものにLP/Brainを作れば、そのまま上位に上がる運用になる。
function priorityOf(project: Project): number {
  let score = Number(project.priority || 0)
  if (project.lpUrl) score += 1000
  if (project.brainUrl) score += 1000
  if (project.featured) score += 500
  if (project.demoUrl) score += 200
  if (project.sourceLpName) score += 200
  if (project.japaneseStatus === '日本語ファイルなし') score += 100
  score += Math.min(300, Math.round(Math.log10(Math.max(1, Number(project.stars || 0))) * 60))
  // 実際に検索で拾われているものを上げる。LP・Brainを作る候補がそのまま上に来る。
  const hit = trafficBySlug[project.slug]
  if (hit) score += Math.min(600, Math.round(Math.log10(Math.max(1, hit.impressions)) * 80) + hit.clicks * 5)
  return score
}
const byPriority = (a: Project, b: Project) => priorityOf(b) - priorityOf(a) || Number(b.stars || 0) - Number(a.stars || 0) || a.name.localeCompare(b.name)

const jstDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', timeZone: 'Asia/Tokyo' }).format(date)
}

type Funnel = 'oss' | 'prototype'
const funnelOf = (project: Project): Funnel => (project.funnel === 'prototype' ? 'prototype' : 'oss')

function jaVerdict(project: Project): string {
  const count = typeof project.jaFileCount === 'number' ? project.jaFileCount : null
  if (project.japaneseStatus === '日本語ファイルあり') {
    return `${project.name}のリポジトリには日本語ロケールのファイルが${count ?? 0}件あります。日本語で使える見込みがありますが、訳が全画面に行き渡っているか、用語が自社の言い回しに合うかは別途の確認が必要です。`
  }
  if (project.japaneseStatus === '日本語ファイルが一部のみ') {
    return `${project.name}のリポジトリにある日本語ロケールのファイルは${count ?? 0}件だけです。一部だけ日本語になっている状態か、他言語の設定に付随して入っている可能性が高く、実務で使うには日本語化が必要になります。`
  }
  if (project.japaneseStatus === '日本語ファイルなし') {
    return `${project.name}のリポジトリに日本語ロケールのファイルは見つかりませんでした。日本語で運用するには日本語化から着手する必要があります。`
  }
  return `${project.name}の日本語ロケールは未調査です。ファイル一覧が大きく取得しきれなかった場合にこの表示になります。`
}

function jaEvidence(project: Project): string {
  const paths = textItems(project.jaSamplePaths)
  if (!paths.length) return ''
  return `<p><strong>見つかったファイル（一部）</strong></p><ul class="paths">${paths.map((item) => `<li><code>${h(item)}</code></li>`).join('')}</ul>`
}

function funnelCopy(project: Project) {
  const name = project.name
  if (funnelOf(project) === 'prototype') {
    return {
      kind: 'prototype' as Funnel,
      ref: `proto-${project.slug}`,
      ctaUrl: `${publicBase}/vibe-prototype.html?ref=proto-${project.slug}`,
      hubUrl: `${publicBase}/vibe-prototype.html`,
      eyebrow: '開発に使うツール',
      guideTitle: `${name}を使ったシステム開発`,
      guideBody: `<strong>${name}は、そのまま納品する完成品ではなく、システムを作るための道具です。</strong>${name}を組み込んだ自社向けの仕組みを、AIエージェントと対話しながら実装します。要件を伺ってから最短1営業日で動くデモをお出しし、触って確認いただいてから発注を判断できます。完成後はソースコードごとお渡しします。`,
      guideCtaLabel: `${name}を使った開発を相談`,
      asideText: `公式情報を確認したうえで、${name}を使った自社向けシステムの開発を相談できます。動くデモを見てから判断できます。`,
      asideCtaLabel: 'このツールを使った開発を相談',
      faqHeading: `${name}を使った開発のよくある質問`,
      extraFaqs: [
        { question: `${name}を使って何が作れますか？`, answer: `${name}の標準機能を土台に、自社データとの連携、画面、自動処理、通知などを組み合わせた仕組みを作れます。用途を伺えば、実現できる範囲と進め方を具体的にお伝えします。` },
        { question: `${name}を使った開発を依頼できますか？`, answer: '可能です。要件と稼働環境を確認し、最短1営業日で動くデモをお出しします。発注後はサーバー設置と稼働確認まで一つの流れで対応し、ソースコードごとお渡しします。' },
      ],
      pageTitle: `${name}でできること・日本語ガイド | Kurage`,
      metaDescription: `${project.summary} ライセンスと日本語情報に加え、${name}を使ったバイブコーディングによる自社向けシステム開発を案内します。`,
      serviceName: `${name}を用いたバイブコーディング開発`,
      serviceType: `${name}を用いたシステム開発・デモ制作・サーバー導入`,
      cardLinkLabel: 'ツール詳細',
      catalogNote: `${name}を使った開発を相談できます。`,
    }
  }
  return {
    kind: 'oss' as Funnel,
    ref: `oss-${project.slug}`,
    ctaUrl: `${publicBase}/vibe-oss.html?ref=oss-${project.slug}#flow`,
    hubUrl: `${publicBase}/vibe-oss.html`,
    eyebrow: `${categoryLabel(project.category)} × VIBE CODING`,
    guideTitle: `${name}をバイブコーディングでカスタマイズ`,
    guideBody: `<strong>完成済みの${name}を土台に、AIエージェントと対話しながら、自社業務に必要な部分を変更できます。</strong>ライセンスと技術構成を確認し、日本語表現、ブランド、画面、項目、権限、通知、外部連携などから優先度の高い範囲を実装します。カスタマイズ後は対象サーバーへ導入し、実際に使える状態まで確認します。`,
    guideCtaLabel: `${name}のカスタマイズを相談`,
    asideText: '公式情報と日本向け解説を確認してから、バイブコーディングによる自社向けOSSカスタマイズとサーバー導入を相談できます。',
    asideCtaLabel: 'このOSSをバイブコーディングでカスタマイズ',
    faqHeading: `${name}導入・カスタマイズのよくある質問`,
    extraFaqs: [
      { question: `${name}をバイブコーディングでカスタマイズできますか？`, answer: `可能です。${name}のライセンスと技術構成を確認した上で、標準機能を活かしながら、日本語表現、画面、項目、権限、通知、外部連携などを業務に合わせて変更します。` },
      { question: `${name}の導入とカスタマイズをまとめて依頼できますか？`, answer: '可能です。要件と導入先を確認し、カスタマイズ、サーバー設置、稼働確認まで一つの流れで対応します。' },
    ],
    pageTitle: `${name}の日本語導入・OSSカスタマイズ | Kurage`,
    metaDescription: `${project.summary} 日本語対応・ライセンス・導入情報に加え、バイブコーディングによる自社向けOSSカスタマイズとサーバー導入を案内します。`,
    serviceName: `${name}のOSS導入・バイブコーディングカスタマイズ`,
    serviceType: 'OSS導入・日本語化・バイブコーディングによるカスタマイズ',
    cardLinkLabel: 'OSS詳細',
    catalogNote: '日本語導入とバイブコーディングによるOSSカスタマイズを相談できます。',
  }
}

function analytics(): string {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');</script>
<script>(function(){var s=document.createElement('script');s.src='${publicBase}/simpletrack.php?url='+encodeURIComponent(location.href)+'&ref='+encodeURIComponent(document.referrer);document.head.appendChild(s)})();</script>`
}

function styles(): string {
  return `<style>
:root{--ink:#12323b;--muted:#526a70;--sea:#087e79;--sea-dark:#075f5d;--aqua:#dff7f3;--line:#cfe5e3;--paper:#fffdf8;--warm:#fff3d8;--shadow:0 18px 45px rgba(16,72,75,.10)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:radial-gradient(circle at 8% 5%,#e2fbf6 0,transparent 30%),radial-gradient(circle at 92% 12%,#fff0cb 0,transparent 27%),var(--paper);font-family:"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.75;font-size:16px}a{color:var(--sea-dark);text-decoration-thickness:1px;text-underline-offset:3px}.wrap{width:min(1120px,calc(100% - 38px));margin:auto}.site-head{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(207,229,227,.9);background:rgba(255,253,248,.92);backdrop-filter:blur(14px)}.head-inner{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:14px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:900;letter-spacing:.02em}.brand img{width:42px;height:42px;object-fit:contain}.head-links{display:flex;gap:8px;align-items:center}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 16px;border-radius:12px;border:1px solid var(--line);font-weight:800;text-decoration:none;font-size:13px;background:#fff}.btn-main{color:#fff;background:var(--sea);border-color:var(--sea)}.btn-main:hover{background:var(--sea-dark)}.hero{padding:72px 0 45px;display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:36px;align-items:center}.eyebrow{display:inline-flex;border-radius:999px;background:var(--aqua);color:var(--sea-dark);padding:6px 12px;font-size:12px;font-weight:900;letter-spacing:.08em}h1,h2,h3{font-family:"Zen Maru Gothic","Zen Kaku Gothic New",sans-serif;line-height:1.35;margin-top:0}h1{font-size:clamp(30px,5vw,56px);letter-spacing:-.035em;margin:16px 0}.lead{font-size:18px;color:var(--muted);max-width:780px}.hero img{width:100%;filter:drop-shadow(0 18px 22px rgba(15,96,96,.12))}.stats{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.stat{border:1px solid var(--line);background:#fff;border-radius:13px;padding:9px 13px;font-size:13px}.stat b{font-size:19px;color:var(--sea-dark);margin-right:4px}.section{padding:38px 0}.section-title{display:flex;justify-content:space-between;gap:15px;align-items:end;margin-bottom:18px}.section-title h2{font-size:26px;margin:0}.section-title p{color:var(--muted);font-size:14px;margin:0}.tools{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;margin:0 0 22px}.search{width:100%;min-height:48px;border:1px solid var(--line);border-radius:14px;padding:10px 15px;background:#fff;font:inherit;color:var(--ink)}.search:focus{outline:3px solid rgba(8,126,121,.18);border-color:var(--sea)}.filters{display:flex;gap:7px;flex-wrap:wrap}.filter{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 12px;font-weight:800;color:var(--muted);cursor:pointer}.filter.active{background:var(--sea);color:#fff;border-color:var(--sea)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{display:flex;flex-direction:column;min-width:0;border:1px solid var(--line);border-radius:19px;background:rgba(255,255,255,.94);padding:20px;box-shadow:0 7px 22px rgba(16,72,75,.055)}.card[hidden]{display:none}.card:hover{box-shadow:var(--shadow);transform:translateY(-2px);transition:.2s}.card-top{display:flex;justify-content:space-between;gap:8px;align-items:start}.pill{display:inline-block;background:var(--aqua);color:var(--sea-dark);border-radius:999px;padding:4px 9px;font-size:10px;font-weight:900}.license{font-size:11px;color:var(--muted)}.card .kind{margin:9px 0 0;font-size:11px;font-weight:900;color:var(--sea-dark)}.card h3{font-size:19px;margin:7px 0 7px}.card p{font-size:14px;color:var(--muted);margin:0 0 16px}.card-actions{margin-top:auto;display:flex;gap:8px;flex-wrap:wrap}.card-actions a{font-size:12px;font-weight:900}.empty{display:none;border:1px dashed var(--line);padding:25px;border-radius:17px;color:var(--muted)}.crumb{font-size:13px;color:var(--muted);padding-top:28px}.detail-hero{padding:35px 0 28px}.detail-hero h1{font-size:clamp(30px,5vw,50px)}.detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:22px;align-items:start}.panel{background:#fff;border:1px solid var(--line);border-radius:20px;padding:25px;margin-bottom:18px}.panel h2{font-size:23px;margin-bottom:10px}.facts{display:grid;gap:12px}.fact{border-bottom:1px solid var(--line);padding-bottom:10px}.fact:last-child{border:0;padding-bottom:0}.fact b{display:block;font-size:11px;color:var(--muted);letter-spacing:.06em}.fact span{font-weight:800}.checklist{margin:0;padding-left:20px}.checklist li{margin:7px 0}.cta{background:linear-gradient(135deg,var(--aqua),var(--warm));border-color:#bddfd9}.cta .btn{margin:5px 5px 0 0}.vibe-guide{background:linear-gradient(135deg,#e8faf6,#fff8e5);border-color:#b9ded8}.vibe-guide h2{margin-bottom:10px}.vibe-guide p{color:var(--muted)}.vibe-guide strong{color:var(--ink)}.vibe-guide .btn{margin-top:10px}.related{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.table-wrap{overflow-x:auto}table.spec,table.compare{width:100%;border-collapse:collapse;font-size:14px}table.spec th,table.spec td,table.compare th,table.compare td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}table.spec th{width:34%;color:var(--muted);font-weight:800;font-size:12px}table.compare thead th{font-size:12px;color:var(--muted)}table.compare tr.self{background:var(--aqua)}table.compare td{white-space:nowrap}.paths{margin:6px 0 0;padding-left:18px;font-size:13px}.paths code{background:var(--aqua);padding:1px 5px;border-radius:5px;font-size:12px}.panel.measured .note{font-size:12px;color:var(--muted);margin-bottom:0}.cat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.cat-card{display:flex;flex-direction:column;gap:3px;border:1px solid var(--line);border-radius:15px;background:#fff;padding:15px 16px;text-decoration:none;color:var(--ink)}.cat-card:hover{box-shadow:var(--shadow)}.cat-card b{font-size:15px}.cat-card span{font-size:19px;font-weight:900;color:var(--sea-dark)}.cat-card em{font-style:normal;font-size:11px;color:var(--muted)}.faq details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:15px 18px;margin:9px 0}.faq summary{font-weight:900;cursor:pointer}.faq p{color:var(--muted)}footer{margin-top:42px;border-top:1px solid var(--line);padding:35px 0 50px;color:var(--muted);font-size:13px}.footer-links{display:flex;gap:14px;flex-wrap:wrap}.noscript{margin:20px 0;padding:14px;border:1px solid var(--line);background:#fff}
${DEMO_CSS}
@media(max-width:900px){.cat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{grid-template-columns:1fr 190px}.detail-grid{grid-template-columns:1fr}.related{grid-template-columns:1fr 1fr}.tools{grid-template-columns:1fr}}
@media(max-width:620px){.cat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{font-size:15px}.wrap{width:min(100% - 28px,1120px)}.hero{padding:38px 0 26px;grid-template-columns:1fr}.hero img{width:150px;margin:auto}.head-links .optional{display:none}.grid,.related{grid-template-columns:1fr}.section-title{display:block}.section-title p{margin-top:5px}.lead{font-size:16px}.panel{padding:19px}.filters{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px}.filter{white-space:nowrap}}
</style>`
}

function shell(title: string, description: string, canonical: string, body: string, structuredData: unknown[]): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h(title)}</title><meta name="description" content="${attr(description)}"><link rel="canonical" href="${attr(canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Zen+Maru+Gothic:wght@700;900&display=swap" rel="stylesheet">
<meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:site_name" content="Kurage Payload CMS"><meta property="og:title" content="${attr(title)}"><meta property="og:description" content="${attr(description)}"><meta property="og:url" content="${attr(canonical)}"><meta property="og:image" content="${mascot}"><meta name="twitter:card" content="summary_large_image">
${structuredData.map((item) => `<script type="application/ld+json">${json(item)}</script>`).join('\n')}
${styles()}${analytics()}</head><body>
<header class="site-head"><div class="wrap head-inner"><a class="brand" href="${catalogBase}/"><img src="${mascot}" alt="Kurageさん"><span>Kurage Payload CMS</span></a><nav class="head-links"><a class="btn optional" href="https://exbridge.jp/ai-development.html?ref=kurage-oss">AI開発・活用支援</a><a class="btn optional" href="https://exbridge.jp/nagoya-system-development.html?ref=kurage-oss">AI導入お試し</a><a class="btn optional" href="https://exbridge.jp/contact.php?ref=kurage-oss">相談する</a><a class="btn btn-main" href="${publicBase}/vibe-oss.html">OSSをバイブコーディングでカスタマイズ</a></nav></div></header>
${body}
<img src="${publicBase}/simpletrack.php?t=img&url=${encodeURIComponent(canonical)}" width="1" height="1" alt="" aria-hidden="true" style="position:absolute;left:-9999px">
<footer><div class="wrap"><div class="footer-links"><a href="${catalogBase}/">OSS一覧</a><a href="${publicBase}/vibe-oss.html">OSSのバイブコーディング・カスタマイズ</a><a href="https://exbridge.jp/ai-development.html?ref=kurage-oss">AI開発・活用支援</a><a href="https://exbridge.jp/nagoya-system-development.html?ref=kurage-oss">AI導入お試し</a><a href="https://exbridge.jp/ai-system/?ref=kurage-oss">AIでできること</a><a href="${PROTO}/?ref=kurage-oss">触れるデモ一覧</a><a href="https://exbridge.jp/">株式会社エクスブリッジ</a></div><p>Kurage Payload CMSは、業務OSSの選定、日本語導入、バイブコーディングによる自社向けカスタマイズを案内するカタログです。</p></div></footer>
</body></html>`
}

function card(project: Project): string {
  const kind = funnelOf(project)
  const kindLabel = kind === 'prototype' ? '開発に使う' : 'カスタマイズ可'
  const demo = DEMOS[project.slug]
  const search = [project.name, project.summary, categoryLabel(project.category), kindLabel, ...textItems(project.keywords), demo ? 'デモ 触れる demo' : ''].join(' ').toLowerCase()
  return `<article class="card" data-category="${attr(project.category)}" data-funnel="${attr(kind)}" data-search="${attr(search)}"><div class="card-top"><span class="pill">${h(categoryLabel(project.category))}</span><span class="license">${h(project.license)}</span></div><p class="kind">${h(kindLabel)}</p><h3><a href="${catalogBase}/${attr(project.slug)}/">${h(project.name)}</a></h3>${demo ? '<span class="demo-badge">触れるデモあり</span>' : ''}<p>${h(project.summary)}</p><div class="card-actions"><a href="${catalogBase}/${attr(project.slug)}/">詳細を見る</a>${demo ? `<a href="${demoUrl(project.slug, `oss-card-${project.slug}`)}" target="_blank" rel="noopener">デモを開く</a>` : ''}${project.lpUrl ? `<a href="${attr(project.lpUrl)}">製品・紹介ページ</a>` : ''}${project.brainUrl ? `<a data-brain-for="${attr(project.slug)}" href="${attr(project.brainUrl)}" target="_blank" rel="noopener">Brain手順書</a>` : ''}</div></article>`
}

function categoryHub(projects: Project[]): string {
  const groups = new Map<string, Project[]>()
  for (const project of projects) {
    const list = groups.get(project.category) || []
    list.push(project)
    groups.set(project.category, list)
  }
  const cards = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || categoryLabel(a[0]).localeCompare(categoryLabel(b[0]), 'ja'))
    .map(([category, list]) => {
      const ossCount = list.filter((item) => funnelOf(item) === 'oss').length
      const protoCount = list.length - ossCount
      const kinds = [ossCount ? `カスタマイズ可 ${ossCount}` : '', protoCount ? `開発に使う ${protoCount}` : ''].filter(Boolean).join(' / ')
      return `<a class="cat-card" href="${catalogBase}/c/${attr(category)}/"><b>${h(categoryLabel(category))}</b><span>${list.length}件</span><em>${h(kinds)}</em></a>`
    })
    .join('')
  return `<div class="cat-grid">${cards}</div>`
}

// 一覧は「カテゴリから入る」形にする。全件をHTMLに埋めると数千件で数MBになり実用外。
const TOP_ON_INDEX = 48

function indexPage(projects: Project[]): string {
  const categories = [...new Set(projects.map((item) => item.category))]
  const featured = projects.filter((item) => item.featured).length
  const ossCount = projects.filter((item) => funnelOf(item) === 'oss').length
  const protoCount = projects.filter((item) => funnelOf(item) === 'prototype').length
  const top = [...projects].sort(byPriority).slice(0, TOP_ON_INDEX)
  const indexFaqs = [
    { question: 'カスタマイズできるOSSと、開発に使うツールは何が違いますか？', answer: '業務アプリは完成済みのOSSを土台に改造して納品します。AI開発ツールなど道具にあたるものは改造して納品する対象ではなく、それを組み込んだ自社向けの仕組みを作ります。カタログでは前者を「カスタマイズ可」、後者を「開発に使う」と表示して分けています。' },
    { question: 'OSSをバイブコーディングでカスタマイズできますか？', answer: 'できます。既存OSSを土台に、AIエージェントと対話しながら日本語化、画面、項目、権限、通知、外部連携などを業務に合わせ、サーバーへ導入して稼働確認まで行います。' },
    { question: 'OSSのカスタマイズには設計書が必要ですか？', answer: 'ゼロからの設計書は不要です。対象OSSの標準機能を確認し、残す機能と変更する機能をデモと打ち合わせで決めます。' },
    { question: 'どのOSSを選べばよいですか？', answer: 'カテゴリから絞り込み、用途、ライセンス、日本語対応、GitHubのスター数を比較できます。候補決定後は、技術構成とライセンスを確認してカスタマイズ可否を案内します。' },
  ]
  const body = `<main><section class="wrap hero"><div><span class="eyebrow">OSS × VIBE CODING</span><h1>業務で使えるOSSを選び、<br>バイブコーディングで自社仕様へ。</h1><p class="lead">Kurage Payload CMSは、業務OSSとAI開発ツールを日本語で比較するカタログです。完成品を改造して納品するもの（カスタマイズ可）と、それを使って仕組みを作るもの（開発に使う）を分けて掲載しています。</p><div class="stats"><span class="stat"><b>${projects.length}</b>OSS</span><span class="stat"><b>${ossCount}</b>カスタマイズ可</span><span class="stat"><b>${protoCount}</b>開発に使う</span><span class="stat"><b>${categories.length}</b>カテゴリ</span></div></div><img src="${mascot}" alt="OSS選定とバイブコーディングによるカスタマイズを案内するKurageさん"></section>
<section class="wrap section" aria-labelledby="oss-vibe-answer"><div class="panel vibe-guide"><span class="eyebrow">DIRECT ANSWER</span><h2 id="oss-vibe-answer">OSSをバイブコーディングでカスタマイズするとは？</h2><p><strong>完成済みのオープンソースソフトウェアを土台に、AIエージェントと対話しながら、自社の業務に必要な変更を実装すること</strong>です。ゼロから作るより早く、標準機能を活かしたまま、日本語化、ブランド、画面、項目、権限、通知、外部連携を調整できます。Kurageでは対象OSSの確認から、カスタマイズ、サーバー導入、稼働確認まで対応します。</p><ul class="checklist"><li>日本語UI・用語・会社名・ロゴを自社向けに変更</li><li>業務項目・権限・承認フロー・通知・外部連携を調整</li><li>VPSやレンタルサーバーへ導入し、実際に使える状態を確認</li></ul><a class="btn btn-main" href="${publicBase}/vibe-oss.html">OSSのバイブコーディング・カスタマイズを見る</a></div></section>
<section class="wrap section" aria-labelledby="proto-vibe-answer"><div class="panel vibe-guide"><span class="eyebrow">DIRECT ANSWER</span><h2 id="proto-vibe-answer">AI開発ツールを使ったバイブコーディング開発とは？</h2><p><strong>改造して納品する対象ではないツールを土台に、それを組み込んだ自社向けの仕組みを作ることです。</strong>ローカルLLM、音声合成、エージェント基盤などは、そのまま渡す完成品ではなく道具にあたります。要件を伺ってから最短1営業日で動くデモをお出しし、触って確認いただいてから発注を判断できます。完成後はソースコードごとお渡しします。</p><ul class="checklist"><li>自社データや既存システムと接続した仕組みを実装</li><li>動くデモを先に確認してから発注を判断</li><li>サーバー導入・稼働確認までを一つの流れで対応</li></ul><a class="btn btn-main" href="${publicBase}/vibe-prototype.html">バイブコーディングによる開発を見る</a></div></section>
<section class="wrap section" id="categories"><div class="section-title"><div><h2>カテゴリから探す</h2><p>用途ごとに全件を掲載しています。</p></div></div>${categoryHub(projects)}</section>
<section class="wrap section" id="catalog"><div class="section-title"><div><h2>注目・人気のOSS</h2><p>スター数と注目度の上位${top.length}件です。全件は各カテゴリのページで確認できます。</p></div><a href="${publicBase}/vibe-oss.html">OSSカスタマイズを相談</a></div><div class="tools"><input class="search" id="search" type="search" placeholder="例: CRM、ヘルプデスク、日本語" aria-label="OSSを検索"><div class="filters" role="group" aria-label="種別"><button class="filter active" type="button" data-kind="all">種別すべて</button><button class="filter" type="button" data-kind="oss">カスタマイズ可</button><button class="filter" type="button" data-kind="prototype">開発に使う</button></div></div><div class="grid" id="oss-grid">${top.map(card).join('')}</div><p class="empty" id="empty">条件に一致するOSSはありません。カテゴリから探してください。</p><noscript><p class="noscript">JavaScriptが無効でも全OSSをカテゴリページから閲覧できます。</p></noscript></section>
<section class="wrap section faq" aria-labelledby="catalog-faq"><div class="panel"><h2 id="catalog-faq">OSSとバイブコーディングのよくある質問</h2>${indexFaqs.map((item) => `<details><summary>${h(item.question)}</summary><p>${h(item.answer)}</p></details>`).join('')}</div></section></main>
${filterScript()}`
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Kurage OSSカタログ',
    numberOfItems: projects.length,
    itemListElement: top.map((project, index) => ({ '@type': 'ListItem', position: index + 1, url: `${catalogBase}/${project.slug}/`, name: project.name })),
  }
  const service = { '@context': 'https://schema.org', '@type': 'Service', name: 'OSSのバイブコーディング・カスタマイズ', serviceType: 'OSS導入・日本語化・バイブコーディングによるカスタマイズ', url: `${publicBase}/vibe-oss.html`, provider: { '@type': 'Organization', name: '株式会社エクスブリッジ', url: 'https://exbridge.jp/' }, areaServed: 'JP' }
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: indexFaqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }
  return shell('OSSをバイブコーディングでカスタマイズ | Kurage Payload CMS', '業務OSSとAI開発ツールを日本語で比較。完成品を改造して納品するOSSと、それを使って作るツールを分けて掲載し、日本語化・機能変更・サーバー導入まで案内します。', `${catalogBase}/`, body, [ld, service, faqLd])
}

function filterScript(): string {
  return `<script>(()=>{const q=document.getElementById('search'),cards=[...document.querySelectorAll('.card')],kindButtons=[...document.querySelectorAll('.filter[data-kind]')],empty=document.getElementById('empty');if(!q)return;let kind='all';function apply(){const term=q.value.trim().toLowerCase();let shown=0;cards.forEach(card=>{const ok=(kind==='all'||card.dataset.funnel===kind)&&(!term||card.dataset.search.includes(term));card.hidden=!ok;if(ok)shown++});empty.style.display=shown?'none':'block'}q.addEventListener('input',apply);kindButtons.forEach(button=>button.addEventListener('click',()=>{kind=button.dataset.kind;kindButtons.forEach(item=>item.classList.toggle('active',item===button));apply()}))})();</script>`
}

function categoryPage(category: string, projects: Project[], all: Project[]): string {
  const label = categoryLabel(category)
  const pageUrl = `${catalogBase}/c/${category}/`
  const list = [...projects].sort(byPriority)
  const ossCount = list.filter((item) => funnelOf(item) === 'oss').length
  const protoCount = list.length - ossCount
  const faqItems = [
    { question: `${label}のOSSとは何ですか？`, answer: `${label}の業務をまかなう、ソースコードが公開されたソフトウェアです。ライセンスの範囲内で自社サーバーへ導入でき、月額のユーザー課金が発生しません。このページでは${list.length}件を掲載しています。` },
    { question: `${label}のOSSは日本語で使えますか？`, answer: '製品によって異なります。各OSSのページに、GitHub上に日本語ロケールのファイルが実在するかを実測した結果を掲載しています。日本語ファイルが無いものは、日本語化から対応できます。' },
    { question: `${label}のOSSを自社向けに変更できますか？`, answer: `${ossCount}件は完成品を土台に改造して納品できます。残りは道具にあたるため、それを組み込んだ仕組みを作る形になります。カード上の「カスタマイズ可」「開発に使う」で見分けられます。` },
  ]
  const body = `<main class="wrap"><nav class="crumb" aria-label="パンくず"><a href="${catalogBase}/">OSS一覧</a> / ${h(label)}</nav>
<section class="detail-hero"><span class="eyebrow">${h(label)} × VIBE CODING</span><h1>${h(label)}のOSS一覧</h1><p class="lead">${h(label)}に使えるオープンソースを${list.length}件掲載しています。ライセンス、日本語対応の実測結果、GitHubのスター数を比較して選べます。</p><div class="stats"><span class="stat"><b>${list.length}</b>件</span><span class="stat"><b>${ossCount}</b>カスタマイズ可</span><span class="stat"><b>${protoCount}</b>開発に使う</span></div></section>
<section class="section"><div class="tools"><input class="search" id="search" type="search" placeholder="${attr(label)}のOSSを検索" aria-label="${attr(label)}のOSSを検索"><div class="filters" role="group" aria-label="種別"><button class="filter active" type="button" data-kind="all">種別すべて</button><button class="filter" type="button" data-kind="oss">カスタマイズ可</button><button class="filter" type="button" data-kind="prototype">開発に使う</button></div></div><div class="grid" id="oss-grid">${list.map(card).join('')}</div><p class="empty" id="empty">条件に一致するOSSはありません。</p></section>
<section class="section faq"><div class="panel"><h2>${h(label)}のOSSについてよくある質問</h2>${faqItems.map((item) => `<details><summary>${h(item.question)}</summary><p>${h(item.answer)}</p></details>`).join('')}</div></section>
<section class="section"><div class="section-title"><h2>ほかのカテゴリ</h2></div>${categoryHub(all.filter((item) => item.category !== category))}</section></main>
${filterScript()}`
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: `${label}のOSS一覧`, numberOfItems: list.length, itemListElement: list.slice(0, 100).map((project, index) => ({ '@type': 'ListItem', position: index + 1, url: `${catalogBase}/${project.slug}/`, name: project.name })) }
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'OSS一覧', item: `${catalogBase}/` }, { '@type': 'ListItem', position: 2, name: label, item: pageUrl }] }
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }
  const service = { '@context': 'https://schema.org', '@type': 'Service', name: `${label}のOSS導入・バイブコーディングカスタマイズ`, serviceType: 'OSS導入・日本語化・バイブコーディングによるカスタマイズ', url: `${publicBase}/vibe-oss.html`, provider: { '@type': 'Organization', name: '株式会社エクスブリッジ', url: 'https://exbridge.jp/' }, areaServed: 'JP' }
  return shell(`${label}のOSS一覧 | Kurage`, `${label}に使えるオープンソースを${list.length}件掲載。ライセンス、日本語対応の実測、スター数で比較し、バイブコーディングによるカスタマイズと導入まで案内します。（全${all.length}件のカタログ）`, pageUrl, body, [ld, service, breadcrumb, faqLd])
}

function detailPage(project: Project, projects: Project[]): string {
  const pageUrl = `${catalogBase}/${project.slug}/`
  const related = projects.filter((item) => item.slug !== project.slug && item.category === project.category).sort(byPriority).slice(0, 4)
  const sameCategory = projects.filter((item) => item.category === project.category).sort((a, b) => Number(b.stars || 0) - Number(a.stars || 0))
  const rank = sameCategory.findIndex((item) => item.slug === project.slug) + 1
  const faqItems = faqs(project.faqs)
  const copy = funnelCopy(project)
  const customizationFaqs = copy.extraFaqs
  const allFaqItems = [...faqItems, ...customizationFaqs]
  const links = [
    `<a class="btn btn-main" href="${attr(project.officialUrl)}" target="_blank" rel="noopener">公式サイト</a>`,
    project.githubUrl ? `<a class="btn" href="${attr(project.githubUrl)}" target="_blank" rel="noopener">GitHub</a>` : '',
    project.lpUrl && project.lpUrl !== project.officialUrl ? `<a class="btn" href="${attr(project.lpUrl)}">製品・紹介ページ</a>` : '',
    project.brainUrl ? `<a class="btn" data-brain-for="${attr(project.slug)}" href="${attr(project.brainUrl)}" target="_blank" rel="noopener">${h(project.brainLabel || '構築手順書をBrainで読む')}</a>` : '',
    DEMOS[project.slug] ? `<a class="btn btn-main" href="${demoUrl(project.slug, `oss-${project.slug}-aside`)}" target="_blank" rel="noopener">日本語デモを触る</a>` : '',
    project.demoUrl ? `<a class="btn" href="${attr(project.demoUrl)}" target="_blank" rel="noopener">デモを確認</a>` : '',
  ].filter(Boolean).join('')
  const body = `<main class="wrap"><nav class="crumb" aria-label="パンくず"><a href="${catalogBase}/">OSS一覧</a> / <a href="${catalogBase}/c/${attr(project.category)}/">${h(categoryLabel(project.category))}</a> / ${h(project.name)}</nav><section class="detail-hero"><span class="eyebrow">${h(copy.eyebrow)}</span><h1>${h(project.name)}</h1><p class="lead">${h(project.summary)}</p></section><div class="detail-grid"><div><section class="panel"><h2>${h(project.name)}とは</h2><p>${h(project.description)}</p><p><strong>要点:</strong> ${h(project.summary)}</p></section><section class="panel"><h2>主な用途</h2><ul class="checklist">${textItems(project.useCases).map((item) => `<li>${h(item)}</li>`).join('')}</ul></section><section class="panel vibe-guide"><h2>${h(copy.guideTitle)}</h2><p>${copy.guideBody}</p><a class="btn btn-main" href="${attr(copy.ctaUrl)}">${h(copy.guideCtaLabel)}</a></section><section class="panel measured"><h2>${h(project.name)}の日本語対応（実測）</h2><p>${h(jaVerdict(project))}</p>${jaEvidence(project)}<p class="note">GitHubの公開ファイル一覧から、日本語ロケールに当たるファイルを数えた結果です。配布用にまとめたビルド成果物は除いています。調査日時点の内容で、翻訳の網羅率や品質までは示しません。</p></section>${demoPanel(project.slug, project.name, `oss-${project.slug}`)}
<section class="panel"><h2>${h(project.name)}の基本情報</h2><table class="spec"><tbody><tr><th>ライセンス</th><td>${h(project.license)}</td></tr>${project.language ? `<tr><th>主な言語</th><td>${h(project.language)}</td></tr>` : ''}${typeof project.stars === 'number' ? `<tr><th>GitHubスター</th><td>${project.stars.toLocaleString('en-US')}${rank ? `（${h(categoryLabel(project.category))}カテゴリ ${sameCategory.length}件中 ${rank}位）` : ''}</td></tr>` : ''}${jstDate(project.githubCreatedAt) ? `<tr><th>初回公開</th><td>${h(jstDate(project.githubCreatedAt))}</td></tr>` : ''}${jstDate(project.githubPushedAt) ? `<tr><th>最終更新</th><td>${h(jstDate(project.githubPushedAt))}</td></tr>` : ''}<tr><th>日本語ロケール</th><td>${h(project.japaneseStatus)}${typeof project.jaFileCount === 'number' ? `（${project.jaFileCount}ファイル）` : ''}</td></tr></tbody></table></section>
<section class="panel faq"><h2>${h(copy.faqHeading)}</h2>${allFaqItems.map((item) => `<details><summary>${h(item.question)}</summary><p>${h(item.answer)}</p></details>`).join('')}</section></div><aside><section class="panel facts"><h2>導入情報</h2><div class="fact"><b>ライセンス</b><span>${h(project.license)}</span></div>${project.licenseNote ? `<div class="fact"><b>利用条件</b><span>${h(project.licenseNote)}</span></div>` : ''}<div class="fact"><b>日本語対応</b><span>${h(project.japaneseStatus)}</span></div>${project.language ? `<div class="fact"><b>主な言語</b><span>${h(project.language)}</span></div>` : ''}${typeof project.stars === 'number' ? `<div class="fact"><b>GitHubスター</b><span>${project.stars.toLocaleString('en-US')}</span></div>` : ''}${project.sourceLpName ? `<div class="fact"><b>紹介ページ</b><span>${h(project.sourceLpName)}</span></div>` : ''}</section><section class="panel cta"><h2>次の行動</h2><p>${h(copy.asideText)}</p>${links}<a class="btn btn-main" href="${attr(copy.ctaUrl)}">${h(copy.asideCtaLabel)}</a></section></aside></div>${related.length ? `<section class="section"><div class="section-title"><div><h2>${h(categoryLabel(project.category))}の他のOSSと比べる</h2><p>同じカテゴリから、スター数・ライセンス・日本語対応を並べました。</p></div><a href="${catalogBase}/c/${attr(project.category)}/">${h(categoryLabel(project.category))}の一覧へ</a></div><div class="table-wrap"><table class="compare"><thead><tr><th>OSS</th><th>スター</th><th>ライセンス</th><th>日本語ロケール</th></tr></thead><tbody><tr class="self"><th><strong>${h(project.name)}</strong>（このページ）</th><td>${typeof project.stars === 'number' ? project.stars.toLocaleString('en-US') : '-'}</td><td>${h(project.license)}</td><td>${h(project.japaneseStatus)}</td></tr>${related.map((item) => `<tr><th><a href="${catalogBase}/${attr(item.slug)}/">${h(item.name)}</a></th><td>${typeof item.stars === 'number' ? item.stars.toLocaleString('en-US') : '-'}</td><td>${h(item.license)}</td><td>${h(item.japaneseStatus)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}</main>`
  const software = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: project.name, description: project.summary, applicationCategory: categoryLabel(project.category), operatingSystem: 'Self-hosted', license: project.license, url: pageUrl, sameAs: [project.officialUrl, project.githubUrl].filter(Boolean) }
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'OSS一覧', item: `${catalogBase}/` }, { '@type': 'ListItem', position: 2, name: categoryLabel(project.category), item: `${catalogBase}/c/${project.category}/` }, { '@type': 'ListItem', position: 3, name: project.name, item: pageUrl }] }
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: allFaqItems.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }
  const service = { '@context': 'https://schema.org', '@type': 'Service', name: copy.serviceName, serviceType: copy.serviceType, url: copy.ctaUrl, provider: { '@type': 'Organization', name: '株式会社エクスブリッジ', url: 'https://exbridge.jp/' }, areaServed: 'JP', isRelatedTo: { '@type': 'SoftwareApplication', name: project.name, url: pageUrl } }
  return shell(copy.pageTitle, copy.metaDescription, pageUrl, body, [software, service, breadcrumb, faqLd])
}

function vibeSnippet(projects: Project[]): string {
  const cards = projects.map((project) => `<article class="example"><span class="oss-type">${h(categoryLabel(project.category))}</span><h3>${h(project.name)}</h3><p>${h(project.summary)}</p><div class="oss-links"><a href="oss/${attr(project.slug)}/">${h(funnelCopy(project).cardLinkLabel)}</a>${project.lpUrl ? `<a href="${attr(project.lpUrl)}">製品・紹介ページ</a>` : ''}${project.brainUrl ? `<a href="${attr(project.brainUrl)}" target="_blank" rel="noopener">Brain手順書</a>` : ''}</div></article>`).join('\n      ')
  return `<section class="block" id="oss-catalog">
    <h2>バイブコーディングでカスタマイズできるOSS</h2>
    <p class="sub">Kurage Payload CMSで、業務OSSを一元管理しています。OSSごとの日本語対応、ライセンス、公式情報、紹介記事、公開済みのBrain構築手順書を比較し、選定後はバイブコーディングによる日本語化・機能変更・サーバー導入を相談できます。</p>
    <div class="catalog-lead"><strong>${projects.length}件のOSSを掲載</strong><a class="btn btn-main" href="oss/">検索・カテゴリ比較ができるOSS一覧へ</a></div>
    <div class="examples">
      ${cards}
    </div>
  </section>`
}

const payload = await getPayload({ config })
// limit を省くと既定(10)、200のままだと201件目以降が出力されない。
// カタログは数千件になるので 0 = 無制限で取る。
const result = await payload.find({ collection: 'oss-projects', limit: 0, pagination: false, sort: 'name', depth: 0 })
const projects = result.docs as unknown as Project[]

if (!projects.length) throw new Error('No OSS records found. Run npm run seed first.')
await fs.rm(path.join(root, 'dist'), { recursive: true, force: true })
await fs.mkdir(distRoot, { recursive: true })
await fs.writeFile(path.join(distRoot, 'index.html'), indexPage(projects))

for (const project of projects) {
  const target = path.join(distRoot, project.slug)
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(path.join(target, 'index.html'), detailPage(project, projects))
}

// カテゴリページ。全件をトップに並べると数MBになるので、実体はここに置く。
const categoryList = [...new Set(projects.map((item) => item.category))].sort()
for (const category of categoryList) {
  const target = path.join(distRoot, 'c', category)
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(path.join(target, 'index.html'), categoryPage(category, projects.filter((item) => item.category === category), projects))
}

const publicCatalog = projects.map((project) => ({ ...(({ name, slug, category, summary, license, japaneseStatus, officialUrl, githubUrl, lpUrl, brainUrl, brainLabel, demoUrl, featured }) => ({ name, slug, category, categoryLabel: categoryLabel(category), summary, license, japaneseStatus, officialUrl, githubUrl: githubUrl || null, lpUrl: lpUrl || null, brainUrl: brainUrl || null, brainLabel: brainLabel || null, demoUrl: demoUrl || null, featured: Boolean(featured) }))(project), funnel: funnelOf(project), stars: project.stars ?? null, language: project.language ?? null, priority: priorityOf(project) }))
await fs.writeFile(path.join(distRoot, 'catalog.json'), JSON.stringify(publicCatalog, null, 2))
const urls = [`${catalogBase}/`, ...categoryList.map((category) => `${catalogBase}/c/${category}/`), ...projects.map((project) => `${catalogBase}/${project.slug}/`)]
await fs.writeFile(path.join(distRoot, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${h(url)}</loc><changefreq>weekly</changefreq><priority>${url === `${catalogBase}/` ? '0.9' : url.includes('/c/') ? '0.8' : '0.7'}</priority></url>`).join('\n')}\n</urlset>\n`)
await fs.writeFile(path.join(distRoot, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Kurage OSS Catalog</title><link>${catalogBase}/</link><description>業務OSSの日本語導入とバイブコーディングによるカスタマイズを案内するカタログ</description>${projects.map((project) => `<item><title>${h(project.name)}</title><link>${catalogBase}/${h(project.slug)}/</link><guid>${catalogBase}/${h(project.slug)}/</guid><description>${h(project.summary)} バイブコーディングによる自社向けカスタマイズとサーバー導入に対応。</description></item>`).join('')}</channel></rss>\n`)
await fs.writeFile(path.join(distRoot, 'llms.txt'), `# Kurage Payload CMS - OSS Catalog\n\n> 業務OSSを日本語で比較し、バイブコーディングで自社向けにカスタマイズするためのカタログ。\n\n## OSS customization service\n\n- Service: OSSの日本語化、画面・項目・権限・通知・外部連携の変更、サーバー導入、稼働確認\n- Method: 完成済みOSSを土台に、AIエージェントとの対話によるバイブコーディングで変更\n- URL: ${publicBase}/vibe-oss.html\n\n## Prototype development service\n\n- Service: AI開発ツールを組み込んだ自社向けシステムの開発、デモ制作、サーバー導入、ソースコード納品\n- Method: 対象ツールを土台に、AIエージェントとの対話によるバイブコーディングで実装\n- URL: ${publicBase}/vibe-prototype.html\n\n## Categories\n\n${categoryList.map((category) => `- [${categoryLabel(category)}](${catalogBase}/c/${category}/): ${projects.filter((item) => item.category === category).length}件`).join('\n')}\n\n## Catalog\n\n${projects.map((project) => `- [${project.name}](${catalogBase}/${project.slug}/): ${project.summary} ${funnelCopy(project).catalogNote}`).join('\n')}\n`)
await fs.writeFile(path.join(root, 'dist', 'vibe-oss-catalog.html'), vibeSnippet(projects))

payload.logger.info(`Exported ${projects.length} OSS pages and ${categoryList.length} category pages to ${distRoot}`)
process.exit(0)
