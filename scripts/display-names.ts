/**
 * 表示名の正規化。
 *
 * 収集はGitHubのリポジトリ名をそのまま製品名にしているため、
 * 「openproject」「baserow」のように小文字のまま画面に出る。
 * 比較表に並べたとき、手作り分（EspoCRM / Krayin CRM）と混ざって
 * 品質が疑われるので、公式サイトの表記に寄せる。
 *
 * ここに無いものはリポジトリ名のまま。全部小文字が正式なもの
 * （nocodb→NocoDB のように直すべきもの以外）は足さないこと。
 */
export const DISPLAY_NAMES: Record<string, string> = {
  akaunting: 'Akaunting',
  apitable: 'APITable',
  appsmith: 'Appsmith',
  bagisto: 'Bagisto',
  baserow: 'Baserow',
  bigbluebutton: 'BigBlueButton',
  budibase: 'Budibase',
  'cal-diy': 'Cal.com',
  chatwoot: 'Chatwoot',
  docmost: 'Docmost',
  dolibarr: 'Dolibarr',
  easyappointments: 'Easy!Appointments',
  erpnext: 'ERPNext',
  focalboard: 'Focalboard',
  'frappe-helpdesk': 'Frappe Helpdesk',
  grafana: 'Grafana',
  'horilla-hr': 'Horilla HR',
  hrms: 'Frappe HR',
  invoiceninja: 'Invoice Ninja',
  'jitsi-meet': 'Jitsi Meet',
  kimai: 'Kimai',
  mattermost: 'Mattermost',
  mautic: 'Mautic',
  medusa: 'Medusa',
  metabase: 'Metabase',
  'nextcloud-deck': 'Nextcloud',
  nocodb: 'NocoDB',
  ocis: 'ownCloud Infinite Scale',
  openproject: 'OpenProject',
  orangehrm: 'OrangeHRM',
  outline: 'Outline',
  planka: 'Planka',
  'rocket-chat': 'Rocket.Chat',
  saleor: 'Saleor',
  seafile: 'Seafile',
  superset: 'Apache Superset',
  teable: 'Teable',
  twenty: 'Twenty',
  vendure: 'Vendure',
  wekan: 'Wekan',
  wiki: 'Wiki.js',
  zammad: 'Zammad',
  zulip: 'Zulip',
  affine: 'AFFiNE',
  bookstack: 'BookStack',
  freescout: 'FreeScout',
  suitecrm: 'SuiteCRM',
}

/** カタログの1件に正式表記を当てる（無ければそのまま） */
export const displayName = (slug: string, current: string): string =>
  DISPLAY_NAMES[slug] || current
