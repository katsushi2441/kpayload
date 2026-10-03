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
  // 2026-10-04 AIチャットボット・RAGの主要OSS
  'open-webui': 'Open WebUI',
  'librechat': 'LibreChat',
  'langflow': 'Langflow',
  'ragflow': 'RAGFlow',
  'fastgpt': 'FastGPT',
  'maxkb': 'MaxKB',
  'botpress': 'Botpress',
  'rasa': 'Rasa',
  'typebot-io': 'Typebot',
  'onyx': 'Onyx',
  'quivr': 'Quivr',
  'private-gpt': 'PrivateGPT',
  'jan': 'Jan',
  'nextchat': 'NextChat',
  'chatbox': 'Chatbox',
  'cherry-studio': 'Cherry Studio',
  'kotaemon': 'kotaemon',

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
  documenso: 'Documenso',
  vaultwarden: 'Vaultwarden',
  harper: 'Harper',
  automatisch: 'Automatisch',
  textlint: 'textlint',
  'passbolt-api': 'Passbolt',
  freshrss: 'FreshRSS',
  v2: 'Miniflux',
  shlink: 'Shlink',
  yourls: 'YOURLS',
  languagetool: 'LanguageTool',
  memos: 'Memos',
  huginn: 'Huginn',
  actual: 'Actual Budget',
  joplin: 'Joplin',
  activepieces: 'Activepieces',
  trilium: 'Trilium Notes',
  siyuan: 'SiYuan',
  appflowy: 'AppFlowy',
  logseq: 'Logseq',
  vikunja: 'Vikunja',
  'firefly-iii': 'Firefly III',
  publii: 'Publii',
  ghost: 'Ghost',
  wordpress: 'WordPress',
  formbricks: 'Formbricks',
  heyform: 'HeyForm',
  listmonk: 'listmonk',
  mailtrain: 'Mailtrain',
  grocy: 'Grocy',
  'chamilo-lms': 'Chamilo',
  classroomio: 'ClassroomIO',
  sakai: 'Sakai',
  courselit: 'CourseLit',
  jsherp: 'jshERP',
  aureuserp: 'AureusERP',
  greaterwms: 'GreaterWMS',
  docuseal: 'DocuSeal',
  opensign: 'OpenSign',
  inventree: 'InvenTree',
  opensourcepos: 'Open Source Point of Sale',
  dolibarr: 'Dolibarr',
  easyappointments: 'Easy!Appointments',
  erpnext: 'ERPNext',
  focalboard: 'Focalboard',
  'frappe-helpdesk': 'Frappe Helpdesk',
  'frappe-crm': 'Frappe CRM',
  crm: 'OroCRM',
  'trycompai-crm': 'CRM by Comp AI',
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
  // /oss/wiki/ は frappe/wiki。Wiki.js(requarks/wiki) は slug 重複で隠れていたので wikijs に（2026-10-04）
  wiki: 'Frappe Wiki',
  wikijs: 'Wiki.js',
  nextcloud: 'Nextcloud',
  owncloud: 'ownCloud',
  huly: 'Huly',
  gotify: 'Gotify',
  shopware6: 'Shopware 6',
  getzola: 'Zola',
  'ledger-cli': 'Ledger',
  'flarum-framework': 'Flarum（本体）',
  'saleor-storefront': 'Saleor Storefront',
  'siteserver-cms': 'SiteServer CMS',
  'oca-e-commerce': 'OCA e-commerce（Odoo）',
  'tinode-webapp': 'Tinode',
  'openipc-wiki': 'OpenIPC Wiki',
  'devaslanphp-project-management': 'Helper（devaslanphp/project-management）',
  zammad: 'Zammad',
  zulip: 'Zulip',
  affine: 'AFFiNE',
  bookstack: 'BookStack',
  freescout: 'FreeScout',
  suitecrm: 'SuiteCRM',
  // 2026-08-31 追加: /ai-system/c/ の比較表に出てリポジトリ名のままだったもの。
  // いずれも公式サイトの表記に合わせている（発明はしない）。
  'idurar-erp-crm': 'IDURAR ERP CRM',
  'ever-gauzy': 'Ever Gauzy',
  communityserver: 'ONLYOFFICE Community Server',
  glpi: 'GLPI',
  dokuwiki: 'DokuWiki',
  geoserver: 'GeoServer',
  postgis: 'PostGIS',
  'civicrm-core': 'CiviCRM',
  decidim: 'Decidim',
  consuldemocracy: 'Consul Democracy',
  polis: 'Pol.is',
  'kouchou-ai': '広聴AI',
  polimoney: 'Polimoney',
}

/** カタログの1件に正式表記を当てる（無ければそのまま） */
export const displayName = (slug: string, current: string): string =>
  DISPLAY_NAMES[slug] || current

/**
 * 分類の手直し。紹介文の生成が分類を外すことがあるので、実物を見て決めた分だけ直す。
 * 例: medusajs/medusa はECの土台なのに aidev になっていた（Shopifyの置き換え候補として
 * 出しているのに、AI開発ツールのカテゴリに入っていた。2026-08-25）。
 */
export const CATEGORY_FIX: Record<string, string> = {
  // nextcloud/server は再生成で notify（コレクションに無い分類）になり seed が止まった（2026-10-04）。従来の分類に固定
  // slug の重複を直して nextcloud/gotify は別の slug になった。server は bangumi/server
  server: 'devtools',
  nextcloud: 'groupware',
  gotify: 'devtools',
  // 2026-10-04 AIチャットボット・RAGは devtools ではなく AI の分類に
  'maxkb': 'aidev',
  'quivr': 'aidev',
  'botpress': 'aidev',
  'private-gpt': 'aidev',
  'ragflow': 'aidev',
  'jan': 'aidev',
  'langflow': 'aidev',
  'rasa': 'aidev',

  medusa: 'commerce',
  // 広聴AIは意見集約の完成システムだが、gemma4がdev-toolと誤分類した(2026-09-01)
  'kouchou-ai': 'civic',
  // ConsiderIt は Pol.is と同系統の合意形成ツールなのに forum に入っていて、
  // civic の一覧から辿れなかった(2026-09-19)
  considerit: 'civic',
}
