/**
 * OSSのページ → 同じ用途で使える当社の製品（Kurage App Store）。2026-10-04。
 *
 * 考え方：検索される OSS 名（odoo・qgis・tesseract…）で /oss/ と /ai-system/ に来た人に、
 * 「自分でOSSを立てて日本語化する代わりに、日本語で作ったオンプレミスの製品を置く」道を見せて kappstore へ送る。
 * 1ページに最大3つ。選び方は ①OSSの名前・slug・キーワードに当たる語 ②分類（/oss/ の category・/ai-system/ の cap）。
 * kapp-kits.ts（そのOSSの導入キット／そのOSSを組み込んだ製品）と同じ商品は出さない。
 *
 * 置き場所は1か所（ここ）。/oss/（build-static.ts）と /ai-system/（build-aisystem.ts）の両方から使う。
 */
export type Prod = { id: string; name: string; lead: string; price: string; demo?: string }

const P: Record<string, Prod> = {
  kweborder: { id: '88acc4be142bd444', name: 'Kurage Web Order（受発注システム）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kweborder/',
    lead: 'FAX・電話の注文を、取引先が自分で入れるBtoBのWEB受注に。品番で注文・出荷先・受注済で成立・出荷済まで・CSVで基幹へ。' },
  kocrwork: { id: 'ef52a62e1c6bbe7a', name: 'Kurage OCR Work（AI-OCR）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kocrwork.php/',
    lead: '注文書・手書きFAXを読み取り、項目に分けて受注登録まで。PaddleOCR・Tesseract・Docling・生成AIを切り替えて読み比べられる。' },
  kshoken: { id: 'a5ac4b9f1fdb6d19', name: 'Kurage 商圏分析', price: '税込55,000円', demo: 'https://kurage.exbridge.jp/kshoken.php/',
    lead: '住所ひとつで、徒歩圏・車圏の人口・世帯・事業所を地図で出す。GISを組まずに商圏を測れる。' },
  ktoshikeikaku: { id: '4bb2a5775eaad593', name: 'Kurage 都市計画ナビ', price: '税込55,000円', demo: 'https://kurage.exbridge.jp/ktoshikeikaku.php/',
    lead: '住所から用途地域・建ぺい率・容積率・市街化調整区域を引く。全国1,377市区町村の公開データを地図で。' },
  bousai: { id: 'cf817fdce13ee120', name: 'Kurage 防災AIチャット＋防災判定セット', price: '税込220,000円', demo: 'https://kurage.exbridge.jp/kbousai.php/',
    lead: '住所か現在地で、警報・川・台風・洪水・土砂・津波・避難先を1画面に。結論は規則、AIは言い換え。' },
  klchatbot: { id: '224e141f77bd07a8', name: 'Kurage Light ChatBot', price: '税込55,000円', demo: 'https://proto.exbridge.jp/klchatbot/',
    lead: '自社の資料だけを根拠に答えるAIチャットボット。PHP1ファイルで動き、ローカルのAIも選べる。' },
  kdealdesk: { id: '63000166082c7a26', name: 'Kurage Deal Desk', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kdealdesk/',
    lead: '顧客のメールアドレスごとに、商談をAIに相談し、記録とかんばんで案件を管理。CRMにはメールでつなぐ。' },
  kcrmagent: { id: 'f6fab083d826739f', name: 'Kurage CRM Agent', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kcrmagent/',
    lead: '日報を書くだけで顧客・商談の記録が残る、入力ゼロのCRM。' },
  klcrm: { id: '0e723e981c922df6', name: 'Kurage LINE CRM', price: '税込55,000円', demo: 'https://proto.exbridge.jp/klcrm/',
    lead: 'LINE公式アカウントの相談を、顧客ごとに記録・対応するCRM。' },
  kaima: { id: '4679d4cf90699580', name: 'Kurage AI名刺解析', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kaima/',
    lead: '名刺を撮るとAIが読み取り、人が確かめてから登録する。Sansanの代わりに自社で。' },
  kreserve: { id: '362c94ab4e1384f2', name: 'Kurage 予約・受付', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kreserve/',
    lead: '予約受付ページと空き枠・前日リマインドを自社サーバーに。予約1件ごとの課金なし。' },
  kcaldav: { id: '43950141618ddb02', name: 'Kurage CalDAV', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kcaldav/kcaldav.php',
    lead: '予定表をスマホとPCで同期する自前のCalDAVサーバー。PHP1ファイル。' },
  kkintai: { id: 'f0f56c6e4da881be', name: 'Kurage 勤怠（顔打刻）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kkintai/',
    lead: '顔で打刻する勤怠管理を自社サーバーに。丸めない台帳と、給与ソフト向けのCSV。' },
  khrpost: { id: '56bf3ddd46b5a457', name: 'Kurage HR Post（職務管理）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/khrpost/',
    lead: '職務・目標・引き継ぎを記録して、担当が変わっても止まらない仕組みに。' },
  kbilling: { id: '15abb025dc2ee4f6', name: 'Kurage 請求書（kbilling）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kbilling/',
    lead: '請求書のPDF発行から、銀行振込・PayPalでの集金まで自社サーバーに。' },
  kinvoice: { id: '61febea74f9c74b0', name: 'Kurage 領収書発行（kinvoice）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kinvoice/',
    lead: '領収書をPDFで発行して、メールで送るところまで。' },
  kpaylink: { id: '5b55bb2c808eead4', name: 'Kurage 注文・決済（kpaylink）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kpaylink/',
    lead: '注文フォームから請求書・決済リンクまでを自社サイトに。' },
  vibecart: { id: '754c7ddb5f1c8f26', name: 'Kurage Vibe-Cart（EC）', price: '税込110,000円', demo: 'https://exbridge.jp/exdirect/',
    lead: 'PHPだけで動くECサイト。商品ページのURLを変えずに乗り換えられる。MCP同梱。' },
  kaimom: { id: 'cd1eda3248c87920', name: 'Kurage AI MOM（AI議事録）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kaimom/',
    lead: 'Whisperで文字起こしと議事録を自社サーバーで。音声を外部に出さない。' },
  kmemo: { id: '2186dc017968081c', name: 'Kurage Memo', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kmemo/',
    lead: 'Simplenote型のメモを自社サーバーで。PHP1ファイル。' },
  kvgwc: { id: 'c1864cba4ab726b0', name: 'Kurage 業務アプリ土台（kvgwc）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kvgwc/',
    lead: 'kintone・サイボウズの代わりに、社内の業務アプリを自社サーバーに持つ土台。' },
  kseo: { id: 'c8ffa66502f7d905', name: 'Kurage SEO', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kseo/kseo.php',
    lead: '日本語サイト向けのSEO診断を自社サーバーで。決まった基準で機械的に点検する。' },
  ktrackgeo: { id: '48ca584977698dcc', name: 'Kurage AIクローラー計測', price: '税込55,000円', demo: 'https://proto.exbridge.jp/ktrackgeo/',
    lead: '自社サイトがAIに読まれているかを測る。GA4では見えないAIクローラーを記録。' },
  kcheckit: { id: '232b3c1d11b6a730', name: 'Kurage サイト更新監視（kcheckit）', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kcheckit/',
    lead: 'サイトの更新・補助金情報の変化を監視して知らせる。' },
  kbbs: { id: '4bd9a6f3f99cdc05', name: 'Kurage 掲示板（kbbs）', price: '税込55,000円', demo: 'https://kurage.exbridge.jp/kbbs.php',
    lead: '宣伝・求人を載せられる掲示板を自社で。X認証つき。' },
  kdbagent: { id: '719429354f079793', name: 'Kurage DB Agent', price: '税込55,000円', demo: 'https://proto.exbridge.jp/kdbagent/',
    lead: 'AIから安全にデータベースを操作させる、phpMyAdminより軽いPHP1ファイル。触れる表と操作を固定できる。' },
  kfillout: { id: '6ae90e27bf778a42', name: 'Kurage 申請書記入アシスト', price: '税込110,000円', demo: 'https://kurage.exbridge.jp/kfillout.php/',
    lead: 'Word・Excel・PDFの様式を、書式そのままで埋める。' },
  karchitect: { id: 'cfb7c4a69621600f', name: 'Kurage Architect（設計書）', price: '税込110,000円', demo: 'https://kurage.exbridge.jp/karchitect.php',
    lead: 'AIと対話して、システムの設計書をつくる。' },
  giin: { id: 'dd868beae043026b', name: 'Kurage 議員発言ログ', price: '税込55,000円', demo: 'https://xb4g.com/giin/',
    lead: '国会会議録から、議員がいつ・どの会議で何を質問したかを引く。MCP同梱。' },
  kconsensus: { id: 'd88a943736386fb3', name: 'Kurage 合意点マップ（Pol.is互換）', price: '税込110,000円', demo: 'https://kurage.exbridge.jp/kconsensus.php/',
    lead: '意見を集めて、割れ方と、どのグループからも賛成が高い点を出す。' },
  kseido: { id: '237974724fb41216', name: 'Kurage 制度ナビ', price: '税込55,000円', demo: 'https://kurage.exbridge.jp/kseido.php/',
    lead: '困りごとから、使える制度・申請先・期限・必要書類を引く。相談の記録つき。' },
}

/** OSS の名前・slug・キーワードに当たる語 → 製品（強い一致。先に並べたものほど先に出す） */
const RULES: Array<[RegExp, string]> = [
  [/\b(b2b|btob|ordering|order ?management|wholesale|erp|odoo|erpnext|dolibarr|orocommerce|oro|tryton|idempiere|metasfresh|purchase ?orders?|procurement|supply ?chain)\b|受発注|受注|発注|在庫|卸売/i, 'kweborder'],
  [/\b(e-?commerce|shop|online ?store|web ?store|shopping ?cart|storefront|sylius|bagisto|shopware|saleor|medusa|opencart|prestashop|woocommerce|magento|spree|solidus|ec-cube)\b|通販|ネットショップ/i, 'vibecart'],
  [/\b(ocr|tesseract|paddleocr|docling|mineru|surya|olmocr|easyocr)\b|文字認識|手書き/i, 'kocrwork'],
  [/\b(gis|geospatial|geocod\w*|qgis|postgis|geoserver|mapserver|maps?|osm|openstreetmap|leaflet|openlayers|maplibre|mapbox|osrm|valhalla|tileserver|geonode)\b|地図|地理空間|商圏/i, 'kshoken'],
  [/\b(zoning|cadastr\w*|land ?use|urban ?planning)\b|都市計画|用途地域/i, 'ktoshikeikaku'],
  [/\b(disaster|hazard|flood\w*|earthquake|tsunami|evacuat\w*|emergency)\b|防災|災害|避難|浸水/i, 'bousai'],
  [/\b(chatbot|chat ?bot|rag|faq|helpdesk|help ?desk|knowledge ?base|livechat|live ?chat|dify|anything ?llm|lobe ?(chat|hub)|lobehub|khoj|open ?webui|librechat|langflow|flowise|ragflow|fastgpt|maxkb|botpress|rasa|typebot\w*|onyx|danswer|quivr|private ?gpt|jan|nextchat|chatbox|cherry ?studio|kotaemon|ai ?assistant|llm ?chat)\b|チャットボット/i, 'klchatbot'],
  [/\b(sfa|deals?|pipeline|opportunit(y|ies))\b|商談|案件管理|営業管理/i, 'kdealdesk'],
  [/\b(crm|sales ?(crm|force|management)|leads? ?management)\b|顧客管理|営業/i, 'kcrmagent'],
  [/\b(business ?cards?|vcard)\b|名刺/i, 'kaima'],
  [/\b(booking|reservation\w*|appointment\w*|calendly|cal\.com|easyappointments)\b|予約/i, 'kreserve'],
  [/\b(caldav|carddav|calendar\w*)\b/i, 'kcaldav'],
  [/\b(attendance|time ?track\w*|timesheet\w*|clock[- ]?in|punch)\b|勤怠/i, 'kkintai'],
  [/\b(hr|hrm|hris|human ?resources?|employee\w*|onboarding|okr)\b|人事/i, 'khrpost'],
  [/\b(invoic\w*|billing|accounting|bookkeeping)\b|請求|会計/i, 'kbilling'],
  [/\b(receipt\w*)\b|領収/i, 'kinvoice'],
  [/\b(payment\w*|checkout|stripe|paypal|donation\w*)\b|決済/i, 'kpaylink'],
  [/\b(whisper|transcri\w*|speech[- ]to[- ]text|asr|meeting\w*|meet|video ?conferenc\w*|web ?conferenc\w*)\b|議事録|文字起こし|会議/i, 'kaimom'],
  [/\b(notes?|memo\w*|simplenote|joplin|notebook)\b|メモ/i, 'kmemo'],
  [/\b(groupware|intranet|low[- ]?code|no[- ]?code|internal ?tools?|app ?builder|kintone)\b/i, 'kvgwc'],
  [/\b(seo|lighthouse|site ?audit)\b/i, 'kseo'],
  [/\b(analytics|plausible|matomo|umami|pageviews?|web ?stats)\b|アクセス解析/i, 'ktrackgeo'],
  [/\b(uptime|change ?detection|changedetection|website ?monitor\w*)\b/i, 'kcheckit'],
  [/\b(forum|bbs|discourse|bulletin ?board)\b|掲示板/i, 'kbbs'],
  [/\b(phpmyadmin|adminer|dbeaver|sql ?client|database ?(gui|client|admin\w*)|db ?gui)\b/i, 'kdbagent'],
  [/\b(pdf ?forms?|form ?fill\w*)\b|申請書|帳票/i, 'kfillout'],
  [/\b(parliament\w*|legislat\w*|congress|civic)\b|議会|国会/i, 'giin'],
  [/\b(polis|deliberat\w*|consensus|participat\w*|petition\w*)\b/i, 'kconsensus'],
]

/** 分類（/oss/ の category と /ai-system/ の cap の両方）→ 製品 */
const CATS: Record<string, string[]> = {
  commerce: ['kweborder', 'vibecart', 'kpaylink'], ec: ['vibecart', 'kweborder', 'kpaylink'], pos: ['vibecart', 'kweborder'],
  marketplace: ['vibecart', 'kweborder'],
  order: ['kweborder', 'kocrwork'], purchase: ['kweborder'], warehouse: ['kweborder'], delivery: ['kweborder'],
  inventory: ['kweborder'], erp: ['kweborder', 'kbilling'], quote: ['kweborder', 'kbilling'], production: ['kweborder'],
  accounting: ['kbilling', 'kinvoice', 'kweborder'], invoice: ['kbilling', 'kinvoice'], expense: ['kbilling', 'kocrwork'],
  budget: ['kbilling'], payment: ['kpaylink', 'kbilling'], subscription: ['kpaylink', 'kbilling'], finance: ['kbilling'],
  crm: ['kdealdesk', 'kcrmagent', 'klcrm'], sfa: ['kdealdesk', 'kcrmagent', 'kaima'], marketing: ['kseo', 'ktrackgeo', 'klcrm'], mailmarketing: ['klcrm', 'kseo'],
  booking: ['kreserve', 'kcaldav'], calendar: ['kcaldav', 'kreserve'], facility: ['kreserve'], ticket: ['kreserve'],
  hr: ['kkintai', 'khrpost'], attendance: ['kkintai'], timetrack: ['kkintai'], payroll: ['kkintai'], recruit: ['khrpost'], evaluation: ['khrpost'],
  groupware: ['kvgwc'], lowcode: ['kvgwc', 'kdbagent'], workflow: ['kvgwc'], team: ['kvgwc'], portal: ['kvgwc'], spreadsheet: ['kvgwc'],
  form: ['kfillout', 'kvgwc'], bpm: ['kvgwc'], office: ['kvgwc'],
  knowledge: ['klchatbot', 'kmemo'], note: ['kmemo'], notes: ['kmemo'], wiki: ['klchatbot', 'kmemo'], manual: ['klchatbot'], techdocs: ['klchatbot'], bookmark: ['kmemo'],
  support: ['klchatbot', 'klcrm'], helpdesk: ['klchatbot', 'klcrm'], chatbot: ['klchatbot'], faq: ['klchatbot'], livechat: ['klchatbot', 'klcrm'],
  chat: ['klchatbot'], chatui: ['klchatbot'], rag: ['klchatbot'], aiagent: ['klchatbot'], llmops: ['klchatbot'], prompt: ['klchatbot'],
  dms: ['kocrwork', 'kfillout'], ocr: ['kocrwork'], paperless: ['kocrwork'], pdf: ['kfillout', 'kocrwork'],
  meeting: ['kaimom'], aivoice: ['kaimom'],
  gis: ['kshoken', 'ktoshikeikaku', 'bousai'], shoken: ['kshoken', 'ktoshikeikaku'], realestate: ['ktoshikeikaku', 'kshoken', 'bousai'],
  hazard: ['bousai', 'kshoken'], civic: ['giin', 'kconsensus', 'kseido'], survey: ['kconsensus'], forum: ['kbbs'],
  database: ['kdbagent'], devsupport: ['karchitect'],
  monitoring: ['kcheckit'], log: ['kcheckit'], automation: ['kcheckit', 'kvgwc'], integration: ['kvgwc'], notify: ['kcheckit'],
  cms: ['kseo', 'ktrackgeo'], sitegen: ['kseo'], sitebuilder: ['kseo'], staticsite: ['kseo'], blog: ['kseo'], corporate: ['kseo'], mediasite: ['kseo'], headless: ['kseo'],
}

export function relatedProducts(o: { slug: string; name: string; category?: string; cap?: string; keywords?: string[] }, excludeIds: string[] = []): Prod[] {
  const text = `${o.slug.replace(/[-_]/g, ' ')} ${o.name} ${(o.keywords || []).join(' ')}`
  const keys: string[] = []
  for (const [re, k] of RULES) { if (re.test(text) && !keys.includes(k)) keys.push(k) }
  for (const c of [o.cap, o.category]) { for (const k of (c && CATS[c]) || []) { if (!keys.includes(k)) keys.push(k) } }
  const out: Prod[] = []
  for (const k of keys) {
    const p = P[k]
    if (!p || excludeIds.includes(p.id) || out.some((x) => x.id === p.id)) continue
    out.push(p)
    if (out.length >= 3) break
  }
  return out
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 目立つ枠。name は呼び出し側でエスケープ済み。該当が無ければ空文字 */
export function relatedPanel(list: Prod[], ref: string, name: string, heading?: string): string {
  if (!list.length) return ''
  return `<style>.krel{border:2px solid #0a8f85;border-radius:14px;background:#f3fbfa;padding:16px;margin:0 0 18px}.krel h2{margin:0 0 6px;font-size:19px}.krel>p{margin:0 0 10px;color:#37485a;font-size:14px;line-height:1.75}.krel-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}.krel-c{background:#fff;border:1px solid #cfe5e2;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px}.krel-c b{font-size:15px;color:#10242b}.krel-c span{font-size:13px;color:#37485a;line-height:1.65}.krel-c em{font-style:normal;font-weight:800;font-size:13px;color:#0a5f58}.krel-a{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}.krel-a a{display:inline-block;text-decoration:none;font-weight:800;font-size:13px;border-radius:8px;padding:7px 12px}.krel-a a.m{background:#0a8f85;color:#fff}.krel-a a.s{background:#fff;color:#07756d;border:1px solid #cfe5e2}</style>`
    + `<section class="krel" aria-label="同じ用途の当社製品"><h2>${heading || `${name}と同じ用途で使える、当社の製品`}</h2>`
    + `<p>OSSを自分で立てて日本語化する代わりに、日本語で作った当社の製品を自社のサーバーに置く方法もあります。ソースコード付きで、月額はかかりません。</p>`
    + `<div class="krel-g">${list.map((p) => `<div class="krel-c"><b>${esc(p.name)}</b><span>${esc(p.lead)}</span><em>${esc(p.price)}（オンプレミス・買い切り）</em><div class="krel-a"><a class="m" href="https://kappstore.exbridge.jp/app.php?id=${p.id}&amp;ref=${ref}">商品ページを見る</a>${p.demo ? `<a class="s" href="${esc(p.demo)}${p.demo.includes('?') ? '&amp;' : '?'}ref=${ref}" target="_blank" rel="noopener">デモ</a>` : ''}</div></div>`).join('')}</div></section>`
}
