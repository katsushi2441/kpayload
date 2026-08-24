/**
 * proto.exbridge.jp に置いてある「触れるデモ」の一覧。
 *
 * 3つの入口(/oss/ /saas/ /ai-system/)から共通で参照する。ここだけ直せば
 * 全ページに効く。IDとパスワードを本文に出しているのは、問い合わせを
 * 挟むと試す前に離脱するため。公開しているのは一般権限のデモ利用者だけで、
 * 管理者アカウントは載せない（proto側で demo ユーザーを別に作ってある）。
 */
export const PROTO = 'https://proto.exbridge.jp'

export type Demo = {
  /** proto.exbridge.jp/#<anchor> のカード位置 */
  anchor: string
  /** 直接開くURL（ログイン画面） */
  url: string
  user: string
  pass: string
  /** 「このデモで何を確かめられるか」。汎用文ではなく製品ごとに書く */
  point: string
}

/** キーは /oss/ のslug。SaaS側・できること側はこのslugで引く。 */
export const DEMOS: Record<string, Demo> = {
  espocrm: {
    anchor: 'espocrm',
    url: `${PROTO}/espocrm/`,
    user: 'demo',
    pass: 'demo2026',
    point: '通話・商談・タスクが標準で入っています。架電の予定と結果を記録する流れを、全画面日本語で確かめられます。',
  },
  'krayin-crm': {
    anchor: 'krayin',
    url: `${PROTO}/krayin/admin/login`,
    user: 'demo@exbridge.jp',
    pass: 'demo2026',
    point: '当社が全2,066キーを日本語化したものです。リードのかんばん表示と見積作成を確かめられます。',
  },
}

export const hasDemo = (slug: string): boolean => slug in DEMOS

/** ref付きのデモURL。どのページから来たか計測する */
export const demoUrl = (slug: string, ref: string): string => {
  const d = DEMOS[slug]
  if (!d) return ''
  return `${d.url}${d.url.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`
}

/** デモ一覧ページの、そのOSSのカード位置へのリンク */
export const protoUrl = (slug: string, ref: string): string => {
  const d = DEMOS[slug]
  return d ? `${PROTO}/?ref=${encodeURIComponent(ref)}#${d.anchor}` : `${PROTO}/?ref=${encodeURIComponent(ref)}`
}

const esc = (v: unknown) => String(v ?? '')

/**
 * 「触れるデモがあります」の枠。3つの入口で同じ見た目にする。
 * compact=true は一覧・カード内で使う1行版。
 */
export function demoPanel(slug: string, name: string, ref: string, compact = false): string {
  const d = DEMOS[slug]
  if (!d) return ''
  const open = `<a class="btn btn-main" href="${demoUrl(slug, ref)}" target="_blank" rel="noopener">${esc(name)}のデモを開く</a>`
  if (compact) {
    return `<p class="demo-line">触れるデモあり — <code>${esc(d.user)}</code> / <code>${esc(d.pass)}</code>　<a href="${demoUrl(slug, ref)}" target="_blank" rel="noopener">${esc(name)}のデモを開く</a></p>`
  }
  return `<section class="panel demo-panel" id="demo">
<h2>${esc(name)}は、いま触れます</h2>
<p>${esc(d.point)}当社が日本語化して稼働させているものを、そのまま公開しています。<strong>問い合わせも資料請求も要りません。</strong></p>
<dl class="demo-cred"><div><dt>ユーザー</dt><dd><code>${esc(d.user)}</code></dd></div><div><dt>パスワード</dt><dd><code>${esc(d.pass)}</code></dd></div></dl>
<p class="demo-actions">${open} <a class="btn" href="${protoUrl(slug, ref)}">他のデモも見る</a></p>
<p class="demo-note">デモのためメールは送信されません。データは公開の場所にあるので、実在の個人情報は入れないでください。定期的に初期化します。</p>
</section>`
}

/** デモ枠のCSS。3入口とも共通 */
export const DEMO_CSS = `.demo-panel{background:linear-gradient(135deg,#e8faf6,#fff8e5);border-color:#b9ded8}.demo-cred{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0;padding:12px 14px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:rgba(255,255,255,.75)}.demo-cred div{display:flex;align-items:center;gap:8px}.demo-cred dt{font-size:12px;opacity:.75;margin:0}.demo-cred dd{margin:0}.demo-cred code{font-size:13px;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:6px;padding:2px 8px}.demo-note{font-size:12px;opacity:.75;margin-bottom:0}.demo-actions{margin:0 0 12px}.demo-actions .btn{margin:5px 5px 0 0}.demo-line{font-size:13px;margin:8px 0 0;padding:8px 11px;border:1px solid #b9ded8;border-radius:10px;background:#eefaf7}.demo-line code{background:#fff;border-radius:5px;padding:1px 6px;font-size:12px}.demo-badge{display:inline-block;background:#0f8a7e;color:#fff;border-radius:999px;padding:3px 9px;font-size:10px;font-weight:900;margin-left:6px}
@media(max-width:620px){.demo-cred{flex-direction:column;gap:6px}}`
