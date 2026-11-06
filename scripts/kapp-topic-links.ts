/**
 * ニュース（exbridge.jp/news/）と省庁トラッカー（exbridge.jp/shocho/）の1件ごとのページに、
 * 話題が合うときだけ「この業務に使える当社のシステム」を1行出す（2026-11-07 ユーザー指示）。
 *
 * ChatGPT は exbridge.jp のニュース・省庁の発表のページを1日100回前後読みに来るが、
 * Kurage App Store（kappstore.exbridge.jp）には来ない。引用されるページに商品名・価格・URLを置けば、
 * ChatGPT の答えに商品が乗る。語は見出し（省庁は題名と分野）だけで当てる。当たらなければ何も出さない。
 * 商品名と価格は作るたびに kappstore の catalog.json から読む（値段や名前を書き写さない）。
 */
const RULES: [RegExp, string][] = [
  [/不正アクセス|情報(漏え?い|漏洩|流出)|ランサム|脆弱性|改ざん|サイバー攻撃|フィッシング/, 'a96e95e176b48800'],   // Kurage Security Check
  [/受発注|(?<!機械)受注(?!統計)|発注書|注文書|ＦＡＸ|FAX/, '88acc4be142bd444'],                                  // 機械受注統計には付けない                                                    // Kurage Web Order
  [/ＯＣＲ|OCR|手書き|紙の書類|帳票/, 'ef52a62e1c6bbe7a'],                                                          // Kurage OCR Work
  [/チャットボット|生成AI|生成ＡＩ|AIエージェント|ＡＩエージェント/, '224e141f77bd07a8'],                          // Kurage Light ChatBot
  [/勤怠|労働時間|残業|打刻/, 'f0f56c6e4da881be'],                                                                  // Kurage Kintai
  [/請求書|インボイス|適格請求書/, '15abb025dc2ee4f6'],                                                             // kbilling
  [/文字起こし|AI議事録|ＡＩ議事録|議事録(の)?作成/, 'cd1eda3248c87920'],                                    // 省庁の「会議の議事録」の公表には付けない                                                                        // Kurage AI MOM
  [/名刺/, '4679d4cf90699580'],                                                                                       // kaima
  [/最低賃金|賃上げ|業務改善助成金/, '0c438fde80e5c346'],                                                           // 最低賃金・賃上げ助成金チェック
  [/取適法|下請法|価格転嫁/, '42866a2a798d09eb'],                                                            // 取適法チェック
  [/(?<!国?債)(入札公告|官公需|公共調達|一般競争入札|入札参加)/, '464a65ef3e6a3646'],                          // 国債の入札には付けない                                                                                  // 入札情報ナビ
  [/補助金|助成金/, '0ad3f1528024edcd'],                                                                              // 補助金ナビ
]

type CatalogProd = { url: string; name: string; price_jpy: number | null; status: string }
let prods: Record<string, { name: string; price: number | null }> = {}

/** 作る前に1回だけ呼ぶ。読めなければ空のまま（1行は出ない） */
export async function loadKappTopics(): Promise<void> {
  try {
    const r = await fetch('https://kappstore.exbridge.jp/catalog.json', { headers: { 'User-Agent': 'kpayload-build' } })
    const d = (await r.json()) as { products: CatalogProd[] }
    prods = {}
    for (const p of d.products || []) {
      const id = (p.url.match(/id=([0-9a-f]{16})/) || [])[1]
      if (id && p.status === 'available') prods[id] = { name: p.name, price: p.price_jpy }
    }
  } catch { prods = {} }
}

/** 見出しなどの文から、合う商品を1つ。名前は「—」の後ろ（商品名）があればそちらを短く使う */
export function kappFor(text: string): { id: string; name: string; price: string } | null {
  for (const [re, id] of RULES) {
    if (!re.test(text) || !prods[id]) continue
    const full = prods[id].name
    const m = full.match(/（([^（）]*(Kurage|kaima|kbilling)[^（）]*)）\s*$/) || full.match(/(Kurage [^\s（）—]+(?: [^\s（）—]+)?)/)
    const name = m ? m[1] : full.split(/——|—/)[0].trim()
    const price = prods[id].price ? `税込${prods[id].price!.toLocaleString('ja-JP')}円` : ''
    return { id, name, price }
  }
  return null
}

/** 1行の本体（HTML）。esc は呼び出し側のエスケープ関数 */
export function kappLine(text: string, ref: string, esc: (s: string) => string): string {
  const k = kappFor(text)
  if (!k) return ''
  const url = `https://kappstore.exbridge.jp/app.php?id=${k.id}&amp;ref=${ref}`
  return `この業務に使える当社のシステム：<a href="${url}">${esc(k.name)}</a>（${k.price ? esc(k.price) + '・' : ''}自社のサーバー・月額なし）　Kurage App Store：https://kappstore.exbridge.jp/app.php?id=${k.id}`
}
