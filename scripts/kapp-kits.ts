/**
 * OSSのslug → Kurage App Store の商品。
 *
 * カタログ(/oss/)とAIでできること(/ai-system/)の両方から同じ対応表を使う。
 * 二重に持つと片方だけ古くなるので、ここ1か所に置く。
 * 「導入キット」と「そのOSSで当社が作った製品」は別物なので、label で区別する。
 */
export type KappKit = {
  id: string
  label: string
  /** 税込価格の表示文字列。ページに出すのは確定しているものだけ。 */
  price?: string
  /** 導入の実録記事（AI OSS技術解説ブログ）。あればキット枠に並べる。 */
  article?: string
  /** 導入キットではなく「そのOSSで当社が作った買い切り製品」。文言を変える。 */
  product?: true
}

export const KAPP_KITS: Record<string, KappKit> = {
  espocrm: { id: '9d27eb0ebe2fc7e0', label: 'EspoCRM 日本語導入キットを見る' },
  freescout: { id: '6d0e2c491e4170da', label: 'FreeScout 日本語導入キットを見る' },
  billionmail: { id: '495b5aca4ee119db', label: 'BillionMail 日本語導入キットを見る' },
  'decap-cms': { id: 'a3b60acb11b65f47', label: 'Decap CMS 日本語導入キットを見る' },
  'krayin-crm': { id: '11e7c1d9a83d1ca3', label: 'Krayin CRM 日本語導入キットを見る', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-02-krayin-japanese-merged.html' },
  libredesk: { id: '104c05db7779a709', label: 'LibreDesk 日本語導入キットを見る' },
  'kouchou-ai': { id: '53493d74a09cfd8c', label: '広聴AI 完全ローカル導入キットを見る' },
  // 2026-09-04 受け皿強化4本（Google流入のあるOSS名→商品ページへの導線）
  vikunja: { id: '767ea5a2f7963f2a', label: 'Vikunja 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-03-vikunja-japanese-guide.html' },
  docmost: { id: '7495b31ca104b483', label: 'Docmost 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-03-docmost-japanese-guide.html' },
  planka: { id: '1364b33c7d1cde58', label: 'Planka 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-planka-japanese-guide.html' },
  docspell: { id: '7f9481c10a09b560', label: 'Docspell 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-docspell-japanese-guide.html' },
  // 導入キットではなく「そのOSSを使って当社が作った買い切り製品」。
  whisper: { id: 'cd1eda3248c87920', label: 'whisper.cppで動く買い切りのAI議事録を見る', product: true },
  postgis: { id: 'a5ac4b9f1fdb6d19', label: 'PostGISで作った商圏分析システム(買い切り)を見る', product: true },
  kshoken: { id: 'a5ac4b9f1fdb6d19', label: '設置手順つきの買い切り版を見る', product: true },
}

/** 商品ページへのリンク1本。該当が無ければ空文字。 */
export function kappKitLink(slug: string, ref: string, cls = 'btn'): string {
  const kit = KAPP_KITS[slug]
  if (!kit) return ''
  return `<a class="${cls}" href="https://kappstore.exbridge.jp/app.php?id=${kit.id}&ref=${ref}">${kit.label}</a>`
}

/**
 * 導入キット枠の中身（見出し＋説明＋ボタン）。該当が無ければ空文字。
 * /oss/ と /ai-system/ の両方がこれを使い、外側の panel だけ各自で包む。
 * name は呼び出し側でエスケープ済みのものを渡す。
 */
export function kappKitPanel(slug: string, ref: string, name: string): string {
  const kit = KAPP_KITS[slug]
  if (!kit) return ''
  const price = kit.price ? `<strong>${kit.price}</strong>。` : ''
  const article = kit.article
    ? `<a class="btn" href="${kit.article}?ref=${ref}" target="_blank" rel="noopener">導入の実録記事を読む</a>`
    : ''
  const heading = kit.product ? `${name}で作った買い切り製品` : `${name}を自分で入れるなら（導入キット）`
  const lead = kit.product
    ? `${name}を組み込んで当社が作った、設置手順つきの買い切り製品です。開発を依頼せず自社で動かしたい場合の早道です。`
    : `当社が実際に立てて詰まった箇所まで含めた手順書・設計テンプレート・docker構成・バックアップスクリプトの一式です。開発を依頼せず自社で立てたい場合の早道です。${price}`
  return `<h2>${heading}</h2><p>${lead}</p><div class="kit-actions">${kappKitLink(slug, ref, 'btn btn-main')}${article}</div>`
}
