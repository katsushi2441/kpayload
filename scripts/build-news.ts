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

type Item = { day: string; time: string; source: string; post: string; headline: string; card: string; kind: string
  cardTitle: string; cardImage: string; tracker: string; trackerName: string }

const BASE = `${SITE}/news`
const OUT = path.join(process.cwd(), 'dist', 'news')
const NAME = 'ニュースと国会の記録カード'
const SUB = '国会トラッカーカード'
const REF_SHARE = 'x-share-newscard'
const DAYS_ON_INDEX = 7

const data: { generated: string; items: Item[] } = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'news-cards.json'), 'utf8'))
const items = data.items.filter((x) => x.headline && x.card)
const days = [...new Set(items.map((x) => x.day))].sort().reverse()
const dayJa = (d: string) => d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, dd) => `${y}年${Number(m)}月${Number(dd)}日`)

const SHELL = {
  refPrefix: 'exbridge-news',
  base: BASE,
  ogImage: `${SITE}/images/ai-development-ogp.png`,
  topLinks: `<a href="https://xb4g.com/giin/tracker/#ref=exbridge-news-nav">国会トラッカー</a><a href="${SITE}/keizai/#ref=exbridge-news-nav">経済指標カード</a><a href="${SITE}/vibeblog/#ref=exbridge-news-nav">ブログ</a>`,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${BASE}/">${NAME}</a>　<a href="https://xb4g.com/giin/tracker/#ref=exbridge-news">国会トラッカー（テーマごとの質疑と政府の答弁）</a>　<a href="${SITE}/keizai/#ref=exbridge-news">経済指標カード</a>　<a href="${KURAGE}/kshuisho.php/#ref=exbridge-news">質問主意書アシスト</a>`,
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
.nc-trk{font-size:13px;margin:0}.nc-trk a{color:#0a726b}
.nc-btns{display:flex;gap:8px;margin-top:auto}.nc-btns>*{flex:1;text-align:center;border-radius:8px;padding:8px 6px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.nc-cp{border:1px solid #0a7a6e;background:#fff;color:#0a7a6e}.nc-x{background:#111;color:#fff;text-decoration:none;border:1px solid #111}
.nc-box{background:#fff;border:1px solid #e3eaec;border-radius:12px;padding:14px 16px;margin:22px 0}
.nc-box h2{font-size:17px;margin:0 0 8px}.nc-box ul{margin:0;padding-left:20px}.nc-box li{margin:3px 0}
.nc-days{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:14px}
.nc-note{font-size:12.5px;color:#5f7078}
</style>`

function itemHtml(x: Item): string {
  const share = `${x.card}#ref=${REF_SHARE}`
  const intent = 'https://x.com/intent/post?' + new URLSearchParams({ text: `${x.headline}\n${x.cardTitle || x.kind}`, url: share }).toString()
  return `<article class="nc-item" data-kind="${attr(x.kind)}">
<div class="nc-meta"><span class="nc-tag">${h(x.kind)}</span><span>${h(x.time)}</span><span>${h(x.source)}</span></div>
<h3><a href="${attr(x.post)}" target="_blank" rel="noopener nofollow">${h(x.headline)}</a></h3>
<a class="nc-card" href="${attr(x.card)}#ref=exbridge-news">${x.cardImage ? `<img src="${attr(x.cardImage)}" alt="${attr(x.cardTitle)}" loading="lazy" width="1200" height="630">` : ''}<span>${h(x.cardTitle || x.card)}</span></a>
${x.tracker ? `<p class="nc-trk">このテーマの国会の質疑と政府の答弁：<a href="${attr(x.tracker)}#ref=exbridge-news">国会トラッカー「${h(x.trackerName || 'テーマ')}」</a></p>` : ''}
<div class="nc-btns"><button type="button" class="nc-cp" data-copy="${attr(`${x.headline}\n${share}`)}">見出しとURLをコピー</button><a class="nc-x" href="${attr(intent)}" target="_blank" rel="noopener">Xに投稿</a></div>
</article>`
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

const lead = `報道各社のニュースに関係する、国会の質疑・政府の答弁、経済指標、質問主意書のカードです。カードは国会会議録・日本銀行の統計・衆参の質問主意書などの公開データから、株式会社エクスブリッジが作っています。「Xに投稿」でカードつきで共有できます。見出しは各社の投稿の1行目で、記事の中身は各社のページでご確認ください。`

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
  const desc = `報道各社のニュースに関係する国会の質疑・政府の答弁、経済指標、質問主意書のカードを毎時更新。直近${DAYS_ON_INDEX}日で${recentItems.length}件。見出しとカードのURLをコピーしたり、そのままXに投稿したりできます。`
  const body = `<main class="nc-wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ ${NAME}</nav>
<h1>${NAME}</h1><p class="nc-sub">${SUB}｜毎時更新</p>
<p class="nc-lead">${h(lead)}</p>
${filters(recentItems)}
${recent.map((d) => daySection(d, recentItems.filter((x) => x.day === d), 'h2')).join('\n')}
${trackerBox(recentItems)}
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
${nav}
</main>${styles}`
  await fs.writeFile(path.join(OUT, `${d}.html`), shell(title, desc, `${BASE}/${d}.html`, body, ld(title, `${BASE}/${d}.html`, list)))
}
// サイトマップ（lastmod は本当の更新日。索引に毎回 now を打たない＝reference_sitemap_lastmod_and_gsc_traps）
const urls = [{ loc: `${BASE}/`, last: days[0] }, ...days.map((d) => ({ loc: `${BASE}/${d}.html`, last: d }))]
await fs.writeFile(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${u.last}</lastmod></url>`).join('\n')}\n</urlset>\n`)
console.log(`news: index（${recentItems.length}件）+ 日ごと${days.length}ページ + sitemap.xml（全${items.length}件・元データ ${data.generated}）`)
void json
