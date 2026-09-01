/**
 * OSSのslug → Kurage App Store の商品。
 *
 * カタログ(/oss/)とAIでできること(/ai-system/)の両方から同じ対応表を使う。
 * 二重に持つと片方だけ古くなるので、ここ1か所に置く。
 * 「導入キット」と「そのOSSで当社が作った製品」は別物なので、label で区別する。
 */
export const KAPP_KITS: Record<string, { id: string; label: string }> = {
  espocrm: { id: '9d27eb0ebe2fc7e0', label: 'EspoCRM 日本語導入キットを見る' },
  freescout: { id: '6d0e2c491e4170da', label: 'FreeScout 日本語導入キットを見る' },
  billionmail: { id: '495b5aca4ee119db', label: 'BillionMail 日本語導入キットを見る' },
  'decap-cms': { id: 'a3b60acb11b65f47', label: 'Decap CMS 日本語導入キットを見る' },
  'krayin-crm': { id: '11e7c1d9a83d1ca3', label: 'Krayin CRM 日本語導入キットを見る' },
  libredesk: { id: '104c05db7779a709', label: 'LibreDesk 日本語導入キットを見る' },
  'kouchou-ai': { id: '53493d74a09cfd8c', label: '広聴AI 完全ローカル導入キットを見る' },
  // 導入キットではなく「そのOSSを使って当社が作った買い切り製品」。
  whisper: { id: 'cd1eda3248c87920', label: 'whisper.cppで動く買い切りのAI議事録を見る' },
  postgis: { id: 'a5ac4b9f1fdb6d19', label: 'PostGISで作った商圏分析システム(買い切り)を見る' },
  kshoken: { id: 'a5ac4b9f1fdb6d19', label: '設置手順つきの買い切り版を見る' },
}

/** 商品ページへのリンク1本。該当が無ければ空文字。 */
export function kappKitLink(slug: string, ref: string, cls = 'btn'): string {
  const kit = KAPP_KITS[slug]
  if (!kit) return ''
  return `<a class="${cls}" href="https://kappstore.exbridge.jp/app.php?id=${kit.id}&ref=${ref}">${kit.label}</a>`
}
