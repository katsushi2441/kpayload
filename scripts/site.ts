/** 3つの入口で共通の宛先。ここを直せば全ページに効く。 */
export const SITE = 'https://exbridge.jp'
export const KURAGE = 'https://kurage.exbridge.jp'
export const TRIAL = `${SITE}/nagoya-system-development.html`
export const GA = 'G-BP0650KDFR'

/**
 * OSSカテゴリの表示名。副作用のないこのファイルに置く。
 * build-static.ts に置いていたが、import するとビルドが走ってしまい
 * 一覧を取り出せなかった（2026-09-06）。
 */
export const categoryLabels: Record<string, string> = {
  gis: '地図・位置情報（GIS）',
  shoken: '商圏分析',
  civic: '政治・市民参加',
  crm: '顧客・営業管理', support: 'サポート', project: 'プロジェクト管理', inventory: '在庫管理',
  esign: '電子契約', cms: 'CMS・情報発信', monitoring: '監視・運用', groupware: 'グループウェア',
  media: '動画・音声・配信', finance: '投資・市場分析', marketing: 'マーケティング',
  mobile: 'モバイルアプリ', commerce: 'EC・販売', knowledge: 'ナレッジ・AI',
  office: 'オフィス', database: 'データベース', notes: 'メモ',
  lms: '学習管理・LMS', hr: '人事・勤怠', accounting: '会計・経理', forum: 'コミュニティ・掲示板',
  booking: '予約・受付', survey: 'アンケート・フォーム', pos: 'POS・店舗', dms: '文書管理',
  lowcode: 'ローコード開発', analytics: '分析・BI', aidev: 'AI開発基盤', devtools: '開発者ツール',
  sitegen: 'サイト構築・静的生成', automation: '自動化・連携', devsupport: '開発支援ツール',
}
