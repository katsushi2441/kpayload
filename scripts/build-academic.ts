/**
 * exbridge.jp/academic/ — 論文トラッカー（東海の大学の研究と、国会の議論を1ページに並べる）。
 *
 * 何のためか（2026-10-21）: 国会トラッカーの「誰が質問し、政府がどう答えたか」に、
 * 「東海の大学の研究者が何を研究しているか」を並べる。研究者に「この研究は国会のこの議論とつながっている」と
 * データで示し、X で学者とつながる材料にする。xb4g.com は検索に弱いので exbridge.jp に置く（GSC 28日 xb4g 11クリック／exbridge.jp 468）。
 *
 * データ: data/academic/themes.json → scripts/academic-fetch.py（OpenAlex・KAKEN・国会トラッカー）
 *         → scripts/academic-summarize.py（gemma4 で英語論文に日本語の題名と1文の要約）
 * 出力:   /home/kojima/work/exbridge_jp/academic/{index.html, theme/<slug>.html, researcher/<crid>.html, sitemap.xml}
 * 配置:   bash scripts/deploy.sh academic
 *   npx tsx scripts/build-academic.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE } from './site'
import { TODAY, h, attr, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data', 'academic')
const outDir = '/home/kojima/work/exbridge_jp/academic'
const BASE = `${SITE}/academic`
const REF = 'academic'
const GIIN = 'https://xb4g.com/giin'

type Author = { name: string; openalex: string; orcid: string | null; tokai: string[] }
type Work = { id: string; doi: string | null; title: string; date: string; type: string; venue: string | null; url: string; cited: number; abstract: string; lang: string | null; topic: string | null; authors: Author[]; group: string }
type Res = { name: string; crid: string; affiliation: string; role: string; tokai: string }
type Proj = { crid: string; title: string; since: string; until: string; program: string; category: string | null; outline: string; url: string; researchers: Res[]; word: string }
type Speech = { tracker: string; date: string; house: string; meeting: string; speaker: string; kind: string; url: string; body: string }
type Kok = { key: string; name: string; count: number; recent: Speech[] }
type Theme = { slug: string; name: string; seo_title: string; lead: string; trackers: string[]; kaken_must?: string }
type Data = { theme: Theme; fetched: string; works: Work[]; projects: Proj[]; kokkai: Kok[] }
type Sum = { title_ja: string; summary_ja: string }

const themes = JSON.parse(await fs.readFile(path.join(dataDir, 'themes.json'), 'utf8')) as Theme[]
const sums = JSON.parse(await fs.readFile(path.join(dataDir, 'summaries.json'), 'utf8').catch(() => '{}')) as Record<string, Sum>
const all: Data[] = []
for (const t of themes) {
  const f = path.join(dataDir, `${t.slug}.json`)
  let d: Data
  try { d = JSON.parse(await fs.readFile(f, 'utf8')) } catch { console.log('データなし', t.slug); continue }
  // KAKEN の検索は語の一致がゆるく、テーマ外の研究課題も混ざる。題名か概要にテーマの語があるものだけ残す
  if (t.kaken_must) { const re = new RegExp(t.kaken_must); d.projects = d.projects.filter((p) => re.test((p.title || '') + (p.outline || ''))) }
  d.theme = { ...d.theme, ...t }
  all.push(d)
}

const FOOT = `<a href="${SITE}/company">会社概要</a>　<a href="${BASE}/">論文トラッカー</a>　<a href="${GIIN}/tracker/#ref=${REF}-foot">国会トラッカー</a>　<a href="${SITE}/ai-it-komon.html#ref=${REF}-foot">AI-IT顧問</a>　<a href="${SITE}/ai-sns-komon.html#ref=${REF}-foot">AI-SNS顧問</a>　<a href="${SITE}/contact.php">お問い合わせ</a>`
const shell = (t: string, d: string, u: string, b: string, l: unknown[]) => baseShell(t, d, u, b, l, { refPrefix: REF, base: BASE, footerLinks: FOOT })

const CSS = `<style>
.ac-sec{padding:26px 0 6px}.ac-sec>h2{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.ac-sec>h2 small{font-size:13px;color:var(--muted);font-weight:700}
.ac-list{display:grid;gap:12px}
.ac-item{background:#fff;border:1px solid var(--line);border-radius:12px;padding:15px 17px}
.ac-item h3{font-size:16px;line-height:1.55;margin:0 0 4px}.ac-item h3 a{color:var(--ink);text-decoration:none}.ac-item h3 a:hover{text-decoration:underline}
.ac-item .orig{font-size:12.5px;color:var(--muted);margin:0 0 6px;overflow-wrap:anywhere}
.ac-item .sum{font-size:14px;margin:6px 0 0}
.ac-meta{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12.5px;color:var(--muted)}
.ac-tag{display:inline-block;font-size:11.5px;font-weight:800;border-radius:999px;padding:1px 9px;background:#e6f4f6;color:#00687b}
.ac-tag.gov{background:#fff4dc;color:#8a5a00}.ac-tag.q{background:#eaf0fb;color:#1f4f9a}
.ac-who a{font-weight:700}
.ac-kok{background:#fff;border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:12px;padding:15px 17px}
.ac-kok h3{margin:0 0 8px}.ac-kok ul{margin:0;padding:0;list-style:none}.ac-kok li{padding:8px 0;border-top:1px dotted var(--line);font-size:14px}
.ac-kok li:first-child{border-top:0}
.ac-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ac-card{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--ink)}
.ac-card b{display:block;font-size:15px}.ac-card span{font-size:12.5px;color:var(--muted)}
.ac-stats{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 0}.ac-stats div{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:8px 14px;font-size:13px;color:#cfe2e4}.ac-stats b{display:block;font-size:22px;color:#fff}
@media(max-width:820px){.ac-cards{grid-template-columns:1fr}}
</style>`

const KIND: Record<string, [string, string]> = { gov: ['答弁', 'gov'], q: ['質問', 'q'], ref: ['参考人', ''], chair: ['委員長', ''], other: ['発言', ''] }
const ymd = (s: string) => (s || '').replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$1年$2月$3日').replace(/^(\d{4})-(\d{2})$/, '$1年$2月').replace(/年0/, '年').replace(/月0/, '月')
const cut = (s: string, n: number) => { const t = (s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t }
const rUrl = (crid: string) => `${BASE}/researcher/${crid}.html`

/** 東海の研究者（KAKEN の研究課題に出てくる人）を集める。研究者のページはこの人たちだけ作る。 */
type Person = { crid: string; name: string; affiliation: string; tokai: string; projects: { p: Proj; theme: Theme; role: string }[] }
const people = new Map<string, Person>()
for (const d of all) for (const p of d.projects) for (const r of p.researchers) {
  if (!r.tokai || !r.crid || !r.name) continue
  const x = people.get(r.crid) || { crid: r.crid, name: r.name, affiliation: r.affiliation, tokai: r.tokai, projects: [] }
  if (!x.projects.some((y) => y.p.crid === p.crid)) x.projects.push({ p, theme: d.theme, role: r.role })
  people.set(r.crid, x)
}
const roleJa = (r: string) => (r === 'principal_investigator' ? '研究代表者' : r === 'co_investigator_buntan' ? '研究分担者' : r === 'co_investigator_renkei' ? '連携研究者' : '研究者')

function kokHtml(d: Data): string {
  return d.kokkai.filter((k) => k.count).map((k) => `<div class="ac-kok"><h3><a href="${GIIN}/tracker/${attr(k.key)}#ref=${REF}-${d.theme.slug}">${h(k.name)}</a> <small class="note">国会での発言 ${k.count}件</small></h3><ul>`
    + k.recent.slice(0, 3).map((s) => `<li><span class="ac-meta"><span class="ac-tag ${KIND[s.kind]?.[1] || ''}">${KIND[s.kind]?.[0] || '発言'}</span>${ymd(s.date)}　${h(s.house)} ${h(s.meeting)}　<b>${h(s.speaker)}</b></span><div>${h(cut(s.body, 110))} <a href="${attr(s.url)}" rel="nofollow noopener" target="_blank">会議録</a></div></li>`).join('')
    + `</ul><p class="note" style="margin:8px 0 0"><a href="${GIIN}/tracker/${attr(k.key)}#ref=${REF}-${d.theme.slug}">「${h(k.name)}」の質疑と答弁をすべて見る（国会トラッカー）→</a></p></div>`).join('\n')
}

function projHtml(p: Proj, withPeople = true): string {
  const who = p.researchers.filter((r) => r.name).map((r) => r.tokai && people.has(r.crid)
    ? `<a href="${rUrl(r.crid)}">${h(r.name)}</a>（${h(r.affiliation)}・${roleJa(r.role)}）`
    : `${h(r.name)}（${h(r.affiliation || '所属不明')}）`).slice(0, 4).join('、')
  return `<article class="ac-item"><h3><a href="${attr(p.url)}" rel="noopener" target="_blank">${h(p.title)}</a></h3>
<div class="ac-meta"><span class="ac-tag">科研費</span>${h(p.program || '')}${p.category ? '・' + h(p.category) : ''}　${ymd(p.since)}〜${ymd(p.until)}</div>
${withPeople ? `<div class="ac-meta ac-who" style="margin-top:4px">${who}</div>` : ''}
${p.outline ? `<p class="sum">${h(cut(p.outline, 170))}</p>` : ''}</article>`
}

function workHtml(w: Work): string {
  const s = sums[w.id]
  const tok = w.authors.filter((a) => a.tokai.length).map((a) => `${h(a.name)}（${h(a.tokai[0])}）`).slice(0, 4).join('、')
  return `<article class="ac-item"><h3><a href="${attr(w.url)}" rel="noopener" target="_blank">${h(s?.title_ja || w.title)}</a></h3>
${s && s.title_ja !== w.title ? `<p class="orig">${h(w.title)}</p>` : ''}
<div class="ac-meta"><span class="ac-tag">論文</span>${ymd(w.date)}${w.venue ? '　' + h(w.venue) : ''}${w.cited ? `　被引用 ${w.cited}` : ''}</div>
<div class="ac-meta ac-who" style="margin-top:4px">東海の大学の著者：${tok}</div>
${s?.summary_ja ? `<p class="sum">${h(s.summary_ja)}</p>` : ''}</article>`
}

async function write(rel: string, html: string) {
  const f = path.join(outDir, rel)
  await fs.mkdir(path.dirname(f), { recursive: true })
  await fs.writeFile(f, html)
}

const urls: string[] = []

// テーマのページ
for (const d of all) {
  const t = d.theme
  const url = `${BASE}/theme/${t.slug}.html`
  const nKok = d.kokkai.reduce((a, k) => a + k.count, 0)
  const projs = [...d.projects].sort((a, b) => (b.since || '').localeCompare(a.since || ''))
  const works = [...d.works].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const univs = new Set([...projs.flatMap((p) => p.researchers.map((r) => r.tokai)), ...works.flatMap((w) => w.authors.flatMap((a) => a.tokai))].filter(Boolean))
  const desc = `${t.name}について、東海三県の大学の科研費の研究${projs.length}件・論文${works.length}本と、国会での質疑と答弁${nKok}件を並べました。研究者ごとのページから、研究と国会の議論のつながりをたどれます。`
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">論文トラッカー｜東海の大学の研究 × 国会の議論</p><h1>${h(t.name)}の研究と、国会の議論</h1><p class="lead">${h(t.lead)}</p>
<div class="ac-stats"><div><b>${projs.length}</b>科研費の研究</div><div><b>${works.length}</b>論文</div><div><b>${univs.size}</b>大学</div><div><b>${nKok}</b>国会の質疑・答弁</div></div></div></section>
<div class="wrap"><p class="crumb"><a href="${BASE}/">論文トラッカー</a> › ${h(t.name)}</p>
<section class="ac-sec"><h2>国会では <small>国会トラッカーの記録から（最新3件ずつ）</small></h2><div class="ac-list">${kokHtml(d)}</div></section>
<section class="ac-sec"><h2>東海の研究者の科研費の研究 <small>${projs.length}件・新しい順</small></h2><p class="note">科学研究費助成事業（科研費）で採択された研究課題のうち、東海三県の大学の研究者が代表・分担しているものです。名前を押すと、研究者ごとのページを開きます。</p><div class="ac-list">${projs.map((p) => projHtml(p)).join('\n')}</div></section>
<section class="ac-sec"><h2>東海の大学の著者がいる論文 <small>${works.length}本・新しい順</small></h2><p class="note">日本語の題名と要約は、論文の要旨をもとに当社が付けたものです（要旨が公開されていない論文は題名だけ）。正確な内容は、題名のリンクから原文を確かめてください。</p><div class="ac-list">${works.map(workHtml).join('\n')}</div></section>
<section class="ac-sec"><div class="cta"><h2 style="margin:0 0 6px">研究と国会の議論を、つなげて見せる</h2><p style="margin:0">このページは、国会トラッカーと同じしくみで、当社が自動で集めて作っています。研究室や大学の広報、自治体の政策づくりで「この研究は国会でどう議論されているか」を示す資料が必要なときは、ご相談ください。</p><div class="kit-actions"><a class="btn btn-main" href="${SITE}/contact.php">相談する</a><a class="btn" href="${SITE}/ai-sns-komon.html#ref=${REF}-cta">AI-SNS顧問</a><a class="btn" href="${SITE}/ai-it-komon.html#ref=${REF}-cta">AI-IT顧問</a></div></div>
<p class="note">出典：OpenAlex（CC0）、CiNii Research・KAKEN（国立情報学研究所）、国会会議録検索システム（国立国会図書館）。データ取得 ${ymd(d.fetched)}。</p></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: t.seo_title, url, description: desc, dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: SITE },
    mainEntity: { '@type': 'ItemList', numberOfItems: works.length, itemListElement: works.slice(0, 30).map((w, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'ScholarlyArticle', name: w.title, url: w.url, datePublished: w.date } })) } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '論文トラッカー', item: `${BASE}/` }, { '@type': 'ListItem', position: 2, name: t.name, item: url }] }]
  await write(`theme/${t.slug}.html`, shell(t.seo_title, desc, url, body, ld))
  urls.push(url)
}

// 研究者のページ
for (const p of people.values()) {
  const url = rUrl(p.crid)
  const themesOf = [...new Map(p.projects.map((x) => [x.theme.slug, x.theme])).values()]
  const title = `${p.name}（${p.affiliation}）の研究と国会の議論｜論文トラッカー`
  const desc = `${p.affiliation}の${p.name}さんの科研費の研究${p.projects.length}件（${themesOf.map((t) => t.name).join('・')}）と、同じテーマの国会での質疑・答弁をまとめました。`
  const kok = all.filter((d) => themesOf.some((t) => t.slug === d.theme.slug)).flatMap((d) => d.kokkai.filter((k) => k.count))
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">論文トラッカー｜東海の大学の研究者</p><h1>${h(p.name)}</h1><p class="lead">${h(p.affiliation)}　科研費の研究 ${p.projects.length}件（${h(themesOf.map((t) => t.name).join('・'))}）</p></div></section>
<div class="wrap"><p class="crumb"><a href="${BASE}/">論文トラッカー</a> › ${themesOf.map((t) => `<a href="${BASE}/theme/${t.slug}.html">${h(t.name)}</a>`).join('・')} › ${h(p.name)}</p>
<section class="ac-sec"><h2>科研費の研究</h2><div class="ac-list">${p.projects.map((x) => projHtml(x.p).replace('</article>', `<div class="ac-meta" style="margin-top:6px">${h(p.name)}さんの役割：${roleJa(x.role)}</div></article>`)).join('\n')}</div>
<p class="note">研究者の情報：<a href="https://cir.nii.ac.jp/crid/${attr(p.crid)}" rel="noopener" target="_blank">CiNii Research の研究者ページ</a></p></section>
<section class="ac-sec"><h2>同じテーマの国会の議論</h2><div class="ac-cards">${kok.map((k) => `<a class="ac-card" href="${GIIN}/tracker/${attr(k.key)}#ref=${REF}-researcher"><b>${h(k.name)}</b><span>国会での質疑・答弁 ${k.count}件（最新 ${ymd(k.recent[0]?.date || '')}）</span></a>`).join('')}</div>
<p class="note">研究の内容と国会の議論は、テーマが同じものを並べています。研究者ご本人が国会で発言したという意味ではありません。</p></section>
<section class="ac-sec"><p class="note">出典：CiNii Research・KAKEN（国立情報学研究所）、国会会議録検索システム（国立国会図書館）。掲載内容の訂正・削除のご依頼は<a href="${SITE}/contact.php">お問い合わせ</a>からお送りください。</p></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'ProfilePage', name: title, url, dateModified: TODAY, mainEntity: { '@type': 'Person', name: p.name, affiliation: { '@type': 'CollegeOrUniversity', name: p.tokai }, sameAs: [`https://cir.nii.ac.jp/crid/${p.crid}`] } }]
  await write(`researcher/${p.crid}.html`, shell(title, desc, url, body, ld))
  urls.push(url)
}

// 一覧
{
  const url = `${BASE}/`
  const byUniv = new Map<string, Person[]>()
  for (const p of people.values()) byUniv.set(p.tokai, [...(byUniv.get(p.tokai) || []), p])
  const univs = [...byUniv.entries()].sort((a, b) => b[1].length - a[1].length)
  const desc = `東海三県（愛知・岐阜・三重）の大学の研究者が何を研究しているかと、国会で何が議論されているかを、テーマごとに並べた論文トラッカーです。科研費の研究・論文・国会の質疑と答弁をたどれます。`
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">東海の大学の研究 × 国会の議論</p><h1>論文トラッカー</h1><p class="lead">${h(desc)}</p></div></section>
<div class="wrap"><section class="ac-sec"><h2>テーマ</h2><div class="ac-cards">${all.map((d) => `<a class="ac-card" href="${BASE}/theme/${d.theme.slug}.html"><b>${h(d.theme.name)}</b><span>科研費 ${d.projects.length}件・論文 ${d.works.length}本・国会 ${d.kokkai.reduce((a, k) => a + k.count, 0)}件</span></a>`).join('')}</div></section>
<section class="ac-sec"><h2>大学ごとの研究者 <small>${people.size}人</small></h2>${univs.map(([u, ps]) => `<h3 style="margin-top:14px">${h(u)} <small class="note">${ps.length}人</small></h3><div class="ac-meta ac-who" style="font-size:14px;gap:6px 14px">${ps.sort((a, b) => a.name.localeCompare(b.name, 'ja')).map((p) => `<a href="${rUrl(p.crid)}">${h(p.name)}</a>`).join('')}</div>`).join('')}</section>
<section class="ac-sec"><p class="note">国会の議論は <a href="${GIIN}/tracker/#ref=${REF}-index">国会トラッカー</a> と同じデータです。出典：OpenAlex、CiNii Research・KAKEN、国会会議録検索システム。</p></section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: '論文トラッカー｜東海の大学の研究と国会の議論', url, description: desc, dateModified: TODAY }]
  await write('index.html', shell('論文トラッカー｜東海の大学の研究と国会の議論', desc, url, body, ld))
  urls.unshift(url)
}

await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${all[0]?.fetched || TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`)
console.log(`academic: テーマ ${all.length}・研究者 ${people.size}・計 ${urls.length} ページ → ${outDir}`)
