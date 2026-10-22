/**
 * exbridge.jp/shocho/ — Kurage 省庁トラッカー（各府省の新着情報と、国会の議論を結ぶ）。
 *
 * 何のためか（2026-10-23）: 省庁の発表（ダッシュボードの公開、ツールの公開、審議会の開催）は国会の会議録より早い。
 * 発表ごとに「同じ話題を国会でだれが質問し、政府が何と答えたか」を並べ、国会トラッカーの側からも省庁の新しい発表へ戻れるようにする（双方向）。
 *
 * データ: scripts/shocho-fetch.py（各府省のRSS → data/shocho/items.json・kokkai.json・themes.json）
 * 出力:   /home/kojima/work/exbridge_jp/shocho/{index.html, m/<府省>.html, t/<分野>.html, n/<id>.html, sitemap.xml}
 * 配置:   bash scripts/deploy.sh shocho
 *   npx tsx scripts/build-shocho.ts
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE } from './site'
import { TODAY, h, attr, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data', 'shocho')
const outDir = '/home/kojima/work/exbridge_jp/shocho'
const BASE = `${SITE}/shocho`
const REF = 'shocho'
const GIIN = 'https://xb4g.com/giin'

type Item = { id: string; ministry: string; ministry_name: string; title: string; url: string; date: string; cat: string; first_seen: string; trackers: string[]; themes: string[]; related: string[] }
type Speech = { date: string; house: string; meeting: string; speaker: string; kind: string; url: string; body: string }
type Kok = { key: string; name: string; count: number; recent: Speech[] }

const items = Object.values(JSON.parse(await fs.readFile(path.join(dataDir, 'items.json'), 'utf8')) as Record<string, Item>)
  .sort((a, b) => (b.date + b.first_seen).localeCompare(a.date + a.first_seen))
const kok = JSON.parse(await fs.readFile(path.join(dataDir, 'kokkai.json'), 'utf8')) as Record<string, Kok>
const tname = JSON.parse(await fs.readFile(path.join(dataDir, 'themes.json'), 'utf8')) as Record<string, string>
const MIN: [string, string][] = [['digital', 'デジタル庁'], ['mlit', '国土交通省'], ['mhlw', '厚生労働省'], ['maff', '農林水産省'], ['mext', '文部科学省'], ['soumu', '総務省'], ['cao', '内閣府'], ['fsa', '金融庁']]

const FOOT = `<a href="${SITE}/company">会社概要</a>　<a href="${BASE}/">Kurage 省庁トラッカー</a>　<a href="${GIIN}/tracker/#ref=${REF}-foot">Kurage 国会トラッカー</a>　<a href="${SITE}/academic/#ref=${REF}-foot">Kurage 論文トラッカー</a>　<a href="${SITE}/ai-it-komon.html#ref=${REF}-foot">AI-IT顧問</a>　<a href="${SITE}/ai-sns-komon.html#ref=${REF}-foot">AI-SNS顧問</a>　<a href="${SITE}/contact.php">お問い合わせ</a>`
type OgSpec = { name: string; kind: string; kicker: string; title: string; sub?: string; stats?: [string, string][] }
const ogSpecs: OgSpec[] = []
function og(spec: OgSpec): string {
  ogSpecs.push(spec)
  const v = crypto.createHash('sha1').update(JSON.stringify(spec)).digest('hex').slice(0, 8)
  return `${SITE}/images/shocho/${spec.name}.png?v=${v}`
}
const SNS_BAND = `<div class="wrap"><p class="ac-sns"><img src="https://kurage.exbridge.jp/images/kurage-mascot-cutout-300.webp" width="30" height="34" alt="">このシステムを作った会社が、御社の X の運用をお手伝いします。<a href="${SITE}/ai-sns-komon.html#ref=${REF}-head-sns-komon">AI-SNS顧問を見る →</a></p></div>`
// コピーと X 共有（2026-10-23 ユーザー指示「全ページに。詳しく見たいと思わせる文言とURL」）。見出しのすぐ下に置く
const xw = (t: string) => [...t].reduce((a, c) => a + (c.charCodeAt(0) < 0x1100 ? 1 : 2), 0)
function shareBox(text: string, url: string, kind: string): string {
  let t = text
  while (xw(t) + 24 > 280 && t.length > 20) t = t.slice(0, -2)   // URLは23として280に収める
  const x = `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(`${url}#ref=x-share-${REF}-${kind}`)}`
  const copy = `${t}\n${url}#ref=copy-${REF}-${kind}`
  return `<div class="wrap"><div class="sc-share"><a class="sc-x" href="${attr(x)}" target="_blank" rel="noopener">Xで共有</a>`
    + `<button type="button" class="sc-copy" data-copy="${attr(copy)}">文言とURLをコピー</button><span class="sc-done" hidden>コピーしました</span></div></div>`
}
const SHARE_JS = `<script>document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.sc-copy');if(!b)return;var t=b.getAttribute('data-copy');function ok(){var d=b.parentNode.querySelector('.sc-done');if(d){d.hidden=false;setTimeout(function(){d.hidden=true},2500)}}if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(ok)}else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();ok()}});</script>`
const shell = (t: string, d: string, u: string, b: string, l: unknown[], ogImage?: string, share = '') => baseShell(t, d, u, b.replace('</section>', '</section>' + share + SNS_BAND) + SHARE_JS, l, { refPrefix: REF, base: BASE, footerLinks: FOOT, ogImage })

const CSS = `<style>
.hero .kicker::before{content:"";display:inline-block;width:26px;height:30px;margin-right:7px;vertical-align:-9px;background:url(https://kurage.exbridge.jp/images/kurage-mascot-cutout-300.webp) center/contain no-repeat}
.ac-sns{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0 0;padding:12px 16px;border-radius:12px;background:#e6f7f3;border:1px solid #bcecd3;font-size:14.5px;line-height:1.6}.ac-sns img{flex:none;width:30px;height:34px;object-fit:contain}.ac-sns a{font-weight:900;white-space:nowrap}
.sc-sec{padding:26px 0 6px}.sc-sec>h2{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.sc-sec>h2 small{font-size:13px;color:var(--muted);font-weight:700}
.sc-list{display:grid;gap:10px}
.sc-item{background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px 16px}
.sc-item h3{font-size:15.5px;line-height:1.55;margin:0 0 4px;overflow-wrap:anywhere}.sc-item h3 a{color:var(--ink);text-decoration:none}.sc-item h3 a:hover{text-decoration:underline}
.sc-meta{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12.5px;color:var(--muted);align-items:center}
.sc-tag{display:inline-block;font-size:11.5px;font-weight:800;border-radius:999px;padding:1px 9px;background:#e6f4f6;color:#00687b;text-decoration:none}
.sc-tag.k{background:#fff4dc;color:#8a5a00}.sc-tag.q{background:#eaf0fb;color:#1f4f9a}.sc-tag.gov{background:#fff4dc;color:#8a5a00}
.sc-kok{background:#fff;border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:12px;padding:15px 17px;margin:0 0 12px}
.sc-kok h3{margin:0 0 8px}.sc-kok ul{margin:0;padding:0;list-style:none}.sc-kok li{padding:8px 0;border-top:1px dotted var(--line);font-size:14px}.sc-kok li:first-child{border-top:0}
.sc-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.sc-card{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--ink)}
.sc-card b{display:block;font-size:15px}.sc-card span{font-size:12.5px;color:var(--muted)}
.sc-share{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0 0}.sc-x,.sc-copy{display:inline-flex;align-items:center;min-height:40px;padding:8px 16px;border-radius:999px;font-weight:800;font-size:14px;text-decoration:none;cursor:pointer;border:1px solid #0a726b}.sc-x{background:#12202f;border-color:#12202f;color:#fff}.sc-copy{background:#fff;color:#0a726b;font-family:inherit}.sc-done{font-size:13px;color:#0a726b;font-weight:700}
.sc-btn{display:inline-block;margin:12px 0 0;padding:10px 18px;border-radius:10px;background:#0a726b;color:#fff;font-weight:800;text-decoration:none}
.ac-stats{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 0}.ac-stats div{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:8px 14px;font-size:13px;color:#cfe2e4}.ac-stats b{display:block;font-size:22px;color:#fff}
@media(max-width:820px){.sc-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>`

const KIND: Record<string, [string, string]> = { gov: ['答弁', 'gov'], q: ['質問', 'q'] }
const ymd = (s: string) => (s || '').replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$1年$2月$3日').replace(/年0/, '年').replace(/月0/, '月')
const cut = (s: string, n: number) => { const t = (s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t }
const nUrl = (id: string) => `${BASE}/n/${id}.html`
const mName = (m: string) => (MIN.find((x) => x[0] === m) || [m, m])[1]

function itemHtml(it: Item): string {
  const tr = it.related.filter((k) => kok[k]).slice(0, 3).map((k) => `<a class="sc-tag k" href="${GIIN}/tracker/${attr(k)}#ref=${REF}-list">国会：${h(kok[k].name)}</a>`).join('')
  return `<article class="sc-item"><h3><a href="${nUrl(it.id)}">${h(it.title)}</a></h3>
<div class="sc-meta"><a class="sc-tag" href="${BASE}/m/${it.ministry}.html">${h(it.ministry_name)}</a>${ymd(it.date)}${it.cat ? '　' + h(it.cat) : ''}${tr}</div></article>`
}

function kokHtml(k: Kok, ref: string): string {
  return `<div class="sc-kok"><h3><a href="${GIIN}/tracker/${attr(k.key)}#ref=${ref}">${h(k.name)}</a> <small class="note">国会での発言 ${k.count.toLocaleString('ja-JP')}件</small></h3><ul>`
    + k.recent.map((s) => `<li><span class="sc-meta"><span class="sc-tag ${KIND[s.kind]?.[1] || ''}">${KIND[s.kind]?.[0] || '発言'}</span>${ymd(s.date)}　${h(s.house)} ${h(s.meeting)}　<b>${h(s.speaker)}</b></span><div>${h(cut(s.body, 110))} <a href="${attr(s.url)}" rel="nofollow noopener" target="_blank">会議録</a></div></li>`).join('')
    + `</ul><p class="note" style="margin:8px 0 0"><a href="${GIIN}/tracker/${attr(k.key)}#ref=${ref}">「${h(k.name)}」の質疑と答弁をすべて見る（国会トラッカー）→</a></p></div>`
}

async function write(rel: string, html: string) {
  const f = path.join(outDir, rel)
  await fs.mkdir(path.dirname(f), { recursive: true })
  await fs.writeFile(f, html)
}
const urls: string[] = []
const linked = items.filter((x) => x.related.some((k) => kok[k]))

// 発表ごと
for (const it of items) {
  const url = nUrl(it.id)
  const ks = it.related.map((k) => kok[k]).filter(Boolean)
  const title = `${cut(it.title, 60)}｜${it.ministry_name}｜Kurage 省庁トラッカー`
  const desc = `${it.ministry_name}が${ymd(it.date)}に公表した「${cut(it.title, 70)}」。${ks.length ? `同じ話題の国会の質疑・答弁（${ks.map((k) => k.name).join('・')}）と並べています。` : '公式ページへのリンクと、同じ分野の発表を並べています。'}`
  const same = items.filter((x) => x.id !== it.id && x.themes.some((t) => it.themes.includes(t))).slice(0, 6)
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">Kurage 省庁トラッカー｜${h(it.ministry_name)}の発表</p><h1 style="font-size:clamp(21px,3.4vw,32px)">${h(it.title)}</h1>
<p class="lead">${h(it.ministry_name)}　${ymd(it.date)}${it.cat ? '　' + h(it.cat) : ''}</p><a class="sc-btn" href="${attr(it.url)}" rel="noopener" target="_blank">${h(it.ministry_name)}の公式ページを開く →</a></div></section>
<div class="wrap"><p class="crumb" style="font-size:13px;color:var(--muted);padding:14px 0 0"><a href="${BASE}/">Kurage 省庁トラッカー</a> › <a href="${BASE}/m/${it.ministry}.html">${h(it.ministry_name)}</a> › 発表</p>
${ks.length ? `<section class="sc-sec"><h2>この話題を国会で追う <small>国会トラッカー</small></h2>${ks.map((k) => kokHtml(k, `${REF}-n-${it.id}`)).join('')}</section>` : ''}
${it.themes.length ? `<section class="sc-sec"><h2>分野</h2><div class="sc-meta" style="font-size:14px">${it.themes.map((t) => `<a class="sc-tag" href="${BASE}/t/${t}.html">${h(tname[t] || t)}</a>`).join('')}</div></section>` : ''}
${same.length ? `<section class="sc-sec"><h2>同じ分野の、ほかの省庁の発表</h2><div class="sc-list">${same.map(itemHtml).join('')}</div></section>` : ''}
<section class="sc-sec"><p class="note">題名・日付・URLは${h(it.ministry_name)}の新着情報（RSS）から機械的に取り込んでいます。内容は必ず公式ページでご確認ください。国会の議論は <a href="${GIIN}/tracker/#ref=${REF}-n">国会トラッカー</a> と同じデータです。</p></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, dateModified: TODAY, about: { '@type': 'GovernmentOrganization', name: it.ministry_name } }]
  const ogi = og({ name: `n-${it.id}`, kind: 'item', kicker: `Kurage 省庁トラッカー｜${it.ministry_name}　${ymd(it.date)}`, title: cut(it.title, 54),
    sub: ks.length ? `国会では：${ks.slice(0, 2).map((k) => k.name).join('・')}` : (it.themes.map((t) => tname[t] || t).join('・') || ''),
    stats: ks.length ? [[ks.reduce((a, k) => a + k.count, 0).toLocaleString('ja-JP'), '同じ話題の国会の質疑・答弁']] : [] })
  const kc = ks.reduce((a, k) => a + k.count, 0)
  const stext = ks.length
    ? `【${it.ministry_name}】${cut(it.title, 60)}（${ymd(it.date)}）\n同じ話題は国会で${kc.toLocaleString('ja-JP')}件。だれが質問し、政府は何と答えた？｜Kurage 省庁トラッカー`
    : `【${it.ministry_name}】${cut(it.title, 60)}（${ymd(it.date)}）\n公式の発表と、同じ分野のほかの省庁の動きを1ページに。｜Kurage 省庁トラッカー`
  await write(`n/${it.id}.html`, shell(title, desc, url, body, ld, ogi, shareBox(stext, url, 'n')))
  urls.push(url)
}

// 府省ごと
for (const [m, name] of MIN) {
  const xs = items.filter((x) => x.ministry === m)
  if (!xs.length) continue
  const url = `${BASE}/m/${m}.html`
  const title = `${name}の新着と国会の議論｜Kurage 省庁トラッカー`
  const desc = `${name}の新着情報（報道発表・会議・資料の公開）${xs.length}件を新しい順に並べ、同じ話題の国会の質疑・答弁へつないでいます。`
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">Kurage 省庁トラッカー</p><h1>${h(name)}の新着</h1><p class="lead">${h(desc)}</p></div></section>
<div class="wrap"><section class="sc-sec"><h2>新しい順 <small>${xs.length}件</small></h2><div class="sc-list">${xs.slice(0, 150).map(itemHtml).join('')}</div></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, description: desc, dateModified: TODAY }]
  const ogi = og({ name: `m-${m}`, kind: 'ministry', kicker: 'Kurage 省庁トラッカー', title: `${name}の新着`, sub: '発表と、同じ話題の国会の議論',
    stats: [[String(xs.length), '発表'], [String(xs.filter((x) => x.related.some((k) => kok[k])).length), '国会トラッカーとつながった']] })
  const nk = xs.filter((x) => x.related.some((k) => kok[k])).length
  const stext = `【${name}】いま出ている発表${xs.length}件を新しい順に。${nk ? `うち${nk}件は、同じ話題を国会でだれが質問し、政府が何と答えたかまでたどれます。` : 'この発表、国会ではどう議論されている？'}｜Kurage 省庁トラッカー`
  await write(`m/${m}.html`, shell(title, desc, url, body, ld, ogi, shareBox(stext, url, 'm')))
  urls.push(url)
}

// 分野ごと
const themeSlugs = [...new Set(items.flatMap((x) => x.themes))]
for (const t of themeSlugs) {
  const xs = items.filter((x) => x.themes.includes(t))
  const ks = [...new Set(xs.flatMap((x) => x.related))].map((k) => kok[k]).filter(Boolean).sort((a, b) => b.count - a.count).slice(0, 6)
  const url = `${BASE}/t/${t}.html`
  const name = tname[t] || t
  const title = `${name}｜省庁の発表と国会の議論｜Kurage 省庁トラッカー`
  const desc = `「${name}」の分野の、各府省の新しい発表${xs.length}件と、同じ分野の国会の質疑・答弁を並べています。`
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">Kurage 省庁トラッカー｜分野</p><h1>${h(name)}</h1><p class="lead">${h(desc)}</p></div></section>
<div class="wrap"><section class="sc-sec"><h2>省庁の発表 <small>${xs.length}件</small></h2><div class="sc-list">${xs.slice(0, 100).map(itemHtml).join('')}</div></section>
${ks.length ? `<section class="sc-sec"><h2>この分野を国会で追う <small>国会トラッカー</small></h2>${ks.map((k) => kokHtml(k, `${REF}-t-${t}`)).join('')}</section>` : ''}
<section class="sc-sec"><p class="note"><a href="${GIIN}/theme/${t}#ref=${REF}-t">「${h(name)}」の国会議員の発言（Kurage 国会議員 発言ログ）→</a></p></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, description: desc, dateModified: TODAY }]
  const ogi = og({ name: `t-${t}`, kind: 'theme', kicker: 'Kurage 省庁トラッカー｜分野', title: name, sub: '省庁の発表 × 国会の議論',
    stats: [[String(xs.length), '省庁の発表'], [ks.reduce((a, k) => a + k.count, 0).toLocaleString('ja-JP'), '国会の質疑・答弁']] })
  const kc = ks.reduce((a, k) => a + k.count, 0)
  const stext = `「${name}」で、各省庁はいま何を出している？発表${xs.length}件と、国会の質疑・答弁${kc.toLocaleString('ja-JP')}件を1ページに並べました。｜Kurage 省庁トラッカー`
  await write(`t/${t}.html`, shell(title, desc, url, body, ld, ogi, shareBox(stext, url, 't')))
  urls.push(url)
}

// トップ
{
  const url = `${BASE}/`
  const desc = `デジタル庁・国土交通省・厚生労働省・農林水産省・文部科学省・総務省・内閣府・金融庁の新着情報を毎日取り込み、発表ごとに同じ話題の国会の質疑・答弁を並べます。国会トラッカーの側からも、省庁の新しい発表へたどれます。`
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">省庁の発表 × 国会の議論</p><h1>Kurage 省庁トラッカー</h1><p class="lead">${h(desc)}</p>
<div class="ac-stats"><div><b>${items.length.toLocaleString('ja-JP')}</b>発表</div><div><b>${MIN.length}</b>府省</div><div><b>${linked.length}</b>国会トラッカーとつながった</div></div></div></section>
<div class="wrap"><section class="sc-sec"><h2>府省</h2><div class="sc-cards">${MIN.map(([m, n]) => `<a class="sc-card" href="${BASE}/m/${m}.html"><b>${h(n)}</b><span>${items.filter((x) => x.ministry === m).length}件</span></a>`).join('')}</div></section>
<section class="sc-sec"><h2>国会の議論とつながった発表 <small>${linked.length}件</small></h2><div class="sc-list">${linked.slice(0, 30).map(itemHtml).join('')}</div></section>
<section class="sc-sec"><h2>分野</h2><div class="sc-cards">${themeSlugs.map((t) => `<a class="sc-card" href="${BASE}/t/${t}.html"><b>${h(tname[t] || t)}</b><span>${items.filter((x) => x.themes.includes(t)).length}件</span></a>`).join('')}</div></section>
<section class="sc-sec"><h2>新着 <small>すべての府省</small></h2><div class="sc-list">${items.slice(0, 40).map(itemHtml).join('')}</div></section>
<section class="sc-sec"><p class="note">題名・日付・URLは各府省の新着情報（RSS）から機械的に取り込み、本文は持っていません。内容は必ず各府省の公式ページでご確認ください。国会の議論は <a href="${GIIN}/tracker/#ref=${REF}-index">Kurage 国会トラッカー</a> と同じデータです。</p></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Kurage 省庁トラッカー｜省庁の発表と国会の議論', url, description: desc, dateModified: TODAY }]
  const ogi = og({ name: 'index', kind: 'index', kicker: '省庁の発表 × 国会の議論', title: 'Kurage 省庁トラッカー',
    stats: [[items.length.toLocaleString('ja-JP'), '発表'], [String(MIN.length), '府省'], [String(linked.length), '国会とつながった']] })
  const stext = `省庁の発表と国会の議論が、1ページでつながる。デジタル庁・厚労省・国交省など${MIN.length}府省の新着${items.length}件から、同じ話題を国会でだれが質問し、政府が何と答えたかまでたどれます。｜Kurage 省庁トラッカー`
  await write('index.html', shell('Kurage 省庁トラッカー｜省庁の発表と国会の議論', desc, url, body, ld, ogi, shareBox(stext, url, 'top')))
  urls.unshift(url)
}

await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`)
await fs.writeFile(path.join(root, 'outputs', 'shocho-ogp-specs.json'), JSON.stringify(ogSpecs, null, 1))
console.log(`shocho: 発表 ${items.length}・国会とつながった ${linked.length}・計 ${urls.length} ページ → ${outDir}`)
