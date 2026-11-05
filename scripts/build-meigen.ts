/**
 * exbridge.jp/meigen/ — Kurage 名言トラッカー（頑張っている人・つらい人に、名言で応援のコメントを贈る）。
 *
 * 何のためか（2026-11-03 ユーザー「頑張ってる人、つらい人を、名言コメントで応援するための Kurage 名言トラッカー作りたい」）:
 * X で返信するときに、名言のページの URL を貼ると、名言のカード（@xb_bittensor と Kurage 入り）が出る。
 * 出典を一字一句確かめた言葉だけを載せる（名言サイトにある「出所の疑わしい有名な言葉」は載せない）。
 *
 * データ: /home/kojima/work/kmeigen/data/quotes.json（名言・場面）と verified.json（出典の照合・国会で引かれた発言）
 *         照合は kmeigen/scripts/verify.py。照合できなかった名言はページに出さない
 * 出力:   /home/kojima/work/exbridge_jp/meigen/{index.html, t/<場面>.html, q/<id>.html, sitemap.xml}
 * 画像:   outputs/meigen-ogp-specs.json → scripts/make_meigen_ogp.py
 * 配置:   bash scripts/deploy.sh meigen
 *   npx tsx scripts/build-meigen.ts
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE } from './site'
import { TODAY, h, attr, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KM = '/home/kojima/work/kmeigen/data'
const outDir = '/home/kojima/work/exbridge_jp/meigen'
const BASE = `${SITE}/meigen`
const REF = 'meigen'
const GIIN = 'https://xb4g.com/giin'

type Theme = { slug: string; name: string; lead: string }
type Quote = { id: string; speaker: string; speaker_note: string; text: string; original?: string; work: string; year: string; kind: string; source_url: string; source_label: string; themes: string[]; note: string }
type Speech = { date: string; house: string; meeting: string; speaker: string; group: string; position: string; url: string; excerpt: string }
type Ver = { ok: boolean; how: string; checked: string; kokkai?: { count?: number; first?: string; recent?: Speech[]; more?: boolean } }

const src = JSON.parse(await fs.readFile(path.join(KM, 'quotes.json'), 'utf8')) as { themes: Theme[]; quotes: Quote[] }
const ver = JSON.parse(await fs.readFile(path.join(KM, 'verified.json'), 'utf8')) as Record<string, Ver>
const themes = src.themes
const quotes = src.quotes.filter((q) => ver[q.id]?.ok)   // 出典と照合できたものだけ
const tname = Object.fromEntries(themes.map((t) => [t.slug, t.name]))
const KIND: Record<string, string> = { aozora: '青空文庫で照合', wikiquote: 'Wikiquote で照合', press: '報道で照合', kokkai: '国会会議録で照合' }

const FOOT = `<a href="${SITE}/company">会社概要</a>　<a href="${BASE}/">Kurage 名言トラッカー</a>　<a href="${GIIN}/tracker/#ref=${REF}-foot">Kurage 国会トラッカー</a>　<a href="${SITE}/ai-sns-komon.html#ref=${REF}-foot">AI-SNS顧問</a>　<a href="${SITE}/contact.php">お問い合わせ</a>`
type OgSpec = { name: string; kind: string; text: string; speaker: string; work: string; theme?: string }
const ogSpecs: OgSpec[] = []
function og(spec: OgSpec): string {
  ogSpecs.push(spec)
  const v = crypto.createHash('sha1').update(JSON.stringify(spec)).digest('hex').slice(0, 8)
  return `${SITE}/images/meigen/${spec.name}.png?v=${v}`
}
const one = (s: string) => s.replace(/\n/g, '　')
const cut = (s: string, n: number) => { const t = one(s).trim(); return t.length > n ? t.slice(0, n) + '…' : t }
const ymd = (s: string) => (s || '').replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$1年$2月$3日').replace(/年0/, '年').replace(/月0/, '月')
const qUrl = (id: string) => `${BASE}/q/${id}.html`
const by = (q: Quote) => `${q.speaker}${q.work ? `『${q.work}』` : ''}`

const xw = (t: string) => [...t].reduce((a, c) => a + (c.charCodeAt(0) < 0x1100 ? 1 : 2), 0)
function shareBox(text: string, url: string, kind: string, label = 'この言葉で応援する'): string {
  let t = text
  while (xw(t) + 24 > 280 && t.length > 20) t = t.slice(0, -2)
  const x = `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(`${url}#ref=x-share-${REF}-${kind}`)}`
  const copy = `${t}\n${url}#ref=copy-${REF}-${kind}`
  return `<div class="wrap"><div class="mg-share"><b>${h(label)}</b><a class="mg-x" href="${attr(x)}" target="_blank" rel="noopener">Xで共有</a>`
    + `<button type="button" class="mg-copy" data-copy="${attr(copy)}">言葉とURLをコピー</button><span class="mg-done" hidden>コピーしました</span></div></div>`
}
const SHARE_JS = `<script>document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.mg-copy');if(!b)return;var t=b.getAttribute('data-copy');function ok(){var d=b.parentNode.querySelector('.mg-done');if(d){d.hidden=false;setTimeout(function(){d.hidden=true},2500)}}if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(ok)}else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();ok()}});</script>`
const splitHero = (b: string) => { const i = b.indexOf('</section>'); return i < 0 ? [b, ''] : [b.slice(0, i + 10), b.slice(i + 10)] }
const shell = (t: string, d: string, u: string, b: string, l: unknown[], ogImage: string, share = '') => {
  const [hero, rest] = splitHero(b)
  return baseShell(t, d, u, hero + share + rest + SHARE_JS, l, { refPrefix: REF, base: BASE, footerLinks: FOOT, ogImage })
}

const CSS = `<style>
.hero .kicker::before{content:"";display:inline-block;width:26px;height:30px;margin-right:7px;vertical-align:-9px;background:url(https://kurage.exbridge.jp/images/kurage-mascot-cutout-300.webp) center/contain no-repeat}
.mg-sec{padding:26px 0 6px}.mg-sec>h2{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mg-sec>h2 small{font-size:13px;color:var(--muted);font-weight:700}
.mg-quote{font-family:"Noto Serif JP","Hiragino Mincho ProN",serif;font-size:clamp(22px,3.6vw,34px);line-height:1.7;font-weight:700;white-space:pre-line;overflow-wrap:anywhere;margin:6px 0 10px}
.mg-by{font-size:15px;color:#cfe2e4}.mg-by b{color:#fff;font-size:17px}
.mg-list{display:grid;gap:12px}
.mg-card{display:block;background:#fff;border:1px solid var(--line);border-left:5px solid #0a9a8f;border-radius:12px;padding:14px 18px;text-decoration:none;color:var(--ink)}
.mg-card:hover{border-color:#0a9a8f}.mg-card q{display:block;quotes:none;font-family:"Noto Serif JP","Hiragino Mincho ProN",serif;font-size:17px;line-height:1.7;font-weight:700;white-space:pre-line;overflow-wrap:anywhere}
.mg-card span{display:block;margin-top:6px;font-size:13px;color:var(--muted)}
.mg-tag{display:inline-block;font-size:12px;font-weight:800;border-radius:999px;padding:2px 10px;background:#e6f4f6;color:#00687b;text-decoration:none;margin:0 6px 6px 0}
.mg-box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:0 0 12px}
.mg-box dl{display:grid;grid-template-columns:7em minmax(0,1fr);gap:8px 12px;margin:0;font-size:14.5px}.mg-box dt{font-weight:800;color:var(--muted)}.mg-box dd{margin:0;overflow-wrap:anywhere}
.mg-box p{margin:6px 0;font-size:14.5px;line-height:1.8}
.mg-kok li{padding:9px 0;border-top:1px dotted var(--line);font-size:14px;list-style:none}.mg-kok li:first-child{border-top:0}.mg-kok ul{margin:0;padding:0}
.mg-themes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}
.mg-themes a{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--ink)}.mg-themes b{display:block;font-size:15.5px}.mg-themes span{font-size:12.5px;color:var(--muted)}
.mg-share{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0 0;padding:12px 14px;background:#e6f7f3;border:1px solid #bcecd3;border-radius:12px}.mg-share b{font-size:14px;margin-right:4px}
.mg-x,.mg-copy{display:inline-flex;align-items:center;min-height:40px;padding:8px 16px;border-radius:999px;font-weight:800;font-size:14px;text-decoration:none;cursor:pointer;border:1px solid #0a726b}.mg-x{background:#12202f;border-color:#12202f;color:#fff}.mg-copy{background:#fff;color:#0a726b;font-family:inherit}.mg-done{font-size:13px;color:#0a726b;font-weight:700}
@media(max-width:520px){.mg-box dl{grid-template-columns:1fr}.mg-box dd{margin:0 0 6px}}
</style>`

async function write(rel: string, html: string) {
  const f = path.join(outDir, rel)
  await fs.mkdir(path.dirname(f), { recursive: true })
  await fs.writeFile(f, html)
}
const urls: string[] = []
const lastmod: Record<string, string> = {}
const card = (q: Quote, ref: string) => `<a class="mg-card" href="${qUrl(q.id)}#ref=${REF}-${ref}"><q>${h(q.text)}</q><span>${h(by(q))}${q.year ? `　${h(q.year)}` : ''}</span></a>`

function kokHtml(q: Quote, v: Ver): string {
  const k = v.kokkai
  if (!k || !k.count) return ''
  const rows = (k.recent || []).map((s) => `<li><b>${h(s.speaker)}</b>${s.group ? `（${h(s.group.replace(/・無所属.*$/, ''))}）` : ''}　${ymd(s.date)}　${h(s.house)} ${h(s.meeting)}<div>…${h(s.excerpt)}… <a href="${attr(s.url)}" rel="nofollow noopener" target="_blank">会議録</a></div></li>`).join('')
  return `<section class="mg-sec"><h2>国会でこの言葉を引いた人 <small>${k.count}件${k.more ? '以上' : ''}${k.first ? `・${ymd(k.first)}から` : ''}</small></h2><div class="mg-box mg-kok"><ul>${rows}</ul>`
    + `<p class="note" style="margin:10px 0 0">国立国会図書館の国会会議録検索システムで、本文にこの言葉がある発言だけを数えました。国会でだれが何を質問し、政府が何と答えたかは <a href="${GIIN}/tracker/#ref=${REF}-q-${q.id}">Kurage 国会トラッカー</a> で読めます。</p></div></section>`
}

// 名言ごと
for (const q of quotes) {
  const v = ver[q.id]
  const url = qUrl(q.id)
  const title = `「${cut(q.text, 26)}」${q.speaker}の名言｜Kurage 名言トラッカー`
  const desc = `${by(q)}の言葉「${cut(q.text, 60)}」。${q.kind === 'wikiquote' ? `原文を出典（${q.source_label}）で確かめた名言` : `出典（${q.source_label}）で一字一句確かめた名言`}と、その意味・背景。${q.themes.map((t) => tname[t]).join('・')}に、応援のコメントとして贈れます。`
  // 同じ場面の言葉。いつも先頭の6件にならないよう、重なる場面の数→名言ごとに決まった順で選ぶ（2026-11-05 267件に増やしたとき）
  const mix = (a: string) => crypto.createHash('sha1').update(q.id + a).digest('hex')
  const same = quotes.filter((x) => x.id !== q.id && x.themes.some((t) => q.themes.includes(t)))
    .map((x) => ({ x, n: x.themes.filter((t) => q.themes.includes(t)).length, k: mix(x.id) }))
    .sort((a, b) => b.n - a.n || (a.k < b.k ? -1 : 1)).slice(0, 6).map((o) => o.x)
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">Kurage 名言トラッカー｜${q.themes.map((t) => h(tname[t])).join('・')}</p>
<p class="mg-quote">${h(q.text)}</p><p class="mg-by"><b>${h(q.speaker)}</b>（${h(q.speaker_note)}）　${h(q.work)}${q.year ? `・${h(q.year)}` : ''}</p></div></section>
<div class="wrap"><p class="crumb" style="font-size:13px;color:var(--muted);padding:14px 0 0"><a href="${BASE}/">Kurage 名言トラッカー</a> › ${q.themes.map((t) => `<a href="${BASE}/t/${t}.html">${h(tname[t])}</a>`).join('・')}</p>
<section class="mg-sec"><h2>この言葉について</h2><div class="mg-box"><p>${h(q.note)}</p>${q.original ? `<p class="note">原文：${h(q.original)}</p>` : ''}</div></section>
<section class="mg-sec"><h2>出典</h2><div class="mg-box"><dl><dt>言った人</dt><dd>${h(q.speaker)}（${h(q.speaker_note)}）</dd><dt>作品・場面</dt><dd>${h(q.work)}${q.year ? `（${h(q.year)}）` : ''}</dd>
<dt>出典</dt><dd><a href="${attr(q.source_url)}" rel="noopener" target="_blank">${h(q.source_label)}</a></dd><dt>確かめ方</dt><dd>${h(v.how)}（${ymd(v.checked)}）</dd></dl></div></section>
${kokHtml(q, v)}
${same.length ? `<section class="mg-sec"><h2>同じ場面に贈れる、ほかの言葉</h2><div class="mg-list">${same.map((x) => card(x, `q-${q.id}`)).join('')}</div></section>` : ''}
<section class="mg-sec"><p class="note">Kurage 名言トラッカーは、出典の本文と照らし合わせて確かめた言葉だけを載せています。名言のサイトで有名でも、本人の記録が見つからない言葉は載せていません。外国語の言葉の訳は当社によるものです。</p></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'Quotation', text: one(q.text), creator: { '@type': 'Person', name: q.speaker }, isPartOf: { '@type': 'CreativeWork', name: q.work }, url, citation: q.source_url }]
  const ogi = og({ name: `q-${q.id}`, kind: 'quote', text: q.text, speaker: q.speaker, work: q.work, theme: tname[q.themes[0]] })
  const stext = `${q.speaker}の言葉を贈ります。\n「${cut(q.text, 90)}」`
  await write(`q/${q.id}.html`, shell(title, desc, url, body, ld, ogi, shareBox(stext, url, 'q')))
  urls.push(url)
  lastmod[url] = v.checked
}

// 場面ごと
for (const t of themes) {
  const xs = quotes.filter((q) => q.themes.includes(t.slug))
  if (!xs.length) continue
  const url = `${BASE}/t/${t.slug}.html`
  const title = `${t.name}に贈る名言${xs.length}選｜出典つき｜Kurage 名言トラッカー`
  const desc = `${t.lead}出典を一字一句確かめた名言${xs.length}件。${xs.slice(0, 3).map((q) => q.speaker).join('・')}ほか。`
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">Kurage 名言トラッカー｜場面</p><h1>${h(t.name)}に贈る言葉</h1><p class="lead">${h(t.lead)}</p></div></section>
<div class="wrap"><section class="mg-sec"><h2>${h(t.name)}の言葉 <small>${xs.length}件</small></h2><div class="mg-list">${xs.map((q) => card(q, `t-${t.slug}`)).join('')}</div></section>
<section class="mg-sec"><h2>ほかの場面</h2><div class="mg-themes">${themes.filter((x) => x.slug !== t.slug).map((x) => `<a href="${BASE}/t/${x.slug}.html"><b>${h(x.name)}</b><span>${quotes.filter((q) => q.themes.includes(x.slug)).length}件</span></a>`).join('')}</div></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, description: desc, dateModified: TODAY }]
  const first = xs[0]
  const ogi = og({ name: `t-${t.slug}`, kind: 'theme', text: first.text, speaker: first.speaker, work: first.work, theme: `${t.name}に贈る言葉` })
  await write(`t/${t.slug}.html`, shell(title, desc, url, body, ld, ogi, shareBox(`${t.name}に贈りたい言葉を、出典つきで${xs.length}件集めました。｜Kurage 名言トラッカー`, url, 't', 'このページを贈る')))
  urls.push(url)
  lastmod[url] = xs.map((q) => ver[q.id].checked).sort().pop() || TODAY
}

// トップ
{
  const url = `${BASE}/`
  const nk = quotes.filter((q) => ver[q.id].kokkai?.count).length
  const desc = `頑張っている人、つらい思いをしている人に、名言で応援のコメントを贈るための名言集です。宮沢賢治・夏目漱石・福沢諭吉から、リンカーン・ヘレン・ケラー・マンデラ、大谷翔平・イチロー・羽生結弦、首相の施政方針演説まで、出典と照らし合わせて確かめた言葉${quotes.length}件を、${themes.length}の場面ごとに並べました。国会で引かれた回数も載せています。`
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">頑張っている人・つらい人に、言葉を贈る</p><h1>Kurage 名言トラッカー</h1><p class="lead">${h(desc)}</p></div></section>
<div class="wrap"><section class="mg-sec"><h2>場面から選ぶ</h2><div class="mg-themes">${themes.map((t) => `<a href="${BASE}/t/${t.slug}.html"><b>${h(t.name)}</b><span>${quotes.filter((q) => q.themes.includes(t.slug)).length}件</span></a>`).join('')}</div></section>
<section class="mg-sec"><h2>使い方</h2><div class="mg-box"><p>X で、頑張っている人やつらい思いをしている人にコメントするとき、名言のページの「言葉とURLをコピー」を押して貼ってください。返信に、名言のカード画像が出ます。</p>
<p>載せているのは、出典の本文と照らし合わせて確かめた言葉だけです。青空文庫の作品は本文と一字一句、外国の言葉は英語版 Wikiquote で「出典のある言葉」の節にあるか、現代の人の言葉は報道の記事本文で、国会の言葉は国会会議録の本文で確かめています。名言のサイトで有名でも、本人の記録が見つからない言葉（例：エジソンの「失敗したのではない、うまくいかない方法を1万通り見つけたのだ」）は載せていません。</p></div></section>
<section class="mg-sec"><h2>すべての言葉 <small>${quotes.length}件・国会で引かれた言葉 ${nk}件</small></h2><div class="mg-list">${quotes.map((q) => card(q, 'index')).join('')}</div></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Kurage 名言トラッカー', url, description: desc, dateModified: TODAY }]
  const first = quotes[0]
  const ogi = og({ name: 'index', kind: 'index', text: first.text, speaker: first.speaker, work: first.work, theme: '頑張っている人・つらい人に、言葉を贈る' })
  await write('index.html', shell('Kurage 名言トラッカー｜頑張っている人・つらい人に贈る、出典つきの名言', desc, url, body, ld, ogi, shareBox(`頑張っている人、つらい人に贈る言葉を、出典を一字一句確かめて${quotes.length}件集めました。｜Kurage 名言トラッカー`, url, 'top', 'このページを贈る')))
  urls.unshift(url)
  lastmod[url] = Object.values(lastmod).sort().pop() || TODAY
}

await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod[u] || TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`)
await fs.writeFile(path.join(root, 'outputs', 'meigen-ogp-specs.json'), JSON.stringify(ogSpecs, null, 1))
console.log(`meigen: 名言 ${quotes.length}/${src.quotes.length}（照合できたもの）・計 ${urls.length} ページ → ${outDir}`)
