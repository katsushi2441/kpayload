/**
 * /vibeblog/ — VWorkブログ（GitHub Pages の /vwork/blog/）を exbridge.jp 配下に、
 * /ai-system/ や /oss/ と同じページ枠で出し直す。
 *
 * **対象は vwork/blog/ と、vwork/articles/ のうち人が書いた解説記事。**
 *   vwork には別物のブログが2つある（CLAUDE.md「vwork ブログ2種の違い（混同厳禁）」）。
 *     vwork/blog/     = VWorkブログ
 *     vwork/articles/ = AI OSS技術解説ブログ
 *   2026-09-26 に一度 articles/ の487本まで取り込んで公開してしまい、取り下げた。
 *   2026-10-02 ユーザー指示「/vibeblog/ の方が検索に強いので、AI OSS技術解説ブログも /vibeblog/ に」で再び入れた。
 *   混同しないよう、記事に「AI OSS技術解説」の区分を付け、一覧は /vibeblog/oss.html に分け、RSS には入れない。
 *   **Horizon が自動で集めて要約したAIニュースのまとめ（本文に「Horizonを使い」。514本中421本）は入れない。**
 *   大量の自動生成ページを exbridge.jp に載せると、ドメイン全体の評価を下げるおそれがあるため（入れるなら
 *   環境変数 VIBEBLOG_INCLUDE_HORIZON=1。ユーザー判断待ち）。
 *
 * なぜ移すか（2026-09-26 実測）:
 *   90日のGSCで、同じ会社なのにドメインで3倍以上の差が出ていた。
 *     exbridge.jp /ai-system/  2,972ページ 表示9,980 クリック449（表示のあるページ51%）
 *     kurage      /oss/        2,912ページ 表示5,229 クリック246（41%）
 *     GitHub Pages /vwork/       647ページ 表示  820 クリック 29（17%）
 *   1ページあたりのクリックは /ai-system/ が vwork の3.4倍。サイトマップは
 *   exbridge.jp 経由で取得済みなので、発見ではなくドメインとページの作りの差。
 *
 * データ: /home/kojima/work/vwork の articles/*.md と blog/*.md（frontmatter に
 *         seo_title・description・head_keyword が入っている前提。入れたのは
 *         vwork/scripts/seo_enrich_articles.py）
 * 出力:   dist/vibeblog/<slug>.html + k/<キーワード>.html + index.html + sitemap.xml
 *
 * 方針:
 *   - 本文は転載ではなく移設。正本をこちら側にするので canonical は exbridge.jp を指す。
 *     GitHub Pages 側の canonical も合わせて切り替えること（両方が正本だと共倒れする）。
 *   - 記事に無いことを足さない。要約も見出しも frontmatter にあるものだけを使う。
 *   - 画像は GitHub Pages に置いたままなので、相対パスを絶対URLに直す。
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { marked } from 'marked'

import { SITE, KURAGE } from './site'
import { TODAY, TODAY_JA, h, attr, visibleLength, fitLength, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist', 'vibeblog')
const BASE = `${SITE}/vibeblog`
const VWORK = '/home/kojima/work/vwork'
const GHP = 'https://katsushi2441.github.io/vwork'

const SHELL = {
  refPrefix: 'exbridge-vibeblog',
  base: BASE,
  // AI OSS技術解説ブログの画像を使い回さない。VWork Blog 用に作ったもの
  // （exbridge_jp/scripts/make_vwork_blog_ogp.py）。
  ogImage: `${SITE}/images/vibeblog-ogp.png`,
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${SITE}/contact.php?ref=exbridge-vibeblog">無料相談</a>　<a href="${BASE}/">記事一覧</a>　<a href="${KURAGE}/oss/?ref=exbridge-vibeblog">業務OSSカタログ</a>　<a href="${SITE}/ai-system/?ref=exbridge-vibeblog">AIでできること</a>　<a href="${SITE}/system-development-cost.html?ref=exbridge-vibeblog">業務システムの受託開発（名古屋・概算見積無料）</a>`,
}
const shell = (t: string, d: string, u: string, b: string, l: unknown[], og?: string) =>
  baseShell(t, d, u, b, l, { ...SHELL, ogImage: og || SHELL.ogImage }).replace('</head>',
    `<link rel="alternate" type="application/rss+xml" title="バイブコーディング的仕事ブログ" href="${BASE}/feed.xml"></head>`)
    .replace('</body>', `${copyScript}</body>`)

/**
 * 「タイトルとURLをコピー」ボタンの動き。
 * navigator.clipboard は https と利用者の操作が要る。公開先は https なので通るが、
 * 拒否されることもあるので、そのときは隠した textarea + execCommand に落とす。
 * コピーする中身は data-copy に入れてあるので、ここで文字列を組み立て直さない
 * （題に引用符や改行が入ったときに壊れないようにするため）。
 */
const copyScript = `<script>
(function(){
  var DONE='コピーしました', FAIL='コピーできませんでした';
  function flash(b,msg){
    var l=b.querySelector('.vb-copy-label'), keep=b.getAttribute('data-orig')||l.textContent;
    b.setAttribute('data-orig',keep); b.setAttribute('data-done','1'); l.textContent=msg;
    clearTimeout(b._t); b._t=setTimeout(function(){ l.textContent=keep; b.removeAttribute('data-done'); },1800);
  }
  function legacy(text){
    var a=document.createElement('textarea');
    a.value=text; a.setAttribute('readonly','');
    a.style.position='fixed'; a.style.left='-9999px';
    document.body.appendChild(a); a.select();
    var ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
    document.body.removeChild(a); return ok;
  }
  document.addEventListener('click', function(ev){
    var b=ev.target.closest && ev.target.closest('.vb-copy');
    if(!b) return;
    var text=b.getAttribute('data-copy')||'';
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ flash(b,DONE); },
        function(){ flash(b, legacy(text)?DONE:FAIL); });
    } else {
      flash(b, legacy(text)?DONE:FAIL);
    }
  });
})();
</script>`

type Post = {
  slug: string
  src: 'articles' | 'blog'
  date: string
  title: string          // 記事の見出し（h1）
  seoTitle: string       // <title> 用の短い題
  description: string
  headKeyword: string
  topics: string[]
  html: string           // 本文
  chars: number
}

/** frontmatter の1行を読む。値は "..." か素の文字列。配列は [a, b] 形式。 */
const fmGet = (fm: string, key: string): string => {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
  if (!m) return ''
  return m[1].trim().replace(/^"(.*)"$/s, '$1').replace(/\\"/g, '"')
}
const fmList = (fm: string, key: string): string[] => {
  const m = fm.match(new RegExp(`^${key}:\\s*\\[(.*?)\\]`, 'ms'))
  if (!m) return []
  return m[1].split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
}

/**
 * 日本語の **強調** を先に <strong> へ直す。
 *
 * CommonMark では閉じる ** の直後が日本語（記号ではない文字）だと閉じ側と認識されず、
 * 「…OSS「Docmost」**を実際に」のような書き方が ** のまま画面に出る（635本中74本で発生）。
 * GitHub Pages の kramdown は通してくれるので、移設で見た目が壊れるのを防ぐ。
 * コードブロックとインラインコードは触らない。
 */
function jaBold(md: string): string {
  const keep: string[] = []
  const stash = (s: string) => `\u0000${keep.push(s) - 1}\u0000`
  let out = md
    .replace(/```[\s\S]*?```/g, (m) => stash(m))
    .replace(/`[^`\n]+`/g, (m) => stash(m))
  // 段落の中で改行をまたぐ書き方もあるので1行の改行は許す（空行は段落の切れ目なので許さない）
  out = out.replace(/\*\*((?:[^*\n]|\n(?!\s*\n)){1,400}?)\*\*/g,
                    (_, s: string) => `<strong>${s.replace(/\n/g, ' ')}</strong>`)
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[Number(i)])
}

async function load(dir: 'articles' | 'blog'): Promise<Post[]> {
  // index.md は一覧ページ、README.md は説明。どちらも記事ではない
  const SKIP = new Set(['README.md', 'index.md'])
  const names = (await fs.readdir(path.join(VWORK, dir))).filter((n) => n.endsWith('.md') && !SKIP.has(n))
  const out: Post[] = []
  for (const n of names.sort()) {
    const raw = await fs.readFile(path.join(VWORK, dir, n), 'utf8')
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!m) continue
    const [, fm, bodyMd] = m
    const title = fmGet(fm, 'title')
    if (!title) continue
    // blog/ は published を持たないものがあるので、false のときだけ落とす
    if (/^published:\s*false\s*$/m.test(fm)) continue
    // Horizon の自動ニュースまとめは入れない（冒頭の説明）
    if (dir === 'articles' && /Horizonを使い/.test(bodyMd) && process.env.VIBEBLOG_INCLUDE_HORIZON !== '1') continue
    const slug = n.replace(/\.md$/, '')
    // 日付はファイル名の先頭から。日付の無いスラッグ（決まった URL を毎日書き換えるページ。例: nagoya-gakkyu-heisa）は
    // frontmatter の date（最終更新日）を使う（2026-10-09）
    const date = (slug.match(/^(\d{4}-\d{2}-\d{2})/) || [, ''])[1] || fmGet(fm, 'date').slice(0, 10)
    // 本文の先頭 h1 は frontmatter の title と重複するので落とす
    const md = jaBold(bodyMd.replace(/^#\s+.+\n+/, ''))
    let html = await marked.parse(md, { async: true, gfm: true, breaks: false })
    // 画像と記事間リンクの相対パスを直す。画像は GitHub Pages に置いたまま参照する
    html = html
      .replace(/(<img[^>]+src=")(?!https?:|\/)([^"]+)"/g, `$1${GHP}/${dir}/$2"`)
      .replace(/(<a[^>]+href=")(?!https?:|\/|#)(\d{4}-\d{2}-\d{2}-[^"]+)\.html"/g, `$1${BASE}/$2.html"`)
      // 本文が GitHub Pages の VWork Blog を指している箇所も移設先へ向ける。
      // articles/（AI OSS技術解説ブログ）へのリンクは別媒体なのでそのまま残す。
      .replace(new RegExp(`${GHP}/blog/([A-Za-z0-9._-]+)\\.html`, 'g'), `${BASE}/$1.html`)
      .replace(new RegExp(`${GHP}/blog/(?![A-Za-z0-9._-]+\\.html)`, 'g'), `${BASE}/`)
    out.push({
      slug, src: dir, date, title,
      seoTitle: fmGet(fm, 'seo_title') || title,
      description: fmGet(fm, 'description'),
      headKeyword: fmGet(fm, 'head_keyword'),
      topics: fmList(fm, 'topics'),
      html,
      chars: md.replace(/\s/g, '').length,
    })
  }
  return out
}

// 同じスラッグが二度出てきたら先に読んだほうを残す（保険）。
const loaded = [...(await load('blog')), ...(await load('articles'))]
const seen = new Map<string, Post>()
const merged: string[] = []
for (const p of loaded) {
  if (seen.has(p.slug)) { merged.push(p.slug); continue }
  seen.set(p.slug, p)
}
const posts = [...seen.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
const blogPosts = posts.filter((p) => p.src === 'blog')
const ossPosts = posts.filter((p) => p.src === 'articles')
const SECTION = { blog: 'VWork Blog', articles: 'AI OSS技術解説' } as const
// AI OSS技術解説の記事どうしのリンク（GitHub Pages の /articles/ や相対パス）を、移した記事はこちらへ向ける。
// 移していない記事（Horizon のまとめ等）へのリンクは GitHub Pages のまま残す
{
  const here = new Set(posts.map((p) => p.slug))
  for (const p of posts) {
    p.html = p.html
      .replace(new RegExp(`${GHP}/articles/([A-Za-z0-9._-]+)\\.html`, 'g'), (m, sl) => (here.has(sl) ? `${BASE}/${sl}.html` : m))
    if (p.src === 'articles') {
      p.html = p.html.replace(/(<a[^>]+href=")(?!https?:|\/|#)([A-Za-z0-9._-]+)\.html"/g,
        (m, pre, sl) => `${pre}${here.has(sl) ? `${BASE}/${sl}` : `${GHP}/articles/${sl}`}.html"`)
    }
  }
}

// 関連記事の突き合わせにだけ使う。
// テーマ別の入口ページは作らない: 159本に対してキーワードが147語あり、
// 3本以上そろう語が1つしか無かった（「テーマから探す」が1個だけの飾りになる）。
const byKw = new Map<string, Post[]>()
for (const p of posts) {
  if (!p.headKeyword) continue
  byKw.set(p.headKeyword, [...(byKw.get(p.headKeyword) || []), p])
}

const dateJa = (d: string) => d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日')
/** 一覧の行に使う短い日付。「2026年09月21日」は幅を食って2行に折れる。 */
const dateDot = (d: string) => d.replace(/-/g, '.')

const styles = () => `<style>
.crumb{font-size:12.5px;color:#5f7078;margin:14px 0 6px}
h1{font-size:26px;line-height:1.5;margin:6px 0 8px}
.meta{font-size:12.5px;color:#5f7078;margin:0 0 14px}
.meta span+span::before{content:"／";margin:0 7px;color:#b9cbd0}
.vb-eyecatch{margin:14px 0 18px}
.vb-eyecatch img{display:block;width:100%;max-width:100%;height:auto;aspect-ratio:1200/630;border-radius:12px;border:1px solid #e3eaec}
.lead{background:#f3faf9;border:1px solid #dcebe9;border-radius:10px;padding:12px 14px;
  font-size:14px;color:#425560;line-height:1.9;margin:0 0 20px}
.post{font-size:15px;line-height:1.95;color:#283a42}
.post h2{font-size:19px;padding-left:11px;border-left:4px solid #0a9a8f;margin:30px 0 10px;line-height:1.5}
.post h3{font-size:16.5px;margin:22px 0 8px;color:#1d3038}
.post p{margin:0 0 14px}
.post ul,.post ol{margin:0 0 14px;padding-left:22px}
.post li{margin-bottom:5px}
.post a{color:#0a726b}
.post img{max-width:100%;height:auto;border:1px solid #dcebe9;border-radius:8px;display:block;margin:12px 0}
.post pre{background:#10232a;color:#e6f2f0;border-radius:10px;padding:14px 16px;overflow-x:auto;
  font-size:13px;line-height:1.7;margin:0 0 16px}
.post code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px}
.post :not(pre)>code{background:#eef6f5;color:#0a5c56;border-radius:5px;padding:1px 5px}
.post blockquote{margin:0 0 16px;padding:10px 14px;background:#f7fafa;border-left:4px solid #b9cbd0;color:#5f7078;font-size:14px}
.post table{width:100%;border-collapse:collapse;font-size:13.5px;margin:0 0 16px}
.post th,.post td{border:1px solid #dcebe9;padding:7px 10px;text-align:left}
.post th{background:#f3faf9}
.tablewrap{overflow-x:auto}
/* 共有用のコピーボタン。外部ライブラリを足さずに済む範囲で作る */
.vb-share{margin:0 0 18px}
.vb-copy{display:inline-flex;align-items:center;gap:8px;background:#fff;
  border:1.5px solid #dcebe9;border-radius:99px;padding:8px 16px;
  font:inherit;font-size:13px;font-weight:700;color:#0a726b;cursor:pointer;
  transition:border-color .15s,background .15s}
.vb-copy:hover{border-color:#0a9a8f;background:#f3faf9}
.vb-copy:focus-visible{outline:2px solid #0a9a8f;outline-offset:2px}
.vb-copy::before{content:"";width:14px;height:14px;flex:none;
  border:1.5px solid currentColor;border-radius:3px;
  box-shadow:3px -3px 0 -1.5px #fff, 3px -3px 0 0 currentColor}
.vb-copy[data-done="1"]{border-color:#0a9a8f;background:#e8f6f4}
.vb-copy[data-done="1"]::before{box-shadow:none;border:none;
  width:12px;height:7px;border-left:2px solid currentColor;
  border-bottom:2px solid currentColor;transform:rotate(-45deg);margin-bottom:3px}
section{margin:26px 0}
section h2{font-size:18.5px;padding-left:11px;border-left:4px solid #0a9a8f;margin:0 0 10px}
.idx{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:11px}
.lcard{display:block;background:#fff;border:1px solid #dcebe9;border-radius:12px;padding:13px 15px;text-decoration:none;transition:.15s}
.lcard:hover{border-color:#0a9a8f;transform:translateY(-2px)}
.lc-m{font-size:11px;font-weight:800;color:#0a9a8f;letter-spacing:.03em;margin-bottom:3px}
.lc-t{font-weight:800;font-size:14.5px;color:#1d3038;margin-bottom:4px;line-height:1.55}
.lc-d{font-size:12.5px;color:#5f7078;line-height:1.65}
/* 索引のヘッダ。VWork の2つの意味を並べて、1段落の塊にしない */
.vb-head{margin:10px 0 30px;background:none;color:inherit;padding:0}
.vb-head .vb-eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.14em;color:#0a9a8f;margin:0 0 6px}
.vb-head h1{font-size:34px;letter-spacing:.01em;margin:0 0 8px}
.vb-head .vb-tag{font-size:14.5px;color:#5f7078;margin:0 0 18px}
.vb-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.vb-def{background:#fff;border:1px solid #dcebe9;border-radius:12px;padding:14px 16px}
.vb-def .vb-dn{font-size:13px;font-weight:800;color:#0a726b;margin-bottom:5px}
.vb-def p{font-size:13px;color:#5f7078;line-height:1.8;margin:0}
/* 見出しの間隔。前は空白が空きすぎて、何が塊なのか分からなかった */
.vb-latest,.vb-archive{margin:26px 0}
.vb-archive h2 .vb-cnt{font-size:12px;font-weight:700;color:#5f7078;background:#eef6f5;
  border-radius:99px;padding:3px 10px;margin-left:10px;vertical-align:2px}
/* 同じ大きさのカードを159個並べると壁になるので、7本目からは行で見せる */
.vb-rows{list-style:none;margin:0;padding:0;
  columns:2;column-gap:34px;column-rule:1px solid #e7f0ef}
.vb-rows li{break-inside:avoid;border-bottom:1px solid #e7f0ef}
.vb-rows a{display:flex;gap:12px;align-items:baseline;padding:9px 2px;text-decoration:none;color:#1d3038}
.vb-rows a:hover{color:#0a726b}
.vb-rows time{flex:none;font-size:11.5px;color:#8aa2a8;font-variant-numeric:tabular-nums;
  width:66px;letter-spacing:.01em}
.vb-rows .vb-rt{font-size:13.5px;line-height:1.65;font-weight:600}
.cta{background:#f3faf9;border:1px solid #dcebe9;border-radius:14px;padding:18px}
.ctarow{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}
.btn{display:inline-block;background:#0a9a8f;color:#fff;font-weight:800;font-size:13.5px;padding:10px 17px;border-radius:99px;text-decoration:none}
.btn.sub{background:#fff;color:#0a726b;border:1px solid #0a9a8f}
.btn:hover{filter:brightness(1.07)}
@media(max-width:820px){.vb-two{grid-template-columns:1fr}.vb-rows{columns:1}}
@media(max-width:640px){h1{font-size:21px}.vb-head h1{font-size:26px}
  .post{font-size:14.5px}.post h2{font-size:17px}
  .vb-rows a{flex-wrap:wrap;gap:2px}.vb-rows time{width:auto}}
</style>`

const ctaBlock = `
<section class="cta">
  <h2>読んで、自分でやるか任せるか</h2>
  <p>記事のとおりに進めて詰まったら、そこから先は任せてください。名古屋の会社です。概算見積は無料です。</p>
  <div class="ctarow">
    <a class="btn" href="${KURAGE}/vibe-oss.html?ref=exbridge-vibeblog">OSS導入・カスタマイズを頼む</a>
    <a class="btn" href="${KURAGE}/vibe-prototype.html?ref=exbridge-vibeblog">動くプロトタイプを1営業日で</a>
    <a class="btn sub" href="https://kappstore.exbridge.jp/?ref=exbridge-vibeblog">オンプレミスの業務システムを見る</a>
    <a class="btn sub" href="${SITE}/contact.php?ref=exbridge-vibeblog">人に相談する（無料・Zoom可）</a>
  </div>
</section>
<section class="cta" style="margin-top:12px;background:#fff">
  <h2>開発会社・IT販売の方へ</h2>
  <p>この記事に出てくるシステムは、御社の案件で売ったり、御社の製品に組み込んだりできます。ソースコードは MIT ライセンスで、御社のブランドでの販売もできます。販売手数料は、バイブプロトタイプ制作・バイブOSSで1件9万円（税別）、App Store の製品は本体価格の10%です。登録無料・ノルマなし。</p>
  <div class="ctarow">
    <a class="btn sub" href="${KURAGE}/reseller.html?ref=vibeblog-reseller">販売代理店の条件を見る</a>
  </div>
</section>`

const card = (href: string, meta: string, title: string, desc: string) =>
  `<a class="lcard" href="${attr(href)}"><div class="lc-m">${h(meta)}</div>` +
  `<div class="lc-t">${h(title)}</div><div class="lc-d">${h(desc)}</div></a>`

/**
 * 記事ごとのトップ画像（note の見出し画像にあたる）。scripts/make_vibeblog_eyecatch.py が
 * exbridge_jp/images/vibeblog/<slug>.png に作り、同じ名前で exbridge.jp に置く。
 * 画像が無い記事は共通の OGP に戻す（画像を作る前にビルドしても壊れない）。
 */
const EYECATCH_DIR = '/home/kojima/work/exbridge_jp/images/vibeblog'
{
  // 無い画像だけ作る（既存は触らない）。失敗してもビルドは止めず、その記事は共通OGPに戻る
  const r = spawnSync('/usr/bin/python3', [path.join(root, 'scripts', 'make_vibeblog_eyecatch.py')], { encoding: 'utf8' })
  const last = (r.stdout || '').trim().split('\n').pop()
  console.log(r.status === 0 ? `  ${last}` : `  ！トップ画像の生成に失敗: ${(r.stderr || '').slice(-300)}`)
}
const eyecatch = (slug: string): string | null =>
  existsSync(path.join(EYECATCH_DIR, `${slug}.png`)) ? `${SITE}/images/vibeblog/${slug}.png` : null

function postHtml(p: Post, idx: number): string {
  // <title> は全角32で切れる。seo_title がそれを超えていたら記事の題より短いほうを採る
  const title = fitLength(32, p.seoTitle, p.title)
  const desc = p.description || `${p.title}。株式会社エクスブリッジ（名古屋）の実務記録です。`
  const url = `${BASE}/${p.slug}.html`
  const sib = byKw.get(p.headKeyword) || []
  const rel = sib.filter((x) => x.slug !== p.slug).slice(0, 6)
  const same = p.src === 'articles' ? ossPosts : blogPosts
  const si = same.indexOf(p)
  const prev = same[si + 1]
  const next = same[si - 1]
  const img = eyecatch(p.slug)

  const ld = [{
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': `${url}#article`,
    headline: p.title, description: desc, url, inLanguage: 'ja',
    datePublished: p.date || undefined, dateModified: p.date || undefined,
    keywords: [p.headKeyword, ...p.topics].filter(Boolean).join(', '),
    articleSection: SECTION[p.src],
    wordCount: p.chars,
    image: img ? { '@type': 'ImageObject', url: img, width: 1200, height: 630 } : undefined,
    author: { '@type': 'Organization', '@id': `${SITE}/#organization` },
    publisher: { '@id': `${SITE}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'バイブコーディング的仕事ブログ', item: `${BASE}/` },
      ...(p.src === 'articles' ? [{ '@type': 'ListItem', position: 3, name: 'AI OSS技術解説', item: `${BASE}/oss.html` }] : []),
      { '@type': 'ListItem', position: p.src === 'articles' ? 4 : 3, name: p.title, item: url },
    ],
  }]
  // 「## よくある質問」の下に「### 質問」と答えの段落が並ぶ記事は FAQPage も出す（AEO。2026-10-02）。
  // 見えている本文から組むので、構造化データと本文がずれない
  {
    const sec = p.html.split(/<h2[^>]*>\s*よくある質問\s*<\/h2>/)[1]
    if (sec) {
      const part = sec.split(/<h2[^>]*>/)[0]
      const strip = (x: string) => x.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
      const qa: Array<{ q: string; a: string }> = []
      for (const m of part.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/g)) {
        const q = strip(m[1]); const a = strip(m[2])
        if (q && a) qa.push({ q, a })
      }
      if (qa.length >= 2) {
        (ld as unknown[]).push({ '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: qa.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) })
      }
    }
  }

  const body = `
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ <a href="${BASE}/">バイブコーディング的仕事ブログ</a>${p.src === 'articles' ? ` ／ <a href="${BASE}/oss.html">AI OSS技術解説</a>` : ''}</nav>
${img ? `<figure class="vb-eyecatch"><img src="${attr(img)}" width="1200" height="630" alt="${attr(p.title)}" loading="eager" decoding="async"></figure>` : ''}
<h1>${h(p.title)}</h1>
<p class="meta">${p.src === 'articles' ? '<span>AI OSS技術解説</span>' : ''}${p.date ? `<span>${h(dateJa(p.date))}</span>` : ''}<span>約${Math.round(p.chars / 400) || 1}分で読めます</span>${
    p.headKeyword ? `<span>${h(p.headKeyword)}</span>` : ''}</p>
${desc ? `<p class="lead">${h(desc)}</p>` : ''}
<div class="vb-share">
  <button type="button" class="vb-copy" data-copy="${attr(`${p.title}\n${url}`)}">
    <span class="vb-copy-label">タイトルとURLをコピー</span></button>
</div>
<article class="post">${p.html}</article>

${rel.length ? `<section>
  <h2>「${h(p.headKeyword)}」の他の記事</h2>
  <div class="idx">${rel.map((r) => card(`${BASE}/${r.slug}.html`, dateJa(r.date), r.title, r.description.slice(0, 66))).join('')}</div>
</section>` : ''}

${(prev || next) ? `<section>
  <h2>前後の記事</h2>
  <div class="idx">${[next, prev].filter(Boolean).map((r) =>
    card(`${BASE}/${r!.slug}.html`, dateJa(r!.date), r!.title, r!.description.slice(0, 66))).join('')}</div>
</section>` : ''}
${ctaBlock}
</main>`
  return shell(title, desc, url, body + styles(), ld, img || undefined)
}

function indexHtml(): string {
  const url = `${BASE}/`
  // ブログの題は「バイブコーディング的仕事ブログ」。VWork Blog はこの媒体の名前として
  // 他サイトのリンク集に載っているので、眉見出しに残す（2026-09-26 指示）。
  const title = fitLength(32, 'バイブコーディング的仕事ブログ｜VWork Blog', 'バイブコーディング的仕事ブログ')
  // VWork には「バイブコーディングのフレームワーク VWork」と
  // 「バイブコーディングで仕事をすること（VWork）」の2つの意味がある。
  // どちらか片方に寄せた言い方をしない。
  const desc = `バイブコーディングのフレームワーク VWork と、バイブコーディングでやった仕事の解説・考察（${blogPosts.length}本）と、オープンソースのAIを動かして解説したAI OSS技術解説（${ossPosts.length}本）を公開しています。株式会社エクスブリッジ（名古屋）。`
  const ld = [{
    '@context': 'https://schema.org', '@type': 'Blog', '@id': `${url}#blog`,
    url, name: 'バイブコーディング的仕事ブログ', alternateName: 'VWork Blog',
    description: desc, inLanguage: 'ja',
    publisher: { '@id': `${SITE}/#organization` },
    blogPost: posts.slice(0, 100).map((p) => ({
      '@type': 'BlogPosting', headline: p.title, url: `${BASE}/${p.slug}.html`, datePublished: p.date || undefined,
    })),
  }]
  const lead = blogPosts.slice(0, 6)
  const rest = blogPosts.slice(6)
  const body = `
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ バイブコーディング的仕事ブログ</nav>

<header class="vb-head">
  <p class="vb-eyebrow">VWork Blog ・ 株式会社エクスブリッジ（名古屋）</p>
  <h1>バイブコーディング的仕事ブログ</h1>
  <p class="vb-tag">バイブコーディングでやったことを、そのまま書いています。現在 <strong>${blogPosts.length}本</strong>（ほかに AI OSS技術解説 ${ossPosts.length}本）。</p>
  <div class="vb-two">
    <div class="vb-def">
      <div class="vb-dn">VWork（フレームワーク）</div>
      <p>AIにシステムを作らせるための、当社の作り方そのもの。手順・型・ひっかかった所を書きます。</p>
    </div>
    <div class="vb-def">
      <div class="vb-dn">VWork（仕事のやり方）</div>
      <p>その作り方で実際にやった仕事の解説と考察。何を測り、何をやめたかまで書きます。</p>
    </div>
  </div>
</header>

<section class="vb-latest">
  <h2>新しい記事</h2>
  <div class="idx">${lead.map((p) =>
    card(`${BASE}/${p.slug}.html`, dateJa(p.date), p.title, p.description.slice(0, 82))).join('')}</div>
</section>

${ossPosts.length ? `<section class="vb-latest">
  <h2>AI OSS技術解説（新しい順）</h2>
  <p style="font-size:13.5px;color:#5f7078;margin:0 0 10px">オープンソースのAI・業務ソフトを、実際に動かして日本語で解説した記事です。<a href="${BASE}/oss.html">${ossPosts.length}本すべてを見る</a></p>
  <div class="idx">${ossPosts.slice(0, 6).map((p) =>
    card(`${BASE}/${p.slug}.html`, dateJa(p.date), p.title, p.description.slice(0, 82))).join('')}</div>
</section>` : ''}

<section class="vb-archive">
  <h2>これまでの記事<span class="vb-cnt">${rest.length}本</span></h2>
  <ol class="vb-rows">${rest.map((p) => `<li><a href="${BASE}/${attr(p.slug)}.html">` +
    `<time datetime="${attr(p.date)}">${h(dateDot(p.date))}</time>` +
    `<span class="vb-rt">${h(p.title)}</span></a></li>`).join('')}</ol>
</section>

${ctaBlock}
</main>`
  return shell(title, desc, url, body + styles(), ld)
}

await fs.rm(distRoot, { recursive: true, force: true })
await fs.mkdir(distRoot, { recursive: true })
for (let i = 0; i < posts.length; i++) {
  await fs.writeFile(path.join(distRoot, `${posts[i].slug}.html`), postHtml(posts[i], i), 'utf8')
}
// 本文の画像（vwork/blog/assets/）を /vibeblog/assets/ に写す。
// これが無くて、画像入りの記事は /vibeblog/ で画像が全部404だった（2026-09-28 に発見。9/09・7/31 の記事も）。
{
  const want = new Set<string>()
  for (const p of posts) for (const m of p.html.matchAll(/\/vibeblog\/assets\/([^"'?#\s)]+)/g)) want.add(decodeURIComponent(m[1]))
  if (want.size) await fs.mkdir(path.join(distRoot, 'assets'), { recursive: true })
  for (const f of want) {
    const src = path.join(VWORK, 'blog', 'assets', f)
    if (!existsSync(src)) { console.warn(`画像が見つかりません: blog/assets/${f}`); continue }
    await fs.mkdir(path.dirname(path.join(distRoot, 'assets', f)), { recursive: true })
    await fs.copyFile(src, path.join(distRoot, 'assets', f))
  }
  console.log(`本文の画像: ${want.size}枚を assets/ へ`)
}
await fs.writeFile(path.join(distRoot, 'index.html'), indexHtml(), 'utf8')

/** AI OSS技術解説の一覧（/vibeblog/oss.html）。VWork Blog の一覧と混ぜない */
function ossIndexHtml(): string {
  const url = `${BASE}/oss.html`
  const title = 'AI OSS技術解説｜オープンソースのAIを動かして日本語で解説'
  const desc = `オープンソースのAI・業務ソフトを実際に動かし、日本語で導入の手順とつまずく所を解説した記事を${ossPosts.length}本まとめています。株式会社エクスブリッジ（名古屋）。`
  const ld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', url, name: title, description: desc, inLanguage: 'ja',
    isPartOf: { '@type': 'Blog', '@id': `${BASE}/#blog` }, publisher: { '@id': `${SITE}/#organization` },
  }, {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'AI OSS技術解説', numberOfItems: ossPosts.length,
    itemListElement: ossPosts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/${p.slug}.html`, name: p.title })),
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'バイブコーディング的仕事ブログ', item: `${BASE}/` },
      { '@type': 'ListItem', position: 3, name: 'AI OSS技術解説', item: url }] }]
  const body = `
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">ホーム</a> ／ <a href="${BASE}/">バイブコーディング的仕事ブログ</a> ／ AI OSS技術解説</nav>
<header class="vb-head">
  <p class="vb-eyebrow">AI OSS技術解説 ・ 株式会社エクスブリッジ（名古屋）</p>
  <h1>AI OSS技術解説</h1>
  <p class="vb-tag"><strong>AI OSS技術解説とは、</strong>オープンソースのAI・業務ソフトを当社が実際に動かし、日本語で導入の手順とつまずく所を解説した記事です。現在 <strong>${ossPosts.length}本</strong>。</p>
</header>
<section class="vb-latest">
  <h2>新しい記事</h2>
  <div class="idx">${ossPosts.slice(0, 6).map((p) => card(`${BASE}/${p.slug}.html`, dateJa(p.date), p.title, p.description.slice(0, 82))).join('')}</div>
</section>
<section class="vb-archive">
  <h2>すべての記事<span class="vb-cnt">${ossPosts.length}本</span></h2>
  <ol class="vb-rows">${ossPosts.map((p) => `<li><a href="${BASE}/${attr(p.slug)}.html">` +
    `<time datetime="${attr(p.date)}">${h(dateDot(p.date))}</time>` +
    `<span class="vb-rt">${h(p.title)}</span></a></li>`).join('')}</ol>
</section>
${ctaBlock}
</main>`
  return shell(fitLength(32, title, 'AI OSS技術解説'), desc, url, body + styles(), ld)
}
if (ossPosts.length) await fs.writeFile(path.join(distRoot, 'oss.html'), ossIndexHtml(), 'utf8')

const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${BASE}/</loc><lastmod>${TODAY}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
${ossPosts.length ? `<url><loc>${BASE}/oss.html</loc><lastmod>${ossPosts[0].date || TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>` : ''}
${posts.map((p) => `<url><loc>${BASE}/${p.slug}.html</loc><lastmod>${p.date || TODAY}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`).join('\n')}
</urlset>`
await fs.writeFile(path.join(distRoot, 'sitemap.xml'), sm, 'utf8')

// GitHub Pages 側の canonical をこちらへ向け替えるための対応表。
// 元URL（articles/ と blog/ の両方）→ /vibeblog/ の1本。
const canonMap: Record<string, string> = {}
for (const p of loaded) canonMap[`${GHP}/${p.src}/${p.slug}.html`] = `${BASE}/${p.slug}.html`
await fs.writeFile(path.join(distRoot, 'canonical-map.json'), JSON.stringify(canonMap, null, 1), 'utf8')
// GitHub Pages 側（vwork/_layouts/default.html）が canonical を向け替える記事の一覧。
// AI OSS技術解説のうち移した記事だけ。新しい解説記事を足したら、vwork を commit/push すると向け替わる（2026-10-02）
{
  const moved = loaded.filter((p) => p.src === 'articles').map((p) => p.slug).sort()
  await fs.mkdir(path.join(VWORK, '_data'), { recursive: true })
  await fs.writeFile(path.join(VWORK, '_data', 'vibeblog_moved_articles.yml'),
    '# /vibeblog/ に移した AI OSS技術解説の記事（2026-10-02〜）。canonical をあちらへ向ける。\n' +
    '# kpayload/scripts/build-vibeblog.ts が書き出す（Horizon の自動ニュースまとめは含まない）\n' +
    moved.map((x) => `- ${x}\n`).join(''), 'utf8')
}

// RSS。xb4g.com は VWork Blog の新着をRSSで拾う作りなので、移設先でも同じ口を用意する
// （無いと xb4g のブログ欄が GitHub Pages の古いURLを指したままになる）。
const rfc822 = (d: string) => (d ? new Date(`${d}T09:00:00+09:00`).toUTCString() : new Date().toUTCString())
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>バイブコーディング的仕事ブログ</title>
<link>${BASE}/</link>
<atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>
<description>${h(`バイブコーディングのフレームワーク VWork と、バイブコーディングでやった仕事の解説・考察。株式会社エクスブリッジ（名古屋）。`)}</description>
<language>ja</language>
<lastBuildDate>${rfc822(blogPosts[0]?.date || TODAY)}</lastBuildDate>
${blogPosts.slice(0, 50).map((p) => `<item>
<title><![CDATA[${p.title}]]></title>
<link>${BASE}/${p.slug}.html</link>
<guid isPermaLink="true">${BASE}/${p.slug}.html</guid>
<pubDate>${rfc822(p.date)}</pubDate>
<description><![CDATA[${p.description}]]></description>
</item>`).join('\n')}
</channel>
</rss>`
await fs.writeFile(path.join(distRoot, 'feed.xml'), feed, 'utf8')

const long = posts.filter((p) => visibleLength(fitLength(32, p.seoTitle, p.title)) > 32).length
console.log(`vibeblog: 記事${posts.length}ページ + index/feed/sitemap`)
console.log(`  元は${loaded.length}本。本文が同一の重複${merged.length}本を1本にまとめた`)
console.log(`  canonical-map.json: ${Object.keys(canonMap).length}件（GitHub側の向け替え用・sitemapには入れない）`)
console.log(`  titleが全角32を超えたまま: ${long}本`)
console.log(`  descriptionが空: ${posts.filter((p) => !p.description).length}本`)
process.exit(0)
