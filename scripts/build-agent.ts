/**
 * exbridge.jp/agent/ — Kurage AIエージェント開発トラッカー（いま話題のAIエージェントの技術を毎日）。
 *
 * 何のためか（2026-11-07 ユーザー「Jevが話題になったみたいに、話題になってる技術情報がいいんだけど」
 * 「最近だとgrok bot とかdotsとか、トレンドな技術ってあるよね」）:
 * 大手の新しいエージェント（Grok Bot・dots）と、急に伸びたOSS（Jev など）と、開発者の間の話題を1か所に。
 * それぞれに「手元のモデルで動くか」「外部のAIサービスへ送る作りか」を書き、
 * 「社内で、データを外に出さずに使いたい」相談につなげる。
 *
 * データ: data/agent/items.json（scripts/agent-fetch.py が毎日作る）
 * 出力:   /home/kojima/work/exbridge_jp/agent/{index.html, p/<大手>.html, r/<owner--repo>.html, sitemap.xml}
 * 画像:   outputs/agent-ogp-specs.json → scripts/make_agent_ogp.py
 * 配置:   bash scripts/deploy.sh agent
 *   npx tsx scripts/build-agent.ts
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE } from './site'
import { TODAY, h, attr, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = '/home/kojima/work/exbridge_jp/agent'
const BASE = `${SITE}/agent`
const REF = 'agent'
const NAME = 'Kurage AIエージェント開発トラッカー'

type Launch = { slug: string; name: string; maker: string; date: string; status: string; what: string; points: string[]; caution: string; official: string; sources: [string, string][] }
type Repo = { repo: string; slug: string; url: string; desc: string; name_ja: string; what: string; stars: number; created: string; per_day: number; d1: number | null; d7: number | null; license: string; lang: string; topics: string[]; pushed: string; local: boolean; keys: string[]; telemetry: boolean; related: string[]; pinned?: { memo: string } | null; homepage: string }
type Hn = { id: string; title: string; title_ja: string; what: string; url: string; hn: string; points: number; comments: number; date: string }

const data = JSON.parse(await fs.readFile(path.join(root, 'data', 'agent', 'items.json'), 'utf8')) as { generated_at: string; launches: Launch[]; repos: Repo[]; hn: Hn[] }
const launches = data.launches
const repos = data.repos.filter((r) => r.what)   // 日本語の説明が付いたものだけ載せる
const lname = Object.fromEntries(launches.map((l) => [l.slug, `${l.maker} の ${l.name}`]))

const FOOT = `<a href="${SITE}/company">会社概要</a>　<a href="${BASE}/">${NAME}</a>　<a href="${SITE}/ai-it-komon.html#ref=${REF}-foot">AI-IT顧問</a>　<a href="https://kappstore.exbridge.jp/#ref=${REF}-foot">Kurage App Store</a>　<a href="${SITE}/contact.php">お問い合わせ</a>`
type OgSpec = { name: string; title: string; sub: string; chips: string[]; badge: string }
const ogSpecs: OgSpec[] = []
function og(spec: OgSpec): string {
  ogSpecs.push(spec)
  const v = crypto.createHash('sha1').update(JSON.stringify(spec)).digest('hex').slice(0, 8)
  return `${SITE}/images/agent/${spec.name}.png?v=${v}`
}
const ymd = (s: string) => (s || '').replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$1年$2月$3日').replace(/年0/, '年').replace(/月0/, '月')
const num = (n: number) => n.toLocaleString('en-US')
const rUrl = (r: Repo) => `${BASE}/r/${r.slug}.html`
const pUrl = (l: Launch) => `${BASE}/p/${l.slug}.html`
const short = (r: Repo) => r.repo.split('/')[1]

const xw = (t: string) => [...t].reduce((a, c) => a + (c.charCodeAt(0) < 0x1100 ? 1 : 2), 0)
function shareBox(text: string, url: string, kind: string): string {
  let t = text
  while (xw(t) + 24 > 280 && t.length > 20) t = t.slice(0, -2)
  const x = `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(`${url}#ref=x-share-${REF}-${kind}`)}`
  const copy = `${t}\n${url}#ref=copy-${REF}-${kind}`
  return `<div class="wrap"><div class="ag-share"><b>このページを共有</b><a class="ag-x" href="${attr(x)}" target="_blank" rel="noopener">Xで共有</a>`
    + `<button type="button" class="ag-copy" data-copy="${attr(copy)}">概要とURLをコピー</button><span class="ag-done" hidden>コピーしました</span></div></div>`
}
const SHARE_JS = `<script>document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.ag-copy');if(!b)return;var t=b.getAttribute('data-copy');function ok(){var d=b.parentNode.querySelector('.ag-done');if(d){d.hidden=false;setTimeout(function(){d.hidden=true},2500)}}if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(ok)}else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();ok()}});</script>`
const splitHero = (b: string) => { const i = b.indexOf('</section>'); return i < 0 ? [b, ''] : [b.slice(0, i + 10), b.slice(i + 10)] }
const shell = (t: string, d: string, u: string, b: string, l: unknown[], ogImage: string, share = '') => {
  const [hero, rest] = splitHero(b)
  return baseShell(t, d, u, hero + share + rest + SHARE_JS, l, { refPrefix: REF, base: BASE, footerLinks: FOOT, ogImage })
}

const CSS = `<style>
.hero .kicker::before{content:"";display:inline-block;width:26px;height:30px;margin-right:7px;vertical-align:-9px;background:url(https://kurage.exbridge.jp/images/kurage-mascot-cutout-300.webp) center/contain no-repeat}
.ag-sec{padding:26px 0 6px}.ag-sec>h2{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.ag-sec>h2 small{font-size:13px;color:var(--muted);font-weight:700}
.ag-sec>p.lead2{margin:0 0 12px;color:var(--muted);font-size:14.5px;line-height:1.8}
.ag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}
.ag-card{display:block;background:#fff;border:1px solid var(--line);border-left:5px solid #0a9a8f;border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--ink);min-width:0}
.ag-card:hover{border-color:#0a9a8f}.ag-card b{display:block;font-size:16.5px;overflow-wrap:anywhere}.ag-card i{display:block;font-style:normal;font-size:13px;color:#00687b;font-weight:800;margin:2px 0 6px}
.ag-card p{margin:0;font-size:14px;line-height:1.75;color:#33414d}.ag-card .meta{margin-top:8px;font-size:12.5px;color:var(--muted)}
.ag-card.big{border-left-color:#12202f}
.ag-tag{display:inline-block;font-size:12px;font-weight:800;border-radius:999px;padding:2px 10px;margin:6px 6px 0 0;background:#e6f4f6;color:#00687b}
.ag-tag.warn{background:#fff3e0;color:#9a4b00}.ag-tag.ok{background:#e6f7ec;color:#11683a}
.ag-box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:0 0 12px}
.ag-box dl{display:grid;grid-template-columns:8em minmax(0,1fr);gap:8px 12px;margin:0;font-size:14.5px}.ag-box dt{font-weight:800;color:var(--muted)}.ag-box dd{margin:0;overflow-wrap:anywhere}
.ag-box p{margin:6px 0;font-size:14.5px;line-height:1.85}.ag-box ul{margin:0;padding-left:1.2em}.ag-box li{font-size:14.5px;line-height:1.8;margin:4px 0}
.ag-box.memo{border-left:5px solid #12202f}.ag-box.warn{border-left:5px solid #e08a00}
.ag-hn li{list-style:none;padding:10px 0;border-top:1px dotted var(--line);font-size:14.5px;line-height:1.7}.ag-hn li:first-child{border-top:0}.ag-hn ul{margin:0;padding:0}
.ag-hn small{color:var(--muted)}
.ag-share{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0 0;padding:12px 14px;background:#e6f7f3;border:1px solid #bcecd3;border-radius:12px}.ag-share b{font-size:14px;margin-right:4px}
.ag-x,.ag-copy{display:inline-flex;align-items:center;min-height:40px;padding:8px 16px;border-radius:999px;font-weight:800;font-size:14px;text-decoration:none;cursor:pointer;border:1px solid #0a726b}.ag-x{background:#12202f;border-color:#12202f;color:#fff}.ag-copy{background:#fff;color:#0a726b;font-family:inherit}.ag-done{font-size:13px;color:#0a726b;font-weight:700}
.ag-cta{background:#12202f;color:#e8f1f2;border-radius:14px;padding:18px 20px;font-size:14.5px;line-height:1.85}.ag-cta a{color:#7fe0d4;font-weight:800}
@media(max-width:520px){.ag-box dl{grid-template-columns:1fr}.ag-box dd{margin:0 0 6px}}
</style>`

async function write(rel: string, html: string) {
  const f = path.join(outDir, rel)
  await fs.mkdir(path.dirname(f), { recursive: true })
  await fs.writeFile(f, html)
}
const urls: string[] = []
const lastmod: Record<string, string> = {}

function tags(r: Repo): string {
  const t: string[] = []
  if (r.local && !r.keys.length) t.push('<span class="ag-tag ok">手元のモデルでも動く作り</span>')   // キーが要るものに「手元で動く」を出すと誤解させる（Jev）
  if (r.keys.length) t.push(`<span class="ag-tag warn">外部AIのキーが要る（${h(r.keys.map((k) => k.replace('_API_KEY', '')).join('・'))}）</span>`)
  if (r.telemetry) t.push('<span class="ag-tag warn">利用データの送信あり</span>')
  if (r.license) t.push(`<span class="ag-tag">${h(r.license === 'NOASSERTION' ? 'ライセンス要確認' : r.license)}</span>`)
  return t.join('')
}
const growth = (r: Repo) => r.d1 != null ? `前日から＋${num(r.d1)}★` : `1日あたり約${num(r.per_day)}★`
const repoCard = (r: Repo, ref: string) => `<a class="ag-card" href="${rUrl(r)}#ref=${REF}-${ref}"><b>${h(short(r))}</b><i>${h(r.name_ja || r.repo)}</i><p>${h(r.what)}</p>`
  + `<div class="meta">★${num(r.stars)}・${growth(r)}・${ymd(r.created)}公開</div>${tags(r)}</a>`
const launchCard = (l: Launch, ref: string) => `<a class="ag-card big" href="${pUrl(l)}#ref=${REF}-${ref}"><b>${h(l.name)}</b><i>${h(l.maker)}・${ymd(l.date)}・${h(l.status)}</i><p>${h(l.what)}</p></a>`
const cta = (ref: string) => `<section class="ag-sec"><div class="ag-cta">「こういうエージェントを、社内のデータを外に出さずに使いたい」という相談を受けています。当社は名古屋のシステム開発会社で、話題のOSSを手元のモデルで動くように直して業務に入れるところまでやっています。<a href="${SITE}/ai-it-komon.html#ref=${REF}-${ref}">AI-IT顧問</a>／買い切りの業務システムは <a href="https://kappstore.exbridge.jp/#ref=${REF}-${ref}">Kurage App Store</a></div></section>`
const ABOUT = `<p class="note">${NAME}は、GitHub で直近45日に公開されて急に★が増えているAIエージェント関連のリポジトリ、大手の発表、Hacker News で点数の高い記事を毎日集めています。「手元のモデルでも動く作り」「外部AIのキーが要る」は README の記述から判定したもので、動かして確かめた結果ではありません（当社で試したものだけ「当社で試したこと」を書いています）。最終更新：${h(data.generated_at)}</p>`

// ---------- リポジトリごと
for (const r of repos) {
  const url = rUrl(r)
  const rel = launches.filter((l) => r.related.includes(l.slug))
  const title = `${short(r)}とは｜${r.name_ja || 'AIエージェント'}・GitHubで話題｜${NAME}`
  const desc = `${r.repo}（${ymd(r.created)}公開・★${num(r.stars)}）は${r.what.replace(/。$/, '')}。手元のモデルで動くか、外部のAIサービスのキーが要るか、ライセンスをまとめました。`
  const warn: string[] = []
  if (r.keys.length) warn.push(`README に ${r.keys.map((k) => `<code>${h(k)}</code>`).join('・')} の設定が書かれています。指示やページの中身を、そのAIサービスへ送って判断する作りと考えられます。社外に出せない情報を扱うなら、送り先を社内のモデルに替えられるかを先に確かめてください。`)
  if (r.telemetry) warn.push('README に利用データ（テレメトリ）の送信についての記述があります。止め方を確かめてから使ってください。')
  if (r.keys.length && r.local) warn.push('README には手元のモデル（Ollama など）に関する記述もあります。どこまで社内で閉じられるかは、動かして確かめる必要があります。')
  if (!r.keys.length && r.local) warn.push('README に、Ollama などの手元のモデルで動かす方法が書かれています。社内で閉じて使える見込みがあります。')
  if (r.license === 'NOASSERTION' || !r.license) warn.push('ライセンスがはっきりしません。業務で使う前に、リポジトリのライセンスの表示を確かめてください。')
  else if (/AGPL|GPL|CC-BY-NC|BUSL|SSPL/i.test(r.license)) warn.push(`ライセンスは ${h(r.license)} です。社内で使うだけか、改造して配るか、サービスとして公開するかで守ることが変わります。`)
  const others = repos.filter((x) => x.slug !== r.slug).slice(0, 6)
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">${NAME}｜いま話題のOSS</p><h1>${h(short(r))}</h1><p class="lead">${h(r.what)}</p></div></section>
<div class="wrap"><p class="crumb" style="font-size:13px;color:var(--muted);padding:14px 0 0"><a href="${BASE}/">${NAME}</a> › いま話題のOSS</p>
<section class="ag-sec"><h2>なぜ話題か</h2><div class="ag-box"><dl><dt>リポジトリ</dt><dd><a href="${attr(r.url)}" rel="noopener" target="_blank">${h(r.repo)}</a></dd><dt>公開</dt><dd>${ymd(r.created)}</dd>
<dt>★の数</dt><dd>${num(r.stars)}（1日あたり約${num(r.per_day)}${r.d1 != null ? `・前日から＋${num(r.d1)}` : ''}${r.d7 != null ? `・1週間で＋${num(r.d7)}` : ''}）</dd>
<dt>言語</dt><dd>${h(r.lang || '—')}</dd><dt>ライセンス</dt><dd>${h(r.license || '表示なし')}</dd><dt>最後の更新</dt><dd>${ymd(r.pushed)}</dd>
${r.desc ? `<dt>本人の説明</dt><dd>${h(r.desc)}</dd>` : ''}</dl><div>${tags(r)}</div></div></section>
${r.pinned?.memo ? `<section class="ag-sec"><h2>当社で試したこと</h2><div class="ag-box memo"><p>${h(r.pinned.memo)}</p></div></section>` : ''}
<section class="ag-sec"><h2>会社で使う前に確かめること</h2><div class="ag-box warn"><ul>${(warn.length ? warn : ['README から、外部へ送る作りかどうかは読み取れませんでした。社内の情報を扱う前に、通信先を確かめてください。']).map((w) => `<li>${w}</li>`).join('')}</ul></div></section>
${rel.length ? `<section class="ag-sec"><h2>関係する大手の製品</h2><div class="ag-grid">${rel.map((l) => launchCard(l, `r-${r.slug}`)).join('')}</div><p class="note">この OSS の説明に ${rel.map((l) => h(lname[l.slug])).join('・')} の名前が出てきます。大手の製品と同じことを、自分の環境で動かす選択肢です。</p></section>` : ''}
${cta(`r-${r.slug}`)}
<section class="ag-sec"><h2>ほかに話題のOSS</h2><div class="ag-grid">${others.map((x) => repoCard(x, `r-${r.slug}`)).join('')}</div></section>
<section class="ag-sec">${ABOUT}</section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: r.repo, codeRepository: r.url, programmingLanguage: r.lang || undefined, license: r.license || undefined, description: r.what, dateCreated: r.created, url }]
  const ogi = og({ name: `r-${r.slug}`, title: short(r), sub: r.name_ja || r.desc.slice(0, 40), chips: [`★${num(r.stars)}`, `${ymd(r.created)}公開`, r.keys.length ? '外部AIのキーが要る' : (r.local ? '手元のモデルでも動く' : 'OSS')], badge: 'いま話題のOSS' })
  await write(`r/${r.slug}.html`, shell(title, desc, url, body, ld, ogi, shareBox(`【${NAME}】${short(r)}（★${num(r.stars)}）— ${r.what}`, url, 'r')))
  urls.push(url)
  lastmod[url] = r.pushed || r.created   // 毎日 now を打たない（サイトマップの lastmod が信用されなくなる）
}

// ---------- 大手の発表ごと
for (const l of launches) {
  const url = pUrl(l)
  const alts = repos.filter((r) => r.related.includes(l.slug))
  const title = `${l.name}（${l.maker}）とは｜いつも動くAIエージェント｜${NAME}`
  const desc = `${l.maker} が${ymd(l.date)}に出した ${l.name} は、${l.what.replace(/。$/, '')}。できること、会社で使うときの注意${alts.length ? `、手元で動かせるOSSの代わり（${alts.map(short).slice(0, 3).join('・')}）` : ''}をまとめました。`
  const others = launches.filter((x) => x.slug !== l.slug)
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">${NAME}｜大手の新しいエージェント</p><h1>${h(l.name)}（${h(l.maker)}）</h1><p class="lead">${h(l.what)}</p></div></section>
<div class="wrap"><p class="crumb" style="font-size:13px;color:var(--muted);padding:14px 0 0"><a href="${BASE}/">${NAME}</a> › 大手の新しいエージェント</p>
<section class="ag-sec"><h2>できること</h2><div class="ag-box"><dl><dt>出した会社</dt><dd>${h(l.maker)}</dd><dt>発表</dt><dd>${ymd(l.date)}</dd><dt>状態</dt><dd>${h(l.status)}</dd></dl></div><div class="ag-box"><ul>${l.points.map((p) => `<li>${h(p)}</li>`).join('')}</ul></div></section>
<section class="ag-sec"><h2>会社で使う前に確かめること</h2><div class="ag-box warn"><p>${h(l.caution)}</p></div></section>
${alts.length ? `<section class="ag-sec"><h2>手元で動かせるOSSの代わり <small>${alts.length}件</small></h2><p class="lead2">説明に ${h(l.name)} の名前が出てくるOSSです。同じような仕事を、自分のサーバーと手元のモデルで動かす選択肢になります。</p><div class="ag-grid">${alts.map((r) => repoCard(r, `p-${l.slug}`)).join('')}</div></section>` : ''}
${others.length ? `<section class="ag-sec"><h2>ほかの大手の新しいエージェント</h2><div class="ag-grid">${others.map((x) => launchCard(x, `p-${l.slug}`)).join('')}</div></section>` : ''}
${cta(`p-${l.slug}`)}
<section class="ag-sec"><p class="note">出典：${l.sources.map(([n, u]) => `<a href="${attr(u)}" rel="noopener" target="_blank">${h(n)}</a>`).join('・')}。発表と報道で確かめたことだけを書いています。料金は公式に書かれているものだけを載せます。</p>${ABOUT}</section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'Article', headline: title, datePublished: l.date, dateModified: TODAY, about: { '@type': 'SoftwareApplication', name: l.name, author: { '@type': 'Organization', name: l.maker } }, url, author: { '@type': 'Organization', name: '株式会社エクスブリッジ' } }]
  const ogi = og({ name: `p-${l.slug}`, title: `${l.name}とは`, sub: `${l.maker}・${ymd(l.date)}・いつも動くAIエージェント`, chips: ['できること', '会社で使う注意', alts.length ? 'OSSの代わり' : '出典つき'], badge: '大手の新しいエージェント' })
  await write(`p/${l.slug}.html`, shell(title, desc, url, body, ld, ogi, shareBox(`【${NAME}】${l.name}（${l.maker}）— ${l.what}`, url, 'p')))
  urls.push(url)
  lastmod[url] = l.date
}

// ---------- トップ
{
  const url = `${BASE}/`
  const top = repos.slice(0, 30)
  const desc = `いま開発者の間で話題のAIエージェントの技術を毎日集めています。${launches.map((l) => l.name).join('・')}のような大手の新しいエージェントと、GitHubで急に★が増えているOSS（${top.slice(0, 3).map(short).join('・')}ほか）、Hacker Newsで話題の記事。それぞれ、手元のモデルで動くか、外部のAIサービスへ送る作りかを書いています。`
  const hnList = data.hn.slice(0, 20).map((x) => `<li><b>${h(x.title_ja || x.title)}</b><br><small>${h(x.title)}</small><br>${x.what ? `${h(x.what)}<br>` : ''}<small>${ymd(x.date)}・${num(x.points)}点・コメント${num(x.comments)}件　<a href="${attr(x.hn)}" rel="nofollow noopener" target="_blank">Hacker News</a>${x.url ? `　<a href="${attr(x.url)}" rel="nofollow noopener" target="_blank">元の記事</a>` : ''}</small></li>`).join('')
  const body = `${CSS}<section class="hero"><div class="wrap"><p class="kicker">いま話題のAIエージェントの技術・毎日更新</p><h1>${NAME}</h1><p class="lead">${h(desc)}</p></div></section>
<div class="wrap">
<section class="ag-sec"><h2>大手の新しいエージェント</h2><div class="ag-grid">${launches.map((l) => launchCard(l, 'index')).join('')}</div></section>
<section class="ag-sec"><h2>GitHubで急に伸びているOSS <small>${top.length}件・★の伸びの順</small></h2><p class="lead2">直近45日に公開されたAIエージェント関連のリポジトリを、1日あたりの★の増え方で並べています。</p><div class="ag-grid">${top.map((r) => repoCard(r, 'index')).join('')}</div></section>
${data.hn.length ? `<section class="ag-sec"><h2>開発者の間の話題（Hacker News） <small>直近14日</small></h2><div class="ag-box ag-hn"><ul>${hnList}</ul></div></section>` : ''}
${cta('index')}
<section class="ag-sec">${ABOUT}</section></div>`
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: NAME, url, description: desc, dateModified: TODAY },
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: top.slice(0, 10).map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: rUrl(r), name: r.repo })) }]
  const ogi = og({ name: 'index', title: 'いま話題のAIエージェント', sub: '大手の新製品と、GitHubで急に伸びているOSSを毎日', chips: launches.map((l) => l.name).concat(top.slice(0, 1).map(short)), badge: '毎日更新' })
  await write('index.html', shell(`${NAME}｜Grok Bot・dots と、GitHubで話題のエージェントOSS`, desc, url, body, ld, ogi, shareBox(`【${NAME}】${launches.map((l) => l.name).join('・')}と、GitHubで急に伸びているエージェントのOSSを毎日。手元のモデルで動くか、外部へ送る作りかつき。`, url, 'top')))
  urls.unshift(url)
  lastmod[url] = TODAY
}

await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod[u] || TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`)
await fs.writeFile(path.join(root, 'outputs', 'agent-ogp-specs.json'), JSON.stringify(ogSpecs, null, 1))
console.log(`agent: 大手 ${launches.length}・OSS ${repos.length}/${data.repos.length}・HN ${data.hn.length}・計 ${urls.length} ページ → ${outDir}`)
