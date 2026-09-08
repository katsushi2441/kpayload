/**
 * exbridge.jp/politech/ — 政治・政策キーワードごとのページ（1キーワード1ページ）。
 *
 * 何のためか（2026-09-08）: 防災・子育て・不登校・福祉・給付金・選挙などの検索語に、
 * 「政党・議員事務所が動くページと道具で応える」形で答え、solution/seito.html・Kurage党・
 * kappstore・AI-IT顧問契約へ送る受け皿。/saas/ /ai-system/ /solution/ と同じ共通シェル。
 *
 * データ: data/politech-keywords.json（politech-keywords.py）＋ data/politech-copy.json（politech-copy.py・gemma4）
 * 出力:   /home/kojima/work/exbridge_jp/politech/<slug>.html + index.html + sitemap.xml
 * 配置:   bash scripts/deploy.sh politech
 *   npx tsx scripts/build-politech.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE, KURAGE } from './site'
import { TODAY, h, attr, shell as baseShell } from './page-shell'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = '/home/kojima/work/exbridge_jp/politech'
const BASE = `${SITE}/politech`
const KAPP = 'https://kappstore.exbridge.jp/app.php?id='
const REF = 'politech'

type Kw = { slug: string; keyword: string; query: string; volume: number; competition: string; index: number | null; theme: string; theme_name: string; intent: string }
type Copy = { title: string; h1: string; lead: string; points: string[]; answer: string[]; steps: { t: string; b: string }[]; faq: { q: string; a: string }[] }

const kws = JSON.parse(await fs.readFile(path.join(root, 'data', 'politech-keywords.json'), 'utf8')) as Kw[]
const copy = JSON.parse(await fs.readFile(path.join(root, 'data', 'politech-copy.json'), 'utf8')) as Record<string, Copy>

type Tool = { name: string; what: string; demo?: string; buy?: string }
const T = {
  khazard: { name: 'Kurage 土砂災害ハザードマップ', what: '住所を入れると警戒区域か特別警戒区域かを判定', demo: `${KURAGE}/khazard.php/?ref=${REF}`, buy: `${KAPP}02b945f9c87c9d86&ref=${REF}` },
  kflood: { name: 'Kurage 洪水・内水ハザードマップ', what: '住所を入れると洪水で何メートル・何日浸かる想定かと内水の浸水深が出る。マイ・タイムライン生成つき', demo: `${KURAGE}/kflood.php/?ref=${REF}`, buy: `${KAPP}41a09acc163dcb7d&ref=${REF}` },
  ktsunami: { name: 'Kurage 津波浸水想定マップ', what: '住所を入れると津波の浸水深と海抜が出る', demo: `${KURAGE}/ktsunami.php/?ref=${REF}`, buy: `${KAPP}86b85a63bc426575&ref=${REF}` },
  krefuge: { name: 'Kurage 避難所マップ', what: '災害種別で使える避難所まで徒歩何分か', demo: `${KURAGE}/krefuge.php/?ref=${REF}`, buy: `${KAPP}162f155897390072&ref=${REF}` },
  kecnavi: { name: 'Kurage 通報先ナビ', what: '道路の穴・不法投棄・街路灯。住所で通報先の電話が出る', demo: `${KURAGE}/kecnavi.php/?ref=${REF}`, buy: `${KAPP}32502ed71cea6bcf&ref=${REF}` },
  kfacilities: { name: 'Kurage 施設検索', what: '今日使える体育館を日付・時間帯・種目・区で横断検索', demo: `${KURAGE}/kfacilities.php/?ref=${REF}`, buy: `${KAPP}8e76e53cf264cc1c&ref=${REF}` },
  kseido: { name: 'Kurage 制度ナビ', what: '困りごと→使える制度と区役所の課・電話・期限・必要書類・出典。相談記録つき', demo: `${KURAGE}/kseido.php/?ref=${REF}`, buy: `${KAPP}237974724fb41216&ref=${REF}` },
  kouchou: { name: '広聴AI 完全ローカル導入キット', what: '住民・支援者の声をAIで「何が何件」の1枚に。意見が外に出ない', demo: `${KURAGE}/kouchou-demo/nagoya-machizukuri-sample/`, buy: `${KAPP}53493d74a09cfd8c&ref=${REF}` },
  fixmystreet: { name: 'FixMyStreet 日本語導入キット', what: '困りごとの通報を受け、対応の進捗を公開する', demo: `${KURAGE}/chibarepo-daitai.php?ref=${REF}`, buy: `${KAPP}b34e36cfaad27a14&ref=${REF}` },
  alaveteli: { name: 'Alaveteli 日本語導入キット', what: '情報公開請求の請求文と回答を公開する', demo: `${KURAGE}/johokokai-seikyu.php?ref=${REF}`, buy: `${KAPP}025aa9bee5dd411e&ref=${REF}` },
  kshoken: { name: 'Kurage 商圏分析（選挙区分析）', what: '住所→徒歩・車N分圏の人口・年齢構成', demo: `${KURAGE}/kshoken.php/?ref=${REF}`, buy: `${KAPP}a5ac4b9f1fdb6d19&ref=${REF}` },
  kbilling: { name: '請求書発行 kbilling／領収書 kinvoice', what: '会費の請求と消し込み、寄附やパーティー券の領収書', buy: `${KAPP}15abb025dc2ee4f6&ref=${REF}` },
} satisfies Record<string, Tool>

const THEME_TOOLS: Record<string, (keyof typeof T)[]> = {
  bousai: ['kflood', 'khazard', 'ktsunami', 'krefuge', 'kseido'],
  kosodate: ['kseido', 'kfacilities', 'kouchou'],
  shussan: ['kseido', 'kouchou'],
  kyoiku: ['kseido', 'kouchou'],
  futoko: ['kseido', 'kouchou'],
  fukushi: ['kseido', 'kecnavi'],
  seikatsu: ['kseido', 'kecnavi', 'fixmystreet'],
  senkyo: ['alaveteli', 'kbilling', 'kouchou'],
  chiiki: ['kseido', 'kshoken', 'kecnavi'],
  nagoya: ['kecnavi', 'kseido', 'kfacilities', 'kflood', 'khazard'],
}
const THEME_PV: Record<string, string[]> = {
  bousai: ['bousai', 'hazard', 'giin'], kosodate: ['kecnavi', 'giin', 'kfacilities'], shussan: ['kecnavi', 'giin'], kyoiku: ['kecnavi', 'giin'],
  futoko: ['kecnavi', 'giin'], fukushi: ['kecnavi', 'giin'], seikatsu: ['kecnavi', 'giin'], senkyo: ['giin', 'kecnavi'], chiiki: ['kecnavi', 'giin'], nagoya: ['kecnavi', 'kfacilities', 'bousai'],
}
const INTENT_JA: Record<string, string> = { place: '場所・一覧を知りたい', howto: 'やり方・手続きを知りたい', benefit: '制度・給付を知りたい', define: '意味・対策を知りたい', topic: '全体像を知りたい' }

const themeOrder = ['bousai', 'kosodate', 'shussan', 'kyoiku', 'futoko', 'fukushi', 'seikatsu', 'senkyo', 'chiiki', 'nagoya']
const themeName = Object.fromEntries(kws.map((k) => [k.theme, k.theme_name]))
const byTheme = new Map<string, Kw[]>()
for (const k of kws) byTheme.set(k.theme, [...(byTheme.get(k.theme) || []), k])

const shellFor = (theme: string) => (t: string, d: string, u: string, b: string, l: unknown[]) => baseShell(t, d, u, b, l, {
  refPrefix: 'exbridge-politech', base: BASE, ogImage: `${SITE}/images/ogp/politech-${theme}.png`, pvTags: THEME_PV[theme] || ['giin'],
  footerLinks: `<a href="${SITE}/company">会社概要</a>　<a href="${SITE}/contact.php">無料相談</a>　<a href="${BASE}/">政治・政策キーワードから探す</a>　<a href="${SITE}/solution/seito.html">政党・政治団体のAI活用</a>　<a href="${SITE}/ai-it-komon.html">AI-IT顧問契約</a>　<a href="${KURAGE}/vibe-political-party.php">Kurage党</a>　<a href="https://kappstore.exbridge.jp/">Kurage App Store</a>`,
})

const styles = `<style>
.pt-hero{background:linear-gradient(120deg,#10242b,#14343d);color:#fff;padding:48px 0 36px}.pt-hero .kicker{color:#7fe3d6;font-size:13px;font-weight:800;letter-spacing:.06em;margin:0 0 10px}
.pt-hero h1{font-size:clamp(24px,4.2vw,40px);line-height:1.4;margin:0 0 12px}.pt-hero .lead{font-size:16px;color:#cfe2e4;max-width:820px;margin:0 0 6px}
.pt-hero .vol{display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:4px 12px;font-size:12.5px;color:#e6f4f2;margin:6px 0 10px}
.pt-points{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pt-points>*{min-width:0}
.pt-point{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;gap:10px;align-items:flex-start}.pt-point .n{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#0a9a8f;color:#fff;font-weight:900;flex:none}
.pt-answer p{font-size:15.5px;margin:0 0 12px}
.pt-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pt-steps>*{min-width:0}.pt-step{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}.pt-step .num{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#0a9a8f;color:#fff;font-weight:900;margin-bottom:6px}.pt-step h3{font-size:15px}.pt-step p{margin:0;font-size:13.5px;color:var(--muted)}
.pt-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pt-tools>*{min-width:0}.pt-tool{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}.pt-tool b{display:block;font-size:15px}.pt-tool p{margin:4px 0 8px;font-size:13.5px;color:var(--muted)}.pt-tool .btn{min-height:36px;padding:6px 14px;font-size:13px}
.pt-kp{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:center}.pt-kp>*{min-width:0}.pt-kp img{width:100%;height:auto;border-radius:12px;border:1px solid var(--line)}
.pt-cta{background:linear-gradient(135deg,#e8faf6,#fff8e5);border:1px solid #bddfd9;border-radius:13px;padding:22px;margin:22px 0}
.pt-rel{display:flex;flex-wrap:wrap;gap:8px}.pt-rel a{border:1px solid var(--line);border-radius:999px;padding:5px 12px;text-decoration:none;font-size:13.5px;background:#fff;color:var(--ink)}.pt-rel a small{color:var(--muted)}
.pt-faq .card{margin:0 0 10px}
.pt-index h2{margin-top:8px}.pt-index .cat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:820px){.pt-points,.pt-steps,.pt-tools,.pt-kp,.pt-index .cat-grid{grid-template-columns:1fr}}
</style>`

const vol = (n: number) => n.toLocaleString('ja-JP')
const kappNote = '住民サービスの買い切り版は各55,000円（税込）、導入キットは各5,500円（税込）。月額なし・ソースコード同梱。'

function pageHtml(k: Kw): string {
  const c = copy[k.slug]
  const url = `${BASE}/${k.slug}.html`
  const title = `${c.title}｜政党・議員事務所が動くページで答える | 株式会社エクスブリッジ`
  const desc = c.lead.slice(0, 118)
  const tools = (THEME_TOOLS[k.theme] || ['kseido']).map((id) => T[id])
  const related = (byTheme.get(k.theme) || []).filter((x) => x.slug !== k.slug).slice(0, 12)
  const contact = `${SITE}/contact.php?subject=${encodeURIComponent(`${k.keyword}（政党・政治団体のAI活用の相談）`)}`
  const body = `
<section class="pt-hero"><div class="wrap">
<p class="kicker">政治・政策キーワード｜${h(k.theme_name)}｜${h(INTENT_JA[k.intent] || '')}</p>
<h1>${h(c.h1)}</h1>
<p class="lead">${h(c.lead)}</p>
<span class="vol">「${h(k.keyword)}」の検索: 月におよそ${vol(k.volume)}回（Keyword Planner・2026年9月実測）</span>
<p><a class="btn btn-main" href="${contact}">無料で相談する（Zoom可）</a> <a class="btn" href="${SITE}/solution/seito.html?ref=${REF}-${attr(k.slug)}">政党・政治団体のAI活用 →</a> <a class="btn" href="${KURAGE}/vibe-political-party.php?ref=${REF}-${attr(k.slug)}">Kurage党で実物を見る</a></p>
</div></section>
<main class="wrap">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / <a href="${BASE}/">政治・政策キーワード</a> / <a href="${BASE}/#${attr(k.theme)}">${h(k.theme_name)}</a> / ${h(k.keyword)}</nav>

<section><div class="panel">
<h2>「${h(k.keyword)}」で探している人が知りたいこと</h2>
<div class="pt-points">${c.points.slice(0, 3).map((p, i) => `<div class="pt-point"><span class="n">${i + 1}</span><div>${h(p)}</div></div>`).join('')}</div>
</div></section>

<section><div class="panel pt-answer">
<h2>答え</h2>
${c.answer.slice(0, 2).map((p) => `<p>${h(p)}</p>`).join('')}
<p class="note">制度の金額・期限・要件は自治体や国の公式ページで確認してください。このページは政党・議員事務所が住民の問いにどう応えるかを整理したもので、特定の政党・候補者を支持・批判するものではありません。</p>
</div></section>

<section><div class="panel">
<h2>政党・議員事務所ができること（3ステップ）</h2>
<div class="pt-steps">${c.steps.slice(0, 3).map((s, i) => `<div class="pt-step"><span class="num">${i + 1}</span><h3>${h(s.t)}</h3><p>${h(s.b)}</p></div>`).join('')}</div>
</div></section>

<section><div class="panel">
<h2>この課題で使える、買い切りの道具</h2>
<p>名古屋市版のデモに無料で触れられます。実在の政党・議員事務所は「事務所の名前」でそのまま公開できます。当社は全政党・全会派・無所属に同じ条件で提供します。</p>
<div class="pt-tools">${tools.map((t) => `<div class="pt-tool"><b>${h(t.name)}</b><p>${h(t.what)}</p>${t.demo ? `<a class="btn btn-main" href="${attr(t.demo)}" target="_blank" rel="noopener">触れる</a>` : ''}${t.buy ? `<a class="btn" href="${attr(t.buy)}" target="_blank" rel="noopener">買い切り版（Kurage App Store）</a>` : ''}</div>`).join('')}</div>
<p class="note">${kappNote} <a href="https://kappstore.exbridge.jp/?ref=${REF}" target="_blank" rel="noopener">Kurage App Store</a></p>
</div></section>
${(k.theme === 'bousai' || k.theme === 'nagoya') ? `
<section><div class="panel">
<h2>名古屋市を区・河川から見る（いまの避難情報つき）</h2>
<p>市の災害情報配信に出ている警戒レベルを河川別・区別に並べ、氾濫時の対象学区、区ごとの浸水のおそれ、避難先の探し方までつなげたページです。${k.slug === 'hazaado-mappu-nagoya' ? '「ハザードマップ 名古屋」で探している方は、まず区のページから自宅の学区と浸水のおそれを確かめ、住所を入れて何メートル・何日浸かる想定かを見てください。' : '住所を入れれば何メートル・何日浸かる想定かも分かります。'}</p>
<div class="pt-rel">${[['名古屋市の一覧（区・河川・いまの発令）', 'nagoya/'], ['天白川の氾濫・避難情報', 'river/tempaku/'], ['矢田川の氾濫・避難情報', 'river/yada/'], ['新川の氾濫・避難情報', 'river/shinkawa/'], ['堀川・新堀川', 'river/horikawa/'], ['中川区', 'nagoya/nakagawa/'], ['港区', 'nagoya/minato/'], ['西区', 'nagoya/nishi/'], ['天白区', 'nagoya/tempaku/'], ['北区', 'nagoya/kita/']].map(([n, u]) => `<a href="${KURAGE}/kflood.php/${u}?ref=${REF}-${attr(k.slug)}" target="_blank" rel="noopener">${h(n)}</a>`).join('')}</div>
<p class="note">出典: 名古屋市 災害情報配信（警戒レベル・対象学区の事実のみ）、国土数値情報 洪水浸水想定区域 第4.0版、名古屋市 内水氾濫ハザードマップ（CC BY 4.0）。</p>
</div></section>
` : ''}
<section><div class="panel">
<h2>Kurage党で、先に動かしています</h2>
<div class="pt-kp">
<div>
<p>当社は架空政党「Kurage党」を実験場として、住民サービスを「公約ではなく動くページ」で先に公開しています。上の道具はその住民サービス部で稼働中のものです。党員（技術担当）の BittensorMan（当社代表・小嶋篤）が開発しています。Kurage党は実在のいかなる政党・団体とも関係ありません。</p>
<p><a class="btn btn-main" href="${KURAGE}/vibe-political-party.php?ref=${REF}-${attr(k.slug)}">Kurage党 党本部サイト →</a> <a class="btn" href="${KURAGE}/?ref=${REF}-${attr(k.slug)}#party">党員 BittensorMan →</a> <a class="btn" href="${SITE}/solution/seito.html?ref=${REF}-${attr(k.slug)}">政党・政治団体のAI活用（一覧）→</a></p>
</div>
<a href="${KURAGE}/vibe-political-party.php?ref=${REF}-${attr(k.slug)}"><img src="${KURAGE}/images/ogp-kurage-party-v2.png" alt="Kurage党（架空政党）の党本部サイト" width="1200" height="630" loading="lazy"></a>
</div>
</div></section>

<div class="pt-cta">
<h2>AI-IT顧問契約は、政党・政治団体にも提供します</h2>
<p><strong>月15時間・税別150,000円（名古屋市内限定・月次契約）。</strong>相談の入口づくり、住民サービスの公開、意見集約、会計や領収書の自動化を、時間の中で一つずつ動かします。キャンペーン期間中は Kurage App Store の商品代金が無料です。名古屋市外の団体は買い切り商品と導入キットを全国でお使いいただけます。</p>
<a class="btn btn-main" href="${SITE}/ai-it-komon.html?ref=${REF}-${attr(k.slug)}">AI-IT顧問契約の詳細 →</a>
<a class="btn" href="${contact}">初回相談（無料）</a>
</div>

<section><div class="panel pt-faq"><h2>よくある質問</h2>
${c.faq.slice(0, 3).map((f) => `<div class="card"><h3>${h(f.q)}</h3><p>${h(f.a)}</p></div>`).join('')}
</div></section>

${related.length ? `<section><div class="panel"><h2>${h(k.theme_name)}の関連キーワード</h2><div class="pt-rel">${related.map((r) => `<a href="${BASE}/${attr(r.slug)}.html">${h(r.keyword)} <small>${vol(r.volume)}</small></a>`).join('')}</div></div></section>` : ''}

<section><div class="panel"><p class="note">検索数は Google 広告のキーワードプランナーによる当社の実測（2026年9月）で、変動します。記載のサービス名・製品名は各社の商標です。Kurage党は架空の政治団体です。</p></div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faq.slice(0, 3).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'ja', dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` }, publisher: { '@id': `${SITE}/#organization` }, about: { '@type': 'Thing', name: k.keyword } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: '政治・政策キーワード', item: `${BASE}/` }, { '@type': 'ListItem', position: 3, name: k.keyword, item: url }] },
  ]
  return shellFor(k.theme)(title, desc, url, body + styles, ld)
}

function indexHtml(): string {
  const url = `${BASE}/`
  const title = '政治・政策キーワードから探す｜政党・議員事務所が「動くページ」で答える課題一覧 | 株式会社エクスブリッジ'
  const desc = `防災・子育て・不登校・福祉・給付金・選挙・地域の${kws.length}の検索語ごとに、住民が知りたいことと、政党・議員事務所が動くページと買い切りの道具で応える方法をまとめました。`
  const body = `
<section class="pt-hero"><div class="wrap">
<p class="kicker">政治・政策キーワード｜${kws.length}語</p>
<h1>住民が検索している言葉に、<br>政党・議員事務所が「動くページ」で答える。</h1>
<p class="lead">防災・子育て・不登校・福祉・給付金・選挙・地域。Google 広告のキーワードプランナーで月間検索数を実測した${kws.length}の言葉ごとに、住民が知りたいことと、事務所ができること、使える買い切りの道具をまとめています。</p>
<p><a class="btn btn-main" href="${SITE}/solution/seito.html?ref=${REF}-index">政党・政治団体のAI活用 →</a> <a class="btn" href="${SITE}/ai-it-komon.html?ref=${REF}-index">AI-IT顧問契約</a> <a class="btn" href="${KURAGE}/vibe-political-party.php?ref=${REF}-index">Kurage党</a></p>
</div></section>
<main class="wrap pt-index">
<nav class="crumb"><a href="${SITE}/">株式会社エクスブリッジ</a> / 政治・政策キーワード</nav>
${themeOrder.filter((t) => byTheme.has(t)).map((t) => `<section id="${attr(t)}"><div class="panel"><h2>${h(themeName[t])} <span class="note">${byTheme.get(t)!.length}語</span></h2><div class="cat-grid">${byTheme.get(t)!.map((k) => `<a class="cat-card" href="${BASE}/${attr(k.slug)}.html"><b>${h(k.keyword)}</b><span>月間およそ${vol(k.volume)}回・${h(INTENT_JA[k.intent] || '')}</span></a>`).join('')}</div></div></section>`).join('\n')}
<section><div class="panel"><p class="note">検索数は Google 広告のキーワードプランナーによる当社の実測（2026年9月）。特定の政党・候補者を支持・批判するものではありません。Kurage党は架空の政治団体です。</p></div></section>
</main>`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, description: desc, inLanguage: 'ja', dateModified: TODAY, isPartOf: { '@type': 'WebSite', name: '株式会社エクスブリッジ', url: `${SITE}/` } },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: '政治・政策キーワード', numberOfItems: kws.length, itemListElement: kws.slice(0, 200).map((k, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/${k.slug}.html`, name: k.keyword })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '株式会社エクスブリッジ', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: '政治・政策キーワード', item: url }] },
  ]
  return shellFor('senkyo')(title, desc, url, body + styles, ld)
}

await fs.mkdir(outDir, { recursive: true })
let n = 0
const missing: string[] = []
for (const k of kws) {
  if (!copy[k.slug]) { missing.push(k.slug); continue }
  await fs.writeFile(path.join(outDir, `${k.slug}.html`), pageHtml(k), 'utf8')
  n++
}
const built = kws.filter((k) => copy[k.slug])
await fs.writeFile(path.join(outDir, 'index.html'), indexHtml(), 'utf8')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${BASE}/</loc><lastmod>${TODAY}</lastmod></url>\n${built.map((k) => `<url><loc>${BASE}/${k.slug}.html</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`
await fs.writeFile(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8')
await fs.writeFile(path.join(root, 'outputs', 'indexnow_exbridge_politech.txt'), [`${BASE}/`, ...built.map((k) => `${BASE}/${k.slug}.html`)].join('\n') + '\n', 'utf8')
console.log(`politech: ${n}ページ + index/sitemap（本文未生成 ${missing.length}: ${missing.slice(0, 5).join(', ')}）`)
