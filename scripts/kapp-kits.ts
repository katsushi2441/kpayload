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
  codealmanac: { id: 'b81d730eb535b454', label: 'CodeAlmanac 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-03-codealmanac-linux-guide.html' },
  // 2026-09-04 受け皿強化4本（Google流入のあるOSS名→商品ページへの導線）
  vikunja: { id: '767ea5a2f7963f2a', label: 'Vikunja 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-03-vikunja-japanese-guide.html' },
  docmost: { id: '7495b31ca104b483', label: 'Docmost 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-03-docmost-japanese-guide.html' },
  planka: { id: '1364b33c7d1cde58', label: 'Planka 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-planka-japanese-guide.html' },
  docspell: { id: '7f9481c10a09b560', label: 'Docspell 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-docspell-japanese-guide.html' },
  // 導入キットではなく「そのOSSを使って当社が作った買い切り製品」。
  // kkintai は勤怠分類(/ai-system/c/attendance/・GSC 11.8位)の出口。分類ページのカード列にも出す。
  kkintai: { id: 'f0f56c6e4da881be', label: '顔打刻つき勤怠管理 Kurage Kintai（買い切り）を見る', price: '税込55,000円（買い切り）', product: true },
  whisper: { id: 'cd1eda3248c87920', label: 'Whisperで動く買い切りのAI議事録（Kurage AI MOM）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-whisper-cpp-japanese-transcription.html' },
  'whisper-cpp': { id: 'cd1eda3248c87920', label: 'whisper.cppで動く買い切りのAI議事録（Kurage AI MOM）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-whisper-cpp-japanese-transcription.html' },
  // 全文検索×AIチャット（Namazu実績→Fessでも同構成）。出口は買い切りのチャットボット
  namazu: { id: '224e141f77bd07a8', label: 'Namazu検索×AIチャットの土台（Kurage Light ChatBot・買い切り）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/blog/2026-09-04-namazu-ai-chat-knowledge.html' },
  fess: { id: '224e141f77bd07a8', label: 'Fess検索×AIチャットの土台（Kurage Light ChatBot・買い切り）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/blog/2026-09-04-namazu-ai-chat-knowledge.html' },
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
 * 複数のキットをカード列で出す。分類一覧(/ai-system/c/)やSaaS代替(/saas/)のように
 * 1ページに複数OSSが並ぶ場所用。製品(product)は除く。該当が無ければ空文字。
 * name は呼び出し側でエスケープ済みのものを渡す。
 */
export function kappKitCards(list: Array<{ slug: string; name: string }>, ref: string): string {
  const seen = new Set<string>()
  // 同じ id の製品(postgis/kshoken)が2枚並ばないよう id でも重複を除く
  const seenId = new Set<string>()
  const rows = list.filter((p) => KAPP_KITS[p.slug] && !seen.has(p.slug) && seen.add(p.slug)
    && !seenId.has(KAPP_KITS[p.slug].id) && seenId.add(KAPP_KITS[p.slug].id))
  if (!rows.length) return ''
  return `<div class="grid">${rows.map((p) => {
    const kit = KAPP_KITS[p.slug]
    const article = kit.article
      ? `<a class="btn" href="${kit.article}?ref=${ref}" target="_blank" rel="noopener">導入の実録記事</a>`
      : ''
    const lead = kit.product
      ? `同じ用途で当社が作った、設置手順つきの買い切り製品。開発を依頼せず自社で動かしたい場合の早道です。`
      : `当社が実際に立てて詰まった箇所まで含めた手順書・設計テンプレート・docker構成・バックアップスクリプトの一式。`
    return `<div class="card"><h3>${kit.label.replace(/を見る$/, '')}</h3><p>${lead}${kit.price ? `<strong>${kit.price}</strong>。` : ''}</p><div class="kit-actions"><a class="btn btn-main" href="https://kappstore.exbridge.jp/app.php?id=${kit.id}&ref=${ref}">${kit.product ? '製品を見る' : 'キットを見る'}</a>${article}</div></div>`
  }).join('')}</div>`
}

/** キット名の一覧（本文の言い回し用）。該当が無ければ空文字。 */
export function kappKitNames(list: Array<{ slug: string; name: string }>): string {
  const seen = new Set<string>()
  return list.filter((p) => KAPP_KITS[p.slug] && !KAPP_KITS[p.slug].product && !seen.has(p.slug) && seen.add(p.slug))
    .map((p) => p.name).join('・')
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
