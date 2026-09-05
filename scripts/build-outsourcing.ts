/**
 * exbridge.jp/outsourcing/ を生成する。「外注・代行を探す語」の受け皿。
 *
 * ディレクトリ名の根拠（2026-09-06 実測）:
 *   アウトソーシング 18,100/指数13・BPO 40,500/指数14 と「大きくて軽い」。
 *   当初 /ai-jidoka/ を仮置きしたが「AI 自動化」は590/指数48しかなく不採用。
 *   RPA 49,500/指数32 はツール名検索が主なので、/outsourcing/rpa.html の1枚で拾う。
 *
 * なぜ作るか（2026-09-06 実測）:
 *   外注先を探す語には実需要がある（SNS運用代行 14,800/指数63・経理代行 1,600/
 *   入札882〜4,684円・記帳代行 1,900）。当社は代行会社ではなく
 *   「外注をやめて、その業務のAI自動化を社内に作る」側。提供の実体は
 *   AI-IT顧問契約（月15時間・税別15万円）で、ai-it-komon.html と同一。
 *   業務ごとに『外注するとどうなるか／AIで自動化するとどうなるか』を
 *   具体で書き分ける（データは data/outsourcing-list.json。発明しない）。
 *
 * 出力: dist/outsourcing/<slug>.html ＋ index.html ＋ sitemap.xml
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE } from './site'
import { shell as baseShell, TODAY } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = `${SITE}/outsourcing`
const KOMON = `${SITE}/ai-it-komon.html`

type Gyomu = { slug: string; name: string; kw: string; outsourced: string; auto: string; steps: string[] }

const SHELL = {
  refPrefix: 'outsourcing',
  base: BASE,
  footerLinks: `<a href="${BASE}/">業務のAI自動化一覧</a>／<a href="${KOMON}">AI-IT顧問契約</a>／<a href="${SITE}/ai-development.html">AI開発・活用支援</a>／<a href="${SITE}/contact.php">相談する</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[], ogImage?: string) =>
  baseShell(t, d, u, b, l, { ...SHELL, ogImage })


/** shell(styles())に無いクラスはここで補う。.cols/.sub/.tw/.eyebrow を発明したまま
 *  出すと素のリスト表示になる（vibe-customize と同じ轍を踏まない）。 */
const EXTRA_CSS = `<style>
.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#0a726b;margin:0 0 8px}
.cols{columns:2;column-gap:34px;padding-left:20px;margin:8px 0}
.cols li{margin:5px 0;break-inside:avoid}
.cols .sub{font-size:12px;color:#7d8a97}
.tw{overflow-x:auto}
.tw table{width:100%;border-collapse:collapse;margin:10px 0;font-size:14.5px}
.tw th,.tw td{border:1px solid #dfe7ee;padding:9px 12px;text-align:left;vertical-align:top}
.tw th{background:#f2f7f7;white-space:nowrap}
.proof{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 14px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.proof::-webkit-scrollbar{height:8px}
.proof::-webkit-scrollbar-thumb{background:#c8ded9;border-radius:99px}
.pcard{position:relative;flex:0 0 340px;scroll-snap-align:start;background:#fff;border:1px solid #dfe7ee;border-radius:13px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:.15s}
.pcard:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(10,114,107,.13)}
.pn{position:absolute;margin:10px;width:30px;height:30px;border-radius:50%;background:#0a726b;color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:15px}
.pt{display:block;font-weight:900;font-size:14px;padding:11px 12px 6px 50px}
.pm{display:block;aspect-ratio:3/2;background:#eef4f4;overflow:hidden}
.pm img,.pm video{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.pc{display:block;font-size:12.5px;color:#55697a;padding:9px 12px 12px;line-height:1.6}
.pnote{font-size:13.5px;color:#42556a;margin-top:6px}
@media(max-width:560px){.pcard{flex-basis:280px}}
@media(max-width:560px){.cols{columns:1}}
</style>`

const h = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')


/**
 * 「なぜ作れますと言えるのか」を実物で見せる帯。
 * 画像はすべて実物のスクリーンショット（2026-09-06 撮影）:
 *   karchitect=公開LP / ktsunami=石巻市の実判定 / kappstore=公開ストア /
 *   kseo=ログイン内側の監査結果(ヘッダ認証で撮影) / media-mesh=公開ダッシュボード。
 * 動画は実際に自動生成・公開済みのPV。デモ用に作った偽物は1枚も無い。
 * まず PROOF_SLUGS のページだけに出し、確認後に全ページへ広げる。
 */
const PROOF_SLUGS = new Set(['data-entry'])

function proofSection(slug: string): string {
  const P = `${SITE}/images/proof`
  const cards: Array<{ n: string; t: string; media: string; cap: string; href: string }> = [
    { n: '1', t: '設計', href: 'https://kurage.exbridge.jp/karchitect.php',
      media: `<img src="${P}/karchitect.jpg" alt="Kurage Architect — AIと対話して作るシステム設計書" loading="lazy">`,
      cap: 'AIと対話して要件・構成図つきの設計書を作る（Kurage Architect）' },
    { n: '2', t: 'デザイン', href: 'https://kappstore.exbridge.jp/app.php?id=86b85a63bc426575',
      media: `<img src="https://kappstore.exbridge.jp/kapp_media/d3edd5356ef038c69b5ad124.png" alt="自動生成した商品バナー" loading="lazy">`,
      cap: 'バナー・OGP・商品画像をテンプレート×データで自動生成（204枚を一括生成した実績）' },
    { n: '3', t: '開発', href: 'https://kurage.exbridge.jp/ktsunami.php/',
      media: `<img src="${P}/ktsunami-judge.jpg" alt="津波浸水想定マップの実際の判定画面" loading="lazy">`,
      cap: '動くプロダクト。住所から浸水深を判定する実画面（作り話ではなく本番）' },
    { n: '4', t: 'ストアへ出品', href: 'https://kappstore.exbridge.jp/',
      media: `<img src="${P}/kappstore-top.jpg" alt="Kurage App Store" loading="lazy">`,
      cap: '自社アプリストアに38本を出品・販売中（Kurage App Store）' },
    { n: '5', t: 'PV動画も自動生成', href: 'https://kurage.exbridge.jp/ktsunami.php/',
      media: `<video src="https://kurage.exbridge.jp/pv/ktsunami-pv-30s.mp4" poster="https://kurage.exbridge.jp/pv/ktsunami-pv-poster.jpg" controls playsinline preload="none"></video>`,
      cap: '台本→ナレーション→実写(生成)→検証まで自動。この動画自体が自動生成物' },
    { n: '6', t: 'SEO診断も自動', href: 'https://kurage.exbridge.jp/kseo.php/',
      media: `<img src="${P}/kseo-audit.jpg" alt="Kurage SEOの監査結果画面" loading="lazy">`,
      cap: '公開後はAIでSEO監査（決定論チェック・96点の実画面）' },
    { n: '7', t: 'マーケも数値で運用', href: 'https://kurage.exbridge.jp/media-mesh.php',
      media: `<img src="${P}/media-mesh.jpg" alt="マーケティング実証実験ダッシュボード" loading="lazy">`,
      cap: '媒体→LP→ゴールの導線を数値ごと公開して運用（マーケティング実証実験）' },
  ]
  return `<section><div class="panel">
<h2>なぜ「作れます」と言えるのか — 全部、実物です</h2>
<p>当社自身の業務が、この型で毎日動いています。設計からデザイン、開発、出品、
PV動画、公開後のマーケティングまで——下の画像・動画は<strong>すべて実際の画面と成果物</strong>です
（デモ用に作ったものはありません。ref=outsourcing-${h(slug)} 付きで実物に飛べます）。</p>
<div class="proof">
${cards.map((c) => `<a class="pcard" href="${c.href}${c.href.includes('?') ? '&' : '?'}ref=outsourcing-${h(slug)}"${c.media.startsWith('<video') ? '' : ' target="_blank" rel="noopener"'}>
<span class="pn">${c.n}</span><span class="pt">${h(c.t)}</span>
<span class="pm">${c.media}</span>
<span class="pc">${h(c.cap)}</span></a>`).join('\n')}
</div>
<p class="pnote">この一連の流れ（設計→開発→出品→PV→マーケ）を、御社の業務に対して同じように作るのが本サービスです。</p>
</div></section>`
}

function faqs(g: Gyomu) {
  return [
    { q: `${g.name}の外注・代行と、AI自動化は何が違いますか？`,
      a: `外注は毎月・毎件の費用が続き、社内にノウハウが残りません。AI自動化は、${g.auto}。作った仕組みは御社の資産になり、件数が増えても費用はほぼ増えません。` },
    { q: '費用はいくらですか？', a: 'AI-IT顧問契約と同一です。月15時間・税別150,000円（1時間あたり10,000円）。月30時間・1年契約なら時間単価は最大40%下がり6,000円になります。仕組みの構築も、その後の改善も、この時間の中で行います。' },
    { q: 'どのくらいで動きますか？', a: 'まず1か月目に最小構成を動かし、実データで検証しながら広げます。当社自身が同じ型の自動化（記事作成・動画生成・バナー量産・データ判定）を社内で毎日運用しており、ゼロからの研究開発ではありません。' },
    { q: `${g.name}を完全に無人化できますか？`, a: 'しません。判断や承認は人に残す設計にします。AIが下書き・分類・転記を行い、人は確認と例外対応に集中する形が、事故なく続く形だと考えています。' },
    { q: '対応地域は？', a: 'オンサイトは名古屋市内、Zoom・リモート作業の組み合わせで進めます。仕組みの構築自体はリモートで完結することがほとんどです。' },
  ]
}

function page(g: Gyomu, all: Gyomu[]): string {
  const title = `${g.name}の外注・代行をやめて、AIで自動化する｜構築費は月15万円のAI-IT顧問に込み`
  const desc = `「${g.kw}」をお探しの方へ。外注は毎月費用が続き、ノウハウが残りません。${g.auto}。構築はAI-IT顧問契約（月15時間・税別15万円）の中で行い、仕組みは御社の資産になります。名古屋のAIシステム開発会社エクスブリッジ。`
  const url = `${BASE}/${g.slug}.html`
  const rel = all.filter((x) => x.slug !== g.slug).slice(0, 6)
  const fq = faqs(g)

  const body = EXTRA_CSS + `<main class="wrap">
<nav class="crumb" aria-label="パンくず"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">業務のAI自動化</a> / ${h(g.name)}</nav>
<section><div class="panel">
<p class="eyebrow">OUTSOURCING × AI — ${h(g.slug.toUpperCase())}</p>
<h1>${h(g.name)}の外注・代行をやめて、<br>AIで自動化する。</h1>
<p class="lead">「${h(g.kw)}」を探しているなら、その前に一度だけ比べてください。
外注は<strong>毎月・毎件の費用が続き、社内に何も残りません</strong>。
同じ業務を、AIの仕組みとして社内に作る選択肢があります。</p>
</div></section>

<section><div class="panel">
<h2>外注すると、こうなります</h2>
<p>${h(g.outsourced)}。件数が増えるほど費用も増え、
品質は外注先のスタッフ次第。契約をやめれば、翌月から何も残りません。</p>
<h2>AIで自動化すると、こうなります</h2>
<p>${h(g.auto)}。</p>
<ul>${g.steps.map((s) => `<li>${h(s)}</li>`).join('')}</ul>
<p>仕組みは御社のサーバー・アカウントの中に作るので、<strong>御社の資産</strong>です。
件数が10倍になっても、追加費用はほぼ増えません。</p>
</div></section>

<section><div class="panel">
<h2>費用 — AI-IT顧問契約と同一です</h2>
<p><strong>月15時間・税別150,000円</strong>（1時間あたり10,000円）。
月30時間・1年契約なら時間単価は最大40%下がります。
${h(g.name)}の自動化の構築も、動かし始めてからの改善も、この時間の中で行います。
成果物（仕組み・コード・手順）はすべて御社に残します。</p>
<p>詳しい条件は<a href="${KOMON}?ref=outsourcing-${h(g.slug)}">AI-IT顧問契約のページ</a>をご覧ください。
提供内容はこのページの業務に限らず、ITでできることをひととおり引き受けます。</p>
</div></section>

${PROOF_SLUGS.has(g.slug) ? proofSection(g.slug) : `<section><div class="panel">
<h2>なぜ「作れます」と言えるのか</h2>
<p>当社自身が、自社の業務を同じ型で自動化して毎日運用しているからです。
記事の作成と公開、製品PV動画の生成、バナー204枚の一括生成、
住所から災害リスクを判定するシステム群——これらは全て当社内のAI自動化の仕組みで動いています。
実物は<a href="https://kurage.exbridge.jp/kpv.php?ref=outsourcing-${h(g.slug)}">動画一覧</a>や
<a href="https://kappstore.exbridge.jp/?ref=outsourcing-${h(g.slug)}">Kurage App Store</a>で確認できます。</p>
</div></section>`}

<section><div class="panel"><h2>よくあるご質問</h2>
${fq.map((x) => `<details><summary>${h(x.q)}</summary><p>${h(x.a)}</p></details>`).join('\n')}
</div></section>

<section><div class="panel">
<h2>ほかの業務のAI自動化</h2>
<p>${rel.map((x) => `<a href="${BASE}/${x.slug}.html">${h(x.name)}</a>`).join('／')}　<a href="${BASE}/">…すべて見る</a></p>
<p style="margin-top:14px"><a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent(g.name + 'のAI自動化の相談')}">まず、いまの${h(g.name)}の回し方を聞かせてください</a></p>
</div></section>
</main>`

  const ld = [
    { '@context': 'https://schema.org', '@type': 'Service',
      name: `${g.name}のAI自動化 構築サービス`,
      serviceType: `${g.name}の業務自動化（AI-IT顧問契約）`,
      description: desc, url,
      provider: { '@id': `${SITE}/#organization` },
      areaServed: [{ '@type': 'City', name: '名古屋市' }, { '@type': 'Country', name: '日本' }],
      offers: { '@type': 'Offer', price: '150000', priceCurrency: 'JPY',
        description: '月15時間・税別150,000円のAI-IT顧問契約に構築・改善を含む' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: fq.map((x) => ({ '@type': 'Question', name: x.q,
        acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: '業務のAI自動化', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: g.name, item: url }] },
  ]
  return shell(title, desc, url, body, ld, `${SITE}/images/ogp/outsourcing-${g.slug}.png`)
}

function indexPage(all: Gyomu[]): string {
  // 実測: アウトソーシングとは 18,100/指数4・BPO 40,500/指数14。解説需要を正面から受ける
  const title = 'アウトソーシング・BPOとは｜外注する前に「AIで自動化して社内に残す」比較 全' + all.length + '業務'
  const desc = `アウトソーシング（外注・BPO・代行）の違いと費用の考え方を整理し、データ入力・経理・SNS運用など${all.length}業務それぞれについて「外注した場合」と「AIで自動化して社内に残す場合」を比べられる一覧です。構築はAI-IT顧問契約（月15時間・税別15万円）に含まれます。名古屋のAIシステム開発会社エクスブリッジ。`
  const body = EXTRA_CSS + `<main class="wrap">
<section><div class="panel">
<p class="eyebrow">OUTSOURCING × AI</p>
<h1>アウトソーシングを探す前に。<br>その業務、AIで自動化して社内に残せます。</h1>
<p class="lead">外注・代行・BPO——どれも毎月費用が続き、やめた瞬間に何も残りません。
このページは、外注されがちな${all.length}業務について「外注した場合」と
「AIの仕組みを社内に作った場合」を比べるための一覧です。</p>
</div></section>
<section><div class="panel">
<h2>アウトソーシング・BPO・代行の違い</h2>
<p>言葉は分かれていますが、構造は同じです。</p>
<div class="tw"><table>
<tr><th>アウトソーシング</th><td>業務のまとまりを外部企業へ委託する総称。契約は月額・年額が中心</td></tr>
<tr><th>BPO</th><td>Business Process Outsourcing。業務プロセスごと(例: 経理部門全体)を長期で外部化</td></tr>
<tr><th>代行</th><td>個別の作業(記帳・SNS投稿・データ入力など)を件数や月額で委託</td></tr>
</table></div>
<p>共通するのは、<strong>費用が続くこと</strong>と<strong>ノウハウが社外に貯まること</strong>です。</p>
<h2>第3の選択肢 — AIで自動化して、社内に残す</h2>
<p>いま外注されている業務の多くは「読む・転記する・分類する・下書きする」の組み合わせで、
これはAIが最も得意な領域です。当社は代行会社ではありません。
<strong>その業務を回すAIの仕組みを、御社の中に作る</strong>会社です。
構築は<a href="${KOMON}?ref=outsourcing-index">AI-IT顧問契約</a>（月15時間・税別15万円）の中で行い、
仕組み・コード・手順はすべて御社の資産になります。</p>
</div></section>
<section><div class="panel"><h2>業務から探す（全${all.length}業務）</h2>
<ul class="cols">${all.map((g) => `<li><a href="${BASE}/${g.slug}.html">${h(g.name)}</a><span class="sub">（${h(g.kw)}）</span></li>`).join('')}</ul>
<p style="margin-top:10px"><a href="${BASE}/rpa.html">RPAとの違いはこちら（RPAツールを買う前に）</a></p>
</div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'ItemList', name: title,
      numberOfItems: all.length,
      itemListElement: all.map((g, i) => ({ '@type': 'ListItem', position: i + 1,
        name: `${g.name}のAI自動化`, url: `${BASE}/${g.slug}.html` })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: 'アウトソーシングとBPOの違いは何ですか？',
        acceptedAnswer: { '@type': 'Answer', text: 'アウトソーシングは業務を外部委託する総称、BPOは経理部門全体のように業務プロセスごと長期で外部化する形、代行は記帳やSNS投稿など個別作業の委託を指すことが多い言葉です。いずれも費用が継続し、ノウハウは社外に蓄積されます。' } },
      { '@type': 'Question', name: '外注とAI自動化はどちらが安いですか？',
        acceptedAnswer: { '@type': 'Answer', text: '件数が少ないうちは外注が安いことがあります。件数が増えるほどAI自動化が有利になります。外注は件数に比例して費用が増えるのに対し、社内に作った仕組みは件数が増えても費用がほぼ増えないためです。' } },
      { '@type': 'Question', name: 'AI自動化の構築費用はいくらですか？',
        acceptedAnswer: { '@type': 'Answer', text: 'AI-IT顧問契約（月15時間・税別150,000円）の中で構築します。月30時間・1年契約なら時間単価は最大40%下がります。成果物は御社に帰属します。' } },
    ] },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'アウトソーシング×AI自動化', item: `${BASE}/` }] },
  ]
  return shell(title, desc, `${BASE}/`, body, ld, `${SITE}/images/ogp/outsourcing-index.png`)
}

function rpaPage(all: Gyomu[]): string {
  // 実測: RPA 49,500/指数32・RPAとは 33,100/指数21。ツール購入前の比較需要を受ける
  const title = 'RPAとは｜ツールを買う前に知りたい、AI自動化との違いと使い分け'
  const desc = 'RPAは決めた手順を高速で繰り返す仕組み、AI自動化は読み取り・分類・下書きなど判断の入る作業まで肩代わりする仕組みです。UiPathやWinActorなどのRPAツールを導入する前に、どちらが自社の業務に合うかを判断するための整理と、業務別の具体例をまとめました。'
  const url = `${BASE}/rpa.html`
  const body = EXTRA_CSS + `<main class="wrap">
<nav class="crumb" aria-label="パンくず"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">アウトソーシング×AI自動化</a> / RPAとは</nav>
<section><div class="panel">
<p class="eyebrow">RPA × AI</p>
<h1>RPAとは。ツールを買う前に、<br>AI自動化との違いを知ってください。</h1>
<p class="lead">RPA（Robotic Process Automation）は「人がPCでやっている決まった操作を、
そのまま高速で繰り返す」仕組みです。強力ですが、向き不向きがはっきりしています。</p>
</div></section>
<section><div class="panel">
<h2>RPAが向く業務・向かない業務</h2>
<div class="tw"><table>
<tr><th>向く</th><td>手順が完全に決まっている転記・ダウンロード・定型入力。画面が変わらない社内システム間の連携</td></tr>
<tr><th>向かない</th><td>読み取りに判断が要るもの（手書き・レイアウトが揺れる帳票）、文章の下書き、分類・要約、例外の多い業務</td></tr>
</table></div>
<p>RPAの現場でよく起きるのは「画面が少し変わるとロボットが止まる」「例外だけ人がやるはずが、例外だらけになる」です。</p>
<h2>AI自動化との使い分け</h2>
<div class="tw"><table>
<tr><th>RPA</th><td>決めた操作の再生。判断はしない。ライセンス費が毎年かかるツールが中心</td></tr>
<tr><th>AI自動化</th><td>AI-OCRでの読み取り、分類、下書き生成など「判断の入る手前まで」を肩代わり。人は承認と例外に集中</td></tr>
</table></div>
<p>実務では「AIが読み取り・下書き → 人が承認 → 登録は自動」という組み合わせが、
止まらずに続く形だと考えています。当社はこの型で自社業務（記事作成・動画生成・データ判定）を毎日回しています。</p>
<h2>どの業務で使えるか</h2>
<p>外注されがちな${all.length}業務について、AI自動化の具体例を業務別にまとめています:
<a href="${BASE}/">業務のAI自動化 一覧</a></p>
<p>構築は<a href="${KOMON}?ref=outsourcing-rpa">AI-IT顧問契約</a>（月15時間・税別15万円）の中で行います。
RPAツールの年間ライセンスを買う前に、一度ご相談ください。</p>
<p style="margin-top:14px"><a class="btn btn-main" href="${SITE}/contact.php?subject=${encodeURIComponent('RPA・AI自動化の相談')}">いま自動化したい業務を聞かせてください</a></p>
</div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc,
      url, datePublished: TODAY, dateModified: TODAY, inLanguage: 'ja',
      author: { '@id': `${SITE}/#organization` }, publisher: { '@id': `${SITE}/#organization` } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: 'RPAとは何ですか？',
        acceptedAnswer: { '@type': 'Answer', text: '人がPC上で行っている決まった操作（クリック・入力・転記など）を記録し、そのまま高速で繰り返すソフトウェアの仕組みです。手順が固定された定型業務に向きます。' } },
      { '@type': 'Question', name: 'RPAとAI自動化の違いは何ですか？',
        acceptedAnswer: { '@type': 'Answer', text: 'RPAは決めた操作の再生で、判断はしません。AI自動化は帳票の読み取り・分類・文章の下書きなど、判断の入る手前までを肩代わりします。画面変更や例外に弱いRPAの弱点を、AIと人の承認の組み合わせで補う設計が実務的です。' } },
      { '@type': 'Question', name: 'RPAツールは買うべきですか？',
        acceptedAnswer: { '@type': 'Answer', text: '手順が完全に固定で例外が少ない業務なら有効です。読み取りや判断が混ざる業務なら、年間ライセンスを払う前にAI自動化での内製を比較することをおすすめします。' } },
    ] },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'アウトソーシング×AI自動化', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: 'RPAとは', item: url }] },
  ]
  return shell(title, desc, url, body, ld, `${SITE}/images/ogp/outsourcing-rpa.png`)
}

async function run() {
  const all: Gyomu[] = JSON.parse(await fs.readFile(path.join(root, 'data', 'outsourcing-list.json'), 'utf8'))
  const out = path.join(root, 'dist', 'outsourcing')
  await fs.mkdir(out, { recursive: true })
  for (const g of all) {
    await fs.writeFile(path.join(out, `${g.slug}.html`), page(g, all))
  }
  await fs.writeFile(path.join(out, 'index.html'), indexPage(all))
  await fs.writeFile(path.join(out, 'rpa.html'), rpaPage(all))
  const urls = [`${BASE}/`, `${BASE}/rpa.html`, ...all.map((g) => `${BASE}/${g.slug}.html`)]
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`
  await fs.writeFile(path.join(out, 'sitemap.xml'), sm)
  console.log(`outsourcing: ${all.length}業務 + index + sitemap`)
}

run()
