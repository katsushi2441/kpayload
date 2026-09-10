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
  pdfmathtranslate: { id: '8adb859f30cb8cc5', label: 'PDFMathTranslate 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-pdf-translation-selfhosted.html' },
  // paperless-ngx は「日本語OCRが3か所直さないと効かない」実測が売り。
  // 表記ゆれ（paperless / paperless-ngx）どちらのslugでも同じキットへ寄せる。
  'paperless-ngx': { id: '2c8193abe130c90c', label: 'paperless-ngx 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-05-paperless-ngx-japanese-ocr.html' },
  paperless: { id: '2c8193abe130c90c', label: 'paperless-ngx 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-05-paperless-ngx-japanese-ocr.html' },
  // Appsmith は翻訳キットではなく「初回起動の破損からの復旧」＋英語画面の読み替えが売り。
  appsmith: { id: 'a5109169d3b23989', label: 'Appsmith 日本語導入・運用キットを見る', price: '税込5,500円（買い切り）', article: 'https://katsushi2441.github.io/vwork/articles/2026-09-05-appsmith-first-boot-brick.html' },
  // 導入キットではなく「そのOSSを使って当社が作った買い切り製品」。
  // kkintai は勤怠分類(/ai-system/c/attendance/・GSC 11.8位)の出口。分類ページのカード列にも出す。
  kkintai: { id: 'f0f56c6e4da881be', label: '顔打刻つき勤怠管理 Kurage Kintai（買い切り）を見る', price: '税込55,000円（買い切り）', product: true },
  whisper: { id: 'cd1eda3248c87920', label: 'Whisperで動く買い切りのAI議事録（Kurage AI MOM）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-whisper-cpp-japanese-transcription.html' },
  'whisper-cpp': { id: 'cd1eda3248c87920', label: 'whisper.cppで動く買い切りのAI議事録（Kurage AI MOM）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-whisper-cpp-japanese-transcription.html' },
  // 全文検索×AIチャット（Namazu実績→Fessでも同構成）。出口は買い切りのチャットボット
  namazu: { id: '224e141f77bd07a8', label: 'Namazu検索×AIチャットの土台（Kurage Light ChatBot・買い切り）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/blog/2026-09-04-namazu-ai-chat-knowledge.html' },
  fess: { id: '224e141f77bd07a8', label: 'Fess検索×AIチャットの土台（Kurage Light ChatBot・買い切り）を見る', price: '税込55,000円（買い切り）', product: true, article: 'https://katsushi2441.github.io/vwork/articles/2026-09-04-fess-fulltext-search-ai-chat.html' },
  postgis: { id: 'a5ac4b9f1fdb6d19', label: 'PostGISで作った商圏分析システム(買い切り)を見る', product: true },
  kshoken: { id: 'a5ac4b9f1fdb6d19', label: '設置手順つきの買い切り版を見る', product: true },
  khazard: { id: '02b945f9c87c9d86', label: 'Kurage 土砂災害ハザードマップ（買い切り）を見る', price: '税込55,000円（買い切り）', product: true },
  krefuge: { id: '162f155897390072', label: 'Kurage 避難所マップ（買い切り）を見る', price: '税込55,000円（買い切り）', product: true },
  ktsunami: { id: '86b85a63bc426575', label: 'Kurage 津波浸水想定マップ（買い切り）を見る', price: '税込55,000円（買い切り）', product: true },
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

/**
 * カテゴリ別の「同じ用途の買い切りアプリ」。
 *
 * OSS個別のキットが無いページでも、店へ1本つなぐための受け皿。
 * 2026-09-11 実測: /oss/ の詳細ページで検索表示があるのは37件、うちキット導線があるのは5件だけで、
 * 表示690・クリック39（全体の84%・75%）が店への出口が無いページに落ちていた。
 * 正確な一致が無いときに、用途が近い自社製品を1本だけ出す。
 */
export type KappCategoryPick = { id: string; name: string; lead: string }

export const KAPP_CATEGORY_PICKS: Record<string, KappCategoryPick> = {
  devtools: { id: '719429354f079793', name: 'Kurage DB Agent',
    lead: 'AIから安全にデータベースを操作させる、PHP1ファイルの管理ツール。触れる表と操作を宣言で固定できます。' },
  project: { id: '767ea5a2f7963f2a', name: 'Vikunja 日本語導入・運用キット',
    lead: 'タスク・案件管理を自社サーバーで持つための導入キット。手順書・docker構成・バックアップまで一式です。' },
  lowcode: { id: 'c1864cba4ab726b0', name: 'Kurage 業務アプリ土台（kvgwc）',
    lead: 'kintone・サイボウズの代わりに、社内業務アプリを買い切りで持つ土台。月額はかかりません。' },
  knowledge: { id: '2186dc017968081c', name: 'Kurage Memo',
    lead: 'Simplenote型のメモを自社サーバーで。PHP1ファイルで動き、月額はかかりません。' },
  aidev: { id: '48ca584977698dcc', name: 'Kurage AIクローラー計測（ktrackgeo）',
    lead: '自社サイトがAIに読まれているかを測る買い切りツール。GA4では見えないAIクローラーを記録します。' },
  accounting: { id: '15abb025dc2ee4f6', name: 'Kurage 請求書（kbilling）',
    lead: '請求書の発行から集金まで買い切りで。月額の会計SaaSを増やさずに済みます。' },
  crm: { id: 'f6fab083d826739f', name: 'Kurage CRM Agent',
    lead: 'エクセル日報をやめる入力ゼロCRM。担当者に入力させずに記録が残ります。' },
  automation: { id: '232b3c1d11b6a730', name: 'Kurage サイト更新監視（kcheckit）',
    lead: 'サイト更新・補助金情報の監視を買い切りで。決まった巡回を人がやらずに済みます。' },
  dms: { id: '61febea74f9c74b0', name: 'Kurage 領収書発行（kinvoice）',
    lead: '領収書をPDFで発行してメール送信するところまで買い切りで。' },
  forum: { id: '4bd9a6f3f99cdc05', name: 'Kurage 掲示板（kbbs）',
    lead: '宣伝・求人を無料掲載できる掲示板を自社で持つ買い切り版。' },
  cms: { id: 'a3b60acb11b65f47', name: 'Decap CMS 日本語導入キット',
    lead: 'GitベースのCMSを日本語で使うための導入キット。サーバー要らずで運用できます。' },
  analytics: { id: '2c8193abe130c90c', name: 'Kurage 商圏分析（kshoken）',
    lead: '住所を入れて商圏を測る買い切りツール。地図と統計を自社で持てます。' },
  hr: { id: '56bf3ddd46b5a457', name: 'Kurage 職務管理（khrpost）',
    lead: '業務の引き継ぎ・属人化解消を買い切りで。担当が変わっても記録が残ります。' },
  booking: { id: '362c94ab4e1384f2', name: 'Kurage 予約・受付（kreserve）',
    lead: '予約管理システムを買い切りで。予約1件ごとの月額はかかりません。' },
  groupware: { id: 'c1864cba4ab726b0', name: 'Kurage 業務アプリ土台（kvgwc）',
    lead: 'kintone・サイボウズの代わりに、社内業務アプリを買い切りで持つ土台。月額はかかりません。' },
  commerce: { id: '5b55bb2c808eead4', name: 'Kurage 注文・決済（kpaylink）',
    lead: '注文フォームから請求書・決済までを買い切りで。' },
}

/**
 * OSS個別のキットが無いときだけ出す、用途が近い買い切りアプリの枠。
 * キットがある場合は空文字（二重に出さない）。
 */
export const KAPP_CATEGORY_LABELS: Record<string, string> = {
  devtools: '開発まわりの道具', project: '案件・タスク管理', lowcode: '社内アプリ',
  knowledge: '社内の記録・メモ', aidev: 'AI活用', accounting: '経理・請求',
  crm: '顧客管理', automation: '定型作業の自動化', dms: '書類の受け渡し',
  forum: '掲示板・投稿', cms: 'サイト運用', analytics: '分析',
  hr: '人事・引き継ぎ', booking: '予約・受付', groupware: '社内業務',
  commerce: '注文・決済',
}

/**
 * OSS個別のキットが無いときだけ出す、買い切りアプリへの出口。
 *
 * 「このOSSの代わりになる」とは書かない。カテゴリで機械的に選んでいるので、
 * 用途がぴったり一致するとは限らないため（例: gfile=ファイル転送 に DB Agent が当たる）。
 * あくまで「開発せずに買い切りで済ませる道もある」という案内と、その一例として出す。
 */
export function kappCategoryPanel(slug: string, category: string, ref: string, name: string): string {
  if (KAPP_KITS[slug]) return ''
  const pick = KAPP_CATEGORY_PICKS[category]
  if (!pick) return ''
  const label = KAPP_CATEGORY_LABELS[category] || 'この分野'
  return `<h2>開発せずに、買い切りで済ませる道もあります</h2>`
    + `<p>${name}のように自分で立てて運用するほかに、当社は${label}の仕組みを買い切りのアプリとして出しています。`
    + `月額はかからず、ソースコード同梱でAIに頼んで改変できます。${label}の例としては、${pick.lead}</p>`
    + `<div class="kit-actions"><a class="btn btn-main" href="https://kappstore.exbridge.jp/app.php?id=${pick.id}&ref=${ref}">${pick.name}を見る</a>`
    + `<a class="btn" href="https://kappstore.exbridge.jp/?ref=${ref}">買い切りアプリを全部見る</a></div>`
}
