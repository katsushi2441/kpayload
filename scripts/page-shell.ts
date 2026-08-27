/**
 * 3つの入口（/ai-system/・/oss/・/saas/）で共通のページ枠。
 *
 * なぜ切り出すか（2026-08-24）:
 *   相談ボタンを各所にコピーしていたら、片方だけ直してズレる事故が起きた。
 *   入口が3つになるので、会社情報・計測タグ・相談ボタン・枠は1か所に置く。
 *
 * サイト固有の値（footerの並び、計測用のref接頭辞）は呼び出し側から渡す。
 */
import { SITE, KURAGE, TRIAL, GA } from './site'
import { DEMO_CSS } from './demos'

type TextItem = { text?: string | null }
export type Project = {
  name: string; slug: string; category: string; summary: string; description: string
  license: string; licenseTier?: string | null; licenseNote?: string | null
  japaneseStatus: string; officialUrl: string; githubUrl?: string | null
  stars?: number | null; language?: string | null; funnel?: string | null
  jaFileCount?: number | null
  useCases?: TextItem[] | null; keywords?: TextItem[] | null
}

/**
 * 会社の実体情報。exbridge.jp/index.html の Organization と同じ内容を使う
 * （所在地・法人番号・sameAs を発明しない）。
 * AI検索側は発信元が誰かを確認できないページを引用しにくいので、全ページに入れる。
 */
export const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: '株式会社エクスブリッジ',
  alternateName: 'EXBRIDGE, Inc.',
  url: `${SITE}/`,
  logo: { '@type': 'ImageObject', url: `${SITE}/images/logo.svg` },
  foundingDate: '2004-04-01',
  identifier: { '@type': 'PropertyValue', propertyID: '法人番号', value: '4180001056508' },
  address: { '@type': 'PostalAddress', postalCode: '467-0853', addressRegion: '愛知県',
    addressLocality: '名古屋市瑞穂区', streetAddress: '内浜町34-9 305', addressCountry: 'JP' },
  areaServed: [{ '@type': 'AdministrativeArea', name: '愛知県' }, { '@type': 'Country', name: '日本' }],
  contactPoint: { '@type': 'ContactPoint', contactType: 'business inquiries',
    url: `${SITE}/contact.php`, availableLanguage: 'Japanese' },
  sameAs: ['https://x.com/xb_bittensor', 'https://github.com/katsushi2441'],
}
export const orgLd = () => ({ '@context': 'https://schema.org', ...ORG })
// 日付は日本時間で出す。UTCのままだと 09:00 JST より前に生成したページが
// 前日の日付になり、「最終更新日」が1日ずれる（2026-08-24 に実際にずれた）。
export const TODAY = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
export const TODAY_JA = TODAY.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日')

export const h = (v: unknown) => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
export const attr = h
export const json = (v: unknown) => JSON.stringify(v).replaceAll('<', '\\u003c')
export const items = (list?: TextItem[] | null) => (list || []).map((x) => x.text || '').filter(Boolean)

export function jaVerdict(p: Project): string {
  const n = typeof p.jaFileCount === 'number' ? p.jaFileCount : null
  if (p.japaneseStatus === '日本語ファイルあり') return `${p.name}には日本語のファイルが${n ?? 0}件あり、日本語で使える見込みがあります。`
  if (p.japaneseStatus === '日本語ファイルが一部のみ') return `${p.name}の日本語ファイルは${n ?? 0}件だけで、実務で使うには日本語化が必要です。`
  if (p.japaneseStatus === '日本語ファイルなし') return `${p.name}には日本語のファイルがありません。日本語化から始める必要があります。`
  return `${p.name}の日本語対応は未調査です。`
}

export function styles(): string {
  return `<style>
${DEMO_CSS}
:root{--ink:#132329;--muted:#5a6a72;--paper:#f4f7f7;--line:#dbe5e8;--blue:#007f96;--dark:#10242b;--amber:#c17a00}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);line-height:1.85;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}
a{color:var(--blue)}.wrap{width:min(1080px,calc(100% - 34px));margin:auto}.relnews{width:min(1080px,calc(100% - 34px));margin:22px auto 0;background:#fff;border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:12px;padding:16px 20px}.relnews h2{font-size:15px;margin:0 0 8px}.relnews .news-list{margin:0;padding:0;list-style:none;font-size:13.5px}.relnews .news-list li{padding:5px 0;border-bottom:1px dotted var(--line);display:flex;gap:10px;justify-content:space-between}.relnews .news-list li:last-child{border-bottom:0}.relnews .news-date{color:var(--muted);font-size:11.5px;white-space:nowrap}
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 26px;background:rgba(255,255,255,.95);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font-weight:800;text-decoration:none;font-size:16px}
.brand-logo{width:32px;height:32px;display:block;border-radius:7px}
.toplinks{display:flex;gap:13px;flex-wrap:wrap;font-size:13px;font-weight:700}
.hero{background:linear-gradient(120deg,var(--dark),#14343d);color:#fff;padding:52px 0 40px}
.hero .kicker{color:#7fe3d6;font-size:13px;font-weight:800;letter-spacing:.06em;margin:0 0 10px}
.hero h1{font-size:clamp(25px,4.4vw,42px);line-height:1.4;margin:0 0 14px}
.hero .lead{font-size:16px;color:#cfe2e4;max-width:820px;margin:0}
.crumb{font-size:13px;color:var(--muted);padding:16px 0 0}
section{padding:24px 0}h2{font-size:23px;line-height:1.45;margin:0 0 10px}h3{font-size:17px;margin:0 0 6px}
.panel{background:#fff;border:1px solid var(--line);border-radius:13px;padding:20px 22px;margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.card{background:#fff;border:1px solid var(--line);border-radius:11px;padding:15px 17px}
.card p{margin:0;font-size:14px;color:var(--muted)}
ul.checks{margin:8px 0 0;padding-left:20px}ul.checks li{margin:5px 0}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}
th{width:32%;color:var(--muted);font-weight:800;font-size:12px}
.table-wrap{overflow-x:auto}
.cta{background:linear-gradient(135deg,#e8faf6,#fff8e5);border:1px solid #bddfd9;border-radius:13px;padding:22px;margin:22px 0}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:10px 20px;border-radius:11px;font-weight:800;text-decoration:none;font-size:14px;border:1px solid var(--line);background:#fff;margin:6px 8px 0 0}
.btn-main{background:var(--blue);color:#fff;border-color:var(--blue)}
.cat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.cat-card{display:block;background:#fff;border:1px solid var(--line);border-radius:11px;padding:13px 15px;text-decoration:none;color:var(--ink)}
.cat-card b{display:block;font-size:14px}.cat-card span{font-size:12px;color:var(--muted)}
.note{font-size:12px;color:var(--muted)}
footer{margin-top:34px;border-top:1px solid var(--line);padding:26px 0 44px;color:var(--muted);font-size:13px}
@media(max-width:820px){.grid,.cat-grid{grid-template-columns:1fr}}
@media(max-width:680px){.topbar{padding:10px 14px;gap:10px}.brand{font-size:14.5px;gap:8px}.brand-logo{width:28px;height:28px}.toplinks{gap:10px;font-size:12.5px}.toplinks a:not(:last-child){display:none}.toplinks a:last-child{background:var(--blue);color:#fff;border-radius:999px;padding:7px 14px;text-decoration:none}}
</style>`
}

/**
 * Kurage.AI 相談ボタン。
 * 正典は exbridge_jp/partials/kurage-ai-fab.html。片方だけ直すと見た目がずれるので、
 * 変えるときは exbridge_jp/scripts/add_kurage_ai_fab.py も合わせて実行する。
 * ref= は、どのページから相談に来たかを後で見るために付ける。
 */
export function kurageAiFab(canonical: string, refPrefix: string, base: string): string {
  const slug = canonical.replace(`${base}/`, '').replace(/\/$/, '') || 'index'
  const ref = `${refPrefix}-${slug.replace(/\//g, '-') || 'index'}`
  return `<a href="${KURAGE}/chat.php?ref=${attr(ref)}" id="kai-fab" aria-label="Kurage.AIに相談"><img src="${KURAGE}/kurage-face-384.webp" alt="Kurage.AI" width="44" height="44"><span class="kai-txt"><b>Kurage.AI に相談</b><i>AIが何でも答えます</i></span></a>
<style>#kai-fab{position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#12a99f,#0a726b);color:#fff;text-decoration:none;border-radius:999px;padding:8px 18px 8px 8px;box-shadow:0 12px 30px rgba(10,80,75,.35);font-family:"Hiragino Sans","Noto Sans JP",sans-serif;animation:kaiPulse 2.6s ease-in-out infinite}#kai-fab img{width:44px;height:44px;border-radius:50%;object-fit:cover;object-position:50% 12%;border:2px solid rgba(255,255,255,.85);background:#fff;flex:none}#kai-fab .kai-txt{display:flex;flex-direction:column;line-height:1.2}#kai-fab .kai-txt b{font-size:14px;font-weight:900}#kai-fab .kai-txt i{font-size:10.5px;font-style:normal;opacity:.92}#kai-fab:hover{transform:translateY(-2px)}@keyframes kaiPulse{0%,100%{box-shadow:0 12px 30px rgba(10,80,75,.35)}50%{box-shadow:0 14px 44px rgba(18,169,159,.6)}}@media(max-width:520px){#kai-fab .kai-txt i{display:none}#kai-fab{padding:7px 15px 7px 7px}#kai-fab img{width:40px;height:40px}}</style>`
}

export type ShellOpts = { refPrefix: string; base: string; footerLinks: string }
/**
 * 関連ニュースの差し込み口。中身は exbridge.jp/ai-it-news/ の news-widget.js が
 * news-index.json を読んで描画する。
 *
 * なぜHTMLに埋め込まないか: 対象が1,700ページ以上あり、毎朝埋め込むと
 * 再生成とFTP配置に15〜20分かかるうえ、全ページのlastmodが毎日動く。
 * JSON1本の差し替えなら数秒で終わる。
 */
export function relatedNews(kind: 'saas' | 'oss', key: string): string {
  return `<section id="related-news" data-kind="${kind}" data-key="${attr(key)}" class="relnews" style="display:none"></section>`
}

export const NEWS_SCRIPT = '<script defer src="https://exbridge.jp/ai-it-news/news-widget.js"></script>'

export function shell(title: string, desc: string, canonical: string, body: string, ld: unknown[], opts: ShellOpts): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h(title)}</title><meta name="description" content="${attr(desc)}"><link rel="canonical" href="${attr(canonical)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="株式会社エクスブリッジ">
<meta property="og:title" content="${attr(title)}"><meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${attr(canonical)}"><meta property="og:image" content="${SITE}/images/ai-development-ogp.png">
<meta name="twitter:card" content="summary_large_image">
${[...ld, orgLd()].map((x) => `<script type="application/ld+json">${json(x)}</script>`).join('\n')}
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA}');</script>
<script>(function(){var s=document.createElement('script');s.src='${SITE}/simpletrack.php?url='+encodeURIComponent(location.href)+'&ref='+encodeURIComponent(document.referrer);s.async=true;document.head.appendChild(s)})();</script>
${NEWS_SCRIPT}
${styles()}</head><body>
<header class="topbar"><a class="brand" href="${SITE}/"><img class="brand-logo" src="${SITE}/images/logo-mark-64.png" alt="" width="32" height="32" loading="eager"><span>株式会社エクスブリッジ</span></a>
<nav class="toplinks"><a href="${SITE}/ai-development.html">AI開発・活用支援</a><a href="${TRIAL}">AI導入お試し</a><a href="${SITE}/contact.php">相談する</a></nav></header>
${body}
<img src="${SITE}/simpletrack.php?t=img&url=${encodeURIComponent(canonical)}" width="1" height="1" alt="" aria-hidden="true" style="position:absolute;left:-9999px">
${kurageAiFab(canonical, opts.refPrefix, opts.base)}
<footer><div class="wrap">
<p><strong>株式会社エクスブリッジ</strong>（EXBRIDGE, Inc.／法人番号 4180001056508）　愛知県名古屋市瑞穂区内浜町34-9 305　2004年4月設立</p>
<p>${opts.footerLinks}</p>
<p class="note">このページの最終更新日: <time datetime="${TODAY}">${TODAY_JA}</time>／文責: 株式会社エクスブリッジ 代表取締役 小嶋 篤</p>
</div></footer>
</body></html>`
}

/** subject を渡すと見出しの主語を差し替える（index では分類名ではなく「AI導入」にする）。 */
