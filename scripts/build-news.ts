/**
 * exbridge.jp/news/ —「ニュースと国会の記録カード｜国会トラッカーカード」を生成する（2026-10-20 ユーザー指示）。
 *
 * 元データ: data/news-cards.json（xb4g/giin/scripts/news_cards.py --export が毎時書く）。
 *   毎時の X 返信候補のうち、報道機関の投稿に付いた当社のカード（国会トラッカー・経済指標・質問主意書…）。
 *
 * なぜ exbridge.jp に置くか: 検索の評価が xb4g.com より高い（GSC 28日 クリック 529 対 7）。ここから国会トラッカー
 * （xb4g.com/giin/tracker/<key>）へ文字リンクを送り、トラッカー側の評価も上げる。
 * なぜ kpayload か: vibeblog と同じ page-shell（構造化データ・OGP・ロゴのヘッダー・会社のフッター）がそのまま付く。
 *
 * 出力:
 *   dist/news/index.html          直近7日（日ごとの見出し）
 *   dist/news/<YYYY-MM-DD>.html   日ごとの保管ページ（7日を過ぎても中身が残る＝検索に残る）
 *   dist/news/sitemap.xml
 *
 * 使い方: npx tsx scripts/build-news.ts   → bash scripts/deploy.sh news
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { SITE, KURAGE } from './site'
import { h, attr, fitLength, shell as baseShell, json } from './page-shell'
import { loadKappTopics, kappLine } from './kapp-topic-links'

type Item = { day: string; time: string; source: string; post: string; newsUrl?: string; headline: string; card: string; kind: string
  cardTitle: string; cardImage: string; tracker: string; trackerName: string; lead?: string
  id?: string; cardDesc?: string; qa?: { date: string; house: string; meeting: string; latest?: boolean; q?: { who: string; text: string }; a?: { who: string; text: string } } | null }

const BASE = `${SITE}/news`
const OUT = path.join(process.cwd(), 'dist', 'news')
const NAME = 'ニュースと国会の記録カード'
const SUB = '国会トラッカーカード'
const REF_SHARE = 'x-share-newscard'
const DAYS_ON_INDEX = 7

await loadKappTopics()   // 話題が合うニュースに当社の商品を1行（2026-11-07）
const data: { generated: string; items: Item[] } = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'news-cards.json'), 'utf8'))

// 政策の流れトラッカー（xb4g.com/giin/flow/）への導線（2026-11-06 ユーザー指示「国会トラッカーだけじゃなくて、政策の流れトラッカーも追加しないと」）。
// 分野ごとの「関係する国会トラッカー」（xb4g/giin/data/flow/index.json の trackers）で引き、当たらないときは見出しの語で当てる
const FLOW = 'https://xb4g.com/giin/flow'
type FlowField = { slug: string; name: string; trackers?: string[] }
const flowFields: FlowField[] = await fs.readFile('/home/kojima/work/xb4g/giin/data/flow/index.json', 'utf8')
  .then((t) => (JSON.parse(t).fields || []) as FlowField[]).catch(() => [])
const FLOW_WORDS: Record<string, RegExp> = {
  'iryo-fukushi-yushi': /コロナ融資|ゼロゼロ融資|福祉医療機構|物価高騰融資|優遇融資/,
  cyber: /サイバー|偽情報|偽・誤情報|誤情報|デマ|脆弱性|ランサム|不正アクセス|情報漏え?い|フィッシング/,
  koho: /政府広報|広報予算|広報費|安保広報|広報事業|PR動画|啓発動画/,
  ai: /生成AI|生成ＡＩ|AI法|ＡＩ法|人工知能|AI政策|ＡＩ政策|データセンター|国産AI|国産ＡＩ|GENIAC/,
}
// 分野の画面の「関係する国会トラッカー」には周辺のもの（経済安全保障・介護報酬など）も入るので、ニュースの判定は中心のトラッカーだけで引く
// （株価のニュースがサイバー分野に、介護サービスのニュースが資金繰りの分野に当たったため・2026-11-06）
const FLOW_CORE: Record<string, string[]> = {
  ai: ['ai-hou', 'ai-agent', 'ai-biosecurity', 'datacenter-denryoku'],
  koho: ['seifu-koho'],
  cyber: ['nise-joho', 'zeijakusei-chosa', 'ransomware', 'joho-roei'],
  'iryo-fukushi-yushi': ['corona-yushi'],
}
function flowFor(x: Item): FlowField[] {
  const key = (x.tracker || '').replace(/[#?].*$/, '').replace(/\/$/, '').split('/').pop() || ''
  const byTracker = key ? flowFields.filter((f) => (FLOW_CORE[f.slug] || f.trackers || []).includes(key)) : []
  if (byTracker.length) return byTracker
  return flowFields.filter((f) => FLOW_WORDS[f.slug]?.test(x.headline))
}
function flowLine(x: Item, ref: string): string {
  const fs2 = flowFor(x)
  return fs2.length ? `<p class="nc-trk">予算・事業・成果までの流れ：${fs2.map((f) => `<a href="${FLOW}/${attr(f.slug)}#ref=${ref}">政策の流れトラッカー「${h(f.name)}」</a>`).join('　')}</p>` : ''
}
function flowBox(list: Item[]): string {
  const m = new Map<string, { f: FlowField; n: number }>()
  for (const x of list) for (const f of flowFor(x)) m.set(f.slug, { f, n: (m.get(f.slug)?.n || 0) + 1 })
  const top = [...m.values()].sort((a, b) => b.n - a.n)
  return `<section class="nc-box"><h2>ニュースに出てきた政策の流れ</h2>
<p class="nc-note">国会の議論の先にある、計画・予算・支出先・目標と実績・点検を、公表資料だけでつないで並べたページです。</p>
${top.length ? `<ul>${top.map((v) => `<li><a href="${FLOW}/${attr(v.f.slug)}#ref=exbridge-news-list">${h(v.f.name)}</a>（${v.n}件のニュース）</li>`).join('')}</ul>` : ''}
<p class="nc-note"><a href="${FLOW}/#ref=exbridge-news-list">政策の流れトラッカーの一覧（すべての分野）</a></p></section>`
}
const items = data.items.filter((x) => x.headline && x.card)
const days = [...new Set(items.map((x) => x.day))].sort().reverse()
const dayJa = (d: string) => d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, dd) => `${y}年${Number(m)}月${Number(dd)}日`)

const SHELL = {
  refPrefix: 'exbridge-news',
  base: BASE,
  ogImage: `${SITE}/images/ai-development-ogp.png`,
  topLinks: `<a href="https://xb4g.com/giin/tracker/#ref=exbridge-news-nav">国会トラッカー</a><a href="https://xb4g.com/giin/flow/#ref=exbridge-news-nav">政策の流れ</a><a href="${SITE}/keizai/#ref=exbridge-news-nav">経済指標カード</a><a href="${SITE}/vibeblog/#ref=exbridge-news-nav">ブログ</a>`,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${BASE}/">${NAME}</a>　<a href="https://xb4g.com/giin/tracker/#ref=exbridge-news">国会トラッカー（テーマごとの質疑と政府の答弁）</a>　<a href="https://xb4g.com/giin/flow/#ref=exbridge-news">政策の流れトラッカー（計画・予算・成果）</a>　<a href="${SITE}/keizai/#ref=exbridge-news">経済指標カード</a>　<a href="${KURAGE}/kshuisho.php/#ref=exbridge-news">質問主意書アシスト</a>`,
}

const copyScript = `<script>
document.querySelectorAll('.nc-cp').forEach(function(b){b.addEventListener('click',function(){var t=b.dataset.copy;
var ok=function(){var o=b.textContent;b.textContent='コピーしました';setTimeout(function(){b.textContent=o},1500)};
var fb=function(){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');ok()}catch(e){}a.remove()};
if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(ok,fb)}else{fb()}})});
document.querySelectorAll('.nc-filters button').forEach(function(b){b.addEventListener('click',function(){
document.querySelectorAll('.nc-filters button').forEach(function(x){x.classList.toggle('on',x===b)});
var k=b.dataset.k;document.querySelectorAll('.nc-item').forEach(function(it){it.hidden=!!k&&it.dataset.kind!==k});
document.querySelectorAll('.nc-day').forEach(function(d){d.hidden=!d.querySelector('.nc-item:not([hidden])')})})});
</script>`

const shell = (t: string, d: string, u: string, b: string, l: unknown[]) =>
  baseShell(t, d, u, b, l, SHELL).replace('</body>', `${copyScript}</body>`)

const styles = `<style>
.nc-wrap{max-width:1080px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left,0px)) 40px}
.crumb{font-size:12.5px;color:#5f7078;margin:14px 0 6px}
.nc-wrap h1{font-size:25px;line-height:1.45;margin:6px 0 4px}.nc-sub{font-size:14px;color:#0a726b;font-weight:700;margin:0 0 8px}
.nc-lead{background:#f3faf9;border:1px solid #dcebe9;border-radius:10px;padding:12px 14px;font-size:14px;color:#425560;line-height:1.9;margin:0 0 14px}
.nc-filters{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 14px}.nc-filters button{border:1px solid #d6e3e6;background:#fff;border-radius:999px;padding:4px 12px;font-size:13px;cursor:pointer}
.nc-filters button.on{background:#0a7a6e;color:#fff;border-color:#0a7a6e}
.nc-day h2{font-size:18px;padding-left:10px;border-left:4px solid #0a9a8f;margin:24px 0 10px}
.nc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.nc-item{background:#fff;border:1px solid #e3eaec;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.nc-meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:#5f7078}.nc-tag{background:#e3f3f0;color:#0a726b;border-radius:999px;padding:0 8px;font-weight:700}
.nc-item h3{font-size:15px;line-height:1.55;margin:0}.nc-item h3 a{color:#16232b;text-decoration:none}.nc-item h3 a:hover{text-decoration:underline}
.nc-card{display:block;border:1px solid #e3eaec;border-radius:8px;overflow:hidden;color:#5f7078;text-decoration:none;font-size:12.5px}
.nc-card img{display:block;width:100%;height:auto;aspect-ratio:1200/630;object-fit:contain;background:#eef2f4}.nc-card span{display:block;padding:6px 8px}
.nc-trk{font-size:13px;margin:0}.nc-lead-line{font-size:13px;color:#425560;margin:0}.nc-trk a{color:#0a726b}
.nc-btns{display:flex;gap:8px;margin-top:auto}.nc-btns>*{flex:1;text-align:center;border-radius:8px;padding:8px 6px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.nc-cp{border:1px solid #0a7a6e;background:#fff;color:#0a7a6e}.nc-x{background:#111;color:#fff;text-decoration:none;border:1px solid #111}
.nc-box{background:#fff;border:1px solid #e3eaec;border-radius:12px;padding:14px 16px;margin:22px 0}
.nc-box h2{font-size:17px;margin:0 0 8px}.nc-box ul{margin:0;padding-left:20px}.nc-box li{margin:3px 0}
.nc-days{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:14px}
.nc-note{font-size:12.5px;color:#5f7078}
.nc-art{max-width:760px}.nc-art .nc-card{max-width:640px}
.nc-qa{background:#fff;border:1px solid #e3eaec;border-radius:12px;padding:12px 16px;margin:12px 0}
.nc-qa p{margin:6px 0;font-size:14.5px;line-height:1.85}.nc-qa .who{font-weight:700;color:#0a726b}
.nc-src{font-size:13px;margin:4px 0 12px}
</style>`

/** Xの数え方（全角=2・半角=1・URLは1本23） */
const xlen = (t: string) => {
  let n = 0
  const rest = t.replace(/https?:\/\/\S+/g, () => { n += 23; return '' })
  for (const ch of rest) n += ch.codePointAt(0)! < 0x1100 ? 1 : 2
  return n
}
/**
 * 投稿の文：ニュースの見出し／ニュースのURL／カードへ誘う一文／カードのURL（2026-10-20 ユーザー指示
 * 「ニュースのタイトル、ニュースのURL、考察誘導文章があって、誘導URL」）。カードのURLを最後に置くと、
 * X はそのカードの画像を出す。280 を超えるときは見出しを詰め、それでも超えれば誘う一文を外す。
 */
function shareText(x: Item): string {
  const card = `${x.card}#ref=${REF_SHARE}`
  const news = x.newsUrl || x.post
  const lead = x.lead || ''
  let head = x.headline
  const build = (hd: string, ld: string) => [hd, news, ld, card].filter(Boolean).join('\n')
  while (xlen(build(head, lead)) > 280 && head.length > 12) head = head.slice(0, -2).replace(/…$/, '') + '…'
  return xlen(build(head, lead)) <= 280 ? build(head, lead) : build(head, '')
}

const itemUrl = (x: Item) => `${BASE}/${x.day}/${x.id}.html`

function itemHtml(x: Item): string {
  const share = `${x.card}#ref=${REF_SHARE}`
  const post = shareText(x)
  const intent = 'https://x.com/intent/post?' + new URLSearchParams({ text: post }).toString()
  return `<article class="nc-item" data-kind="${attr(x.kind)}">
<div class="nc-meta"><span class="nc-tag">${h(x.kind)}</span><span>${h(x.time)}</span><span>${h(x.source)}</span></div>
<h3>${x.id ? `<a href="${attr(itemUrl(x))}">${h(x.headline)}</a>` : `<a href="${attr(x.post)}" target="_blank" rel="noopener nofollow">${h(x.headline)}</a>`}</h3>
<a class="nc-card" href="${attr(x.card)}#ref=exbridge-news">${x.cardImage ? `<img src="${attr(x.cardImage)}" alt="${attr(x.cardTitle)}" loading="lazy" width="1200" height="630">` : ''}<span>${h(x.cardTitle || x.card)}</span></a>
${x.tracker ? `<p class="nc-trk">このテーマの国会の質疑と政府の答弁：<a href="${attr(x.tracker)}#ref=exbridge-news">国会トラッカー「${h(x.trackerName || 'テーマ')}」</a></p>` : ''}
${flowLine(x, 'exbridge-news')}
${x.lead ? `<p class="nc-lead-line">${h(x.lead)}</p>` : ''}
<div class="nc-btns"><button type="button" class="nc-cp" data-copy="${attr(post)}">投稿文をコピー</button><a class="nc-x" href="${attr(intent)}" target="_blank" rel="noopener">Xに投稿</a></div>
</article>`
}

/** 話題が合うニュースだけ、開発の相談のページへ1行（2026-11-06。ChatGPT-User が1日約100回このページを読むため）。
 *  見出しと国会トラッカーの名前に語があるときだけ出す。計測は ref=news-dev-<ページ> */
const DEV_LINKS: [RegExp, string, string, string][] = [
  [/IT導入補助金|デジタル化・AI導入補助金|ものづくり[^。]{0,10}補助金|中小企業[^。]{0,20}補助金|補助金[^。]{0,20}(IT|ＩＴ|デジタル|AI|ＡＩ|DX|ＤＸ)|(IT|ＩＴ|デジタル|AI|ＡＩ|DX|ＤＸ)[^。]{0,20}補助金/, 'ai-hojokin.html', 'hojokin', 'AI導入に使える補助金（デジタル化・AI導入補助金2026と愛知県・名古屋市の制度）'],
  [/生成AI|ＡＩ|AI|人工知能|ChatGPT|チャットＧＰＴ|AIエージェント/, 'ai-development.html', 'ai', 'AIを業務で使える形にする（名古屋のAI開発・AI活用支援）'],
  [/ＤＸ|DX|デジタル化|業務効率|人手不足|省力化|生産性/, 'gyomu-system-kaihatsu.html', 'gyomu', '自社の業務システムを持つ（業務システム開発・税別15〜20万円・最短4営業日）'],
]
function devLink(x: Item): string {
  const t = `${x.headline} ${x.trackerName || ''}`   // リード・カード名は全ページ共通の語を含むので使わない（台風・選挙に当たった）
  const hit = DEV_LINKS.find(([re]) => re.test(t))
  return hit ? `<p class="nc-note">この話題を自社の仕事に置きかえると：<a href="${SITE}/${hit[1]}#ref=news-dev-${hit[2]}">${h(hit[3])}</a></p>` : ''
}

function daySection(d: string, list: Item[], heading: 'h2' | 'none'): string {
  const grid = `<div class="nc-grid">${list.map(itemHtml).join('')}</div>`
  return heading === 'h2' ? `<section class="nc-day"><h2><a href="${BASE}/${d}.html" style="color:inherit;text-decoration:none">${h(dayJa(d))}</a>（${list.length}件）</h2>${grid}</section>` : grid
}

function filters(list: Item[]): string {
  const kinds = [...new Set(list.map((x) => x.kind))].sort()
  return `<div class="nc-filters"><button type="button" class="on" data-k="">すべて</button>${kinds.map((k) => `<button type="button" data-k="${attr(k)}">${h(k)}</button>`).join('')}</div>`
}

/** その期間に出た国会トラッカーを件数の多い順に。xb4g のトラッカーへの内部リンクの束（SEOの本命） */
function trackerBox(list: Item[]): string {
  const m = new Map<string, { name: string; n: number }>()
  for (const x of list) if (x.tracker) m.set(x.tracker, { name: x.trackerName || x.tracker, n: (m.get(x.tracker)?.n || 0) + 1 })
  const top = [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20)
  return top.length ? `<section class="nc-box"><h2>ニュースに出てきた国会トラッカー</h2>
<p class="nc-note">国会会議録から、そのテーマでだれが質問し、政府が何と答えたかを日付つきで並べたページです。</p>
<ul>${top.map(([u, v]) => `<li><a href="${attr(u)}#ref=exbridge-news-list">${h(v.name)}</a>（${v.n}件のニュース）</li>`).join('')}</ul>
<p class="nc-note"><a href="https://xb4g.com/giin/tracker/#ref=exbridge-news-list">国会トラッカーの一覧（すべてのテーマ）</a></p></section>` : ''
}

const lead = `報道各社のニュースに関係する、国会の質疑・政府の答弁、経済指標、質問主意書のカードです。カードは国会会議録・日本銀行の統計・衆参の質問主意書などの公開データから、株式会社エクスブリッジが作っています。「投稿文をコピー」「Xに投稿」で、ニュースとカードをまとめて共有できます。見出しは各社の投稿の1行目で、記事の中身は各社のページでご確認ください。`

function ld(title: string, url: string, list: Item[]) {
  return [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, inLanguage: 'ja', isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` },
      mainEntity: { '@type': 'ItemList', numberOfItems: list.length,
        itemListElement: list.slice(0, 50).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: x.card, name: x.cardTitle || x.headline })) } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: NAME, item: `${BASE}/` },
      ...(url !== `${BASE}/` ? [{ '@type': 'ListItem', position: 3, name: title, item: url }] : [])] },
  ]
}

await fs.mkdir(OUT, { recursive: true })
const recent = days.slice(0, DAYS_ON_INDEX)
const recentItems = items.filter((x) => recent.includes(x.day))
{
  const title = fitLength(32, `${NAME}｜${SUB}`, NAME)
  const desc = `報道各社のニュースに関係する国会の質疑・政府の答弁、経済指標、質問主意書のカードを毎時更新。直近${DAYS_ON_INDEX}日で${recentItems.length}件。ニュースの見出しとURL、カードへの一言とカードのURLを、そのままコピーしたりXに投稿したりできます。`
  const body = `<main class="nc-wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ ${NAME}</nav>
<h1>${NAME}</h1><p class="nc-sub">${SUB}｜毎時更新</p>
<p class="nc-lead">${h(lead)}</p>
${filters(recentItems)}
${recent.map((d) => daySection(d, recentItems.filter((x) => x.day === d), 'h2')).join('\n')}
${trackerBox(recentItems)}
${flowBox(recentItems)}
<section class="nc-box"><h2>日ごとのカード</h2><div class="nc-days">${days.map((d) => `<a href="${BASE}/${d}.html">${h(dayJa(d))}</a>`).join('')}</div></section>
</main>${styles}`
  await fs.writeFile(path.join(OUT, 'index.html'), shell(title, desc, `${BASE}/`, body, ld(title, `${BASE}/`, recentItems)))
}
for (const d of days) {
  const list = items.filter((x) => x.day === d)
  const title = fitLength(32, `${dayJa(d)}の${NAME}｜${SUB}`, `${dayJa(d)}の${NAME}`)
  const desc = `${dayJa(d)}の報道各社のニュースに関係する、国会の質疑・政府の答弁、経済指標、質問主意書のカード${list.length}件。`
  const i = days.indexOf(d)
  const nav = `<p class="nc-days">${days[i + 1] ? `<a href="${BASE}/${days[i + 1]}.html">← ${h(dayJa(days[i + 1]))}</a>` : ''}<a href="${BASE}/">最新のカード</a>${days[i - 1] ? `<a href="${BASE}/${days[i - 1]}.html">${h(dayJa(days[i - 1]))} →</a>` : ''}</p>`
  const body = `<main class="nc-wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ <a href="${BASE}/">${NAME}</a> ／ ${h(dayJa(d))}</nav>
<h1>${h(dayJa(d))}の${NAME}</h1><p class="nc-sub">${SUB}</p>
<p class="nc-lead">${h(lead)}</p>
${nav}
${filters(list)}
${daySection(d, list, 'none')}
${trackerBox(list)}
${flowBox(list)}
${nav}
</main>${styles}`
  await fs.writeFile(path.join(OUT, `${d}.html`), shell(title, desc, `${BASE}/${d}.html`, body, ld(title, `${BASE}/${d}.html`, list)))
}
// ニュース1件ごとのページ（2026-10-20 ユーザー指摘「中にページないとSEO弱くない？」）。
// 見出しとカードだけの薄いページにしないよう、カードの説明・会議録の質問と答弁の冒頭（原文のまま）・同じテーマのほかのニュースを載せる
const withId = items.filter((x) => x.id)
for (const x of withId) {
  await fs.mkdir(path.join(OUT, x.day), { recursive: true })
  const same = withId.filter((y) => y !== x && ((x.tracker && y.tracker === x.tracker) || y.card === x.card)).slice(0, 8)
  const title = fitLength(32, `${x.headline}｜国会の記録カード`, `${x.headline}｜国会の記録`, x.headline)
  const desc = fitLength(120, `${x.headline}。${x.lead || ''}${x.cardDesc ? ' ' + x.cardDesc : ''}`, `${x.headline}。${x.lead || ''}`)
  const url = itemUrl(x)
  const qa = x.qa
  const body = `<main class="nc-wrap nc-art">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ <a href="${BASE}/">${NAME}</a> ／ <a href="${BASE}/${x.day}.html">${h(dayJa(x.day))}</a></nav>
<h1>${h(x.headline)}</h1>
<p class="nc-src">${h(x.source)}・${h(dayJa(x.day))} ${h(x.time)}の投稿より　<a href="${attr(x.newsUrl || x.post)}" target="_blank" rel="noopener nofollow">元の記事を読む</a></p>
<section class="nc-box"><h2>このニュースに関係する国会の記録</h2>
${x.lead ? `<p>${h(x.lead)}</p>` : ''}
<a class="nc-card" href="${attr(x.card)}#ref=exbridge-news-item">${x.cardImage ? `<img src="${attr(x.cardImage)}" alt="${attr(x.cardTitle)}" loading="lazy" width="1200" height="630">` : ''}<span>${h(x.cardTitle || x.card)}</span></a>
${x.cardDesc ? `<p class="nc-note">${h(x.cardDesc)}</p>` : ''}
${qa && (qa.q || qa.a) ? `<div class="nc-qa">${qa.latest ? `<p><b>このテーマ「${h(x.trackerName || '')}」で、国会でいちばん最近あった質問と答弁</b></p>` : ''}<p class="nc-note">${h(dayJa(qa.date))}　${h(qa.house)} ${h(qa.meeting)}（会議録の原文のまま・冒頭のみ）</p>
${qa.q ? `<p><span class="who">質問　${h(qa.q.who)}</span><br>${h(qa.q.text)}…</p>` : ''}${qa.a ? `<p><span class="who">答弁　${h(qa.a.who)}</span><br>${h(qa.a.text)}…</p>` : ''}</div>` : ''}
${x.tracker ? `<p class="nc-trk">このテーマの国会の質疑と政府の答弁をすべて見る：<a href="${attr(x.tracker)}#ref=exbridge-news-item">国会トラッカー「${h(x.trackerName || 'テーマ')}」</a></p>` : ''}
${x.tracker ? `<p class="nc-note">国会の記録のURL：${h(x.tracker.replace(/[#?].*$/, ''))}</p>` : ''}
${flowLine(x, 'exbridge-news-item')}
${devLink(x)}
${(() => { const k = kappLine(x.headline, 'news-kapp', h); return k ? `<p class="nc-note">${k}</p>` : '' })()}
<div class="nc-btns" style="max-width:420px;margin-top:10px"><button type="button" class="nc-cp" data-copy="${attr(shareText(x))}">投稿文をコピー</button><a class="nc-x" href="${attr('https://x.com/intent/post?' + new URLSearchParams({ text: shareText(x) }).toString())}" target="_blank" rel="noopener">Xに投稿</a></div>
</section>
${same.length ? `<section class="nc-box"><h2>同じテーマのほかのニュース</h2><ul>${same.map((y) => `<li><a href="${attr(itemUrl(y))}">${h(y.headline)}</a>（${h(y.source)}・${h(dayJa(y.day))}）</li>`).join('')}</ul></section>` : ''}
<p class="nc-days"><a href="${BASE}/${x.day}.html">${h(dayJa(x.day))}のカード一覧</a><a href="${BASE}/">最新のカード</a></p>
<p class="nc-note">見出しは${h(x.source)}の投稿の1行目です。記事の中身は元の記事でご確認ください。カードは国会会議録・質問主意書・日本銀行の統計などの公開データから、株式会社エクスブリッジが作っています。</p>
</main>${styles}`
  const ldItem = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, inLanguage: 'ja', description: desc, datePublished: x.day,
      isPartOf: { '@type': 'CollectionPage', name: NAME, url: `${BASE}/` }, about: x.trackerName || x.kind, relatedLink: [x.card, x.newsUrl || x.post] },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: NAME, item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: dayJa(x.day), item: `${BASE}/${x.day}.html` },
      { '@type': 'ListItem', position: 4, name: x.headline, item: url }] },
  ]
  await fs.writeFile(path.join(OUT, x.day, `${x.id}.html`), shell(title, desc, url, body, ldItem))
}

// サイトマップ（lastmod は本当の更新日。索引に毎回 now を打たない＝reference_sitemap_lastmod_and_gsc_traps）
const urls = [{ loc: `${BASE}/`, last: days[0] }, ...days.map((d) => ({ loc: `${BASE}/${d}.html`, last: d })), ...withId.map((x) => ({ loc: itemUrl(x), last: x.day }))]
await fs.writeFile(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${u.last}</lastmod></url>`).join('\n')}\n</urlset>\n`)
console.log(`news: index（${recentItems.length}件）+ 日ごと${days.length}ページ + 1件ごと${withId.length}ページ + sitemap.xml（全${items.length}件・元データ ${data.generated}）`)
void json
