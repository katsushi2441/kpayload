import type { CollectionConfig } from 'payload'

export const OSSProjects: CollectionConfig = {
  slug: 'oss-projects',
  labels: { singular: 'OSS', plural: 'OSSカタログ' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'license', 'featured', 'updatedAt'],
    description: 'kurage.exbridge.jp/oss/ と vibe-oss.html の共通データです。',
  },
  access: { read: () => true },
  defaultSort: 'name',
  fields: [
    { name: 'name', label: 'OSS名', type: 'text', required: true },
    { name: 'slug', label: 'URLスラッグ', type: 'text', required: true, unique: true, index: true },
    {
      name: 'category', label: 'カテゴリ', type: 'select', required: true,
      options: [
        { label: '顧客・営業管理', value: 'crm' },
        { label: 'サポート・ヘルプデスク', value: 'support' },
        { label: 'プロジェクト管理', value: 'project' },
        { label: '在庫管理', value: 'inventory' },
        { label: '電子契約', value: 'esign' },
        { label: 'CMS・情報発信', value: 'cms' },
        { label: '動画・音声・配信', value: 'media' },
        { label: '投資・市場分析', value: 'finance' },
        { label: 'マーケティング', value: 'marketing' },
        { label: 'モバイルアプリ', value: 'mobile' },
        { label: 'EC・販売', value: 'commerce' },
        { label: '監視・運用', value: 'monitoring' },
        { label: 'グループウェア', value: 'groupware' },
        { label: 'ナレッジ・AI', value: 'knowledge' },
        { label: 'オフィス', value: 'office' },
        { label: 'データベース', value: 'database' },
        { label: 'メモ', value: 'notes' },
        { label: '学習管理・LMS', value: 'lms' },
        { label: '人事・勤怠', value: 'hr' },
        { label: '会計・経理', value: 'accounting' },
        { label: 'コミュニティ・掲示板', value: 'forum' },
        { label: '予約・受付', value: 'booking' },
        { label: 'アンケート・フォーム', value: 'survey' },
        { label: 'POS・店舗', value: 'pos' },
        { label: '文書管理', value: 'dms' },
        { label: 'ローコード開発', value: 'lowcode' },
        { label: '分析・BI', value: 'analytics' },
        { label: 'AI開発基盤', value: 'aidev' },
        { label: '開発者ツール', value: 'devtools' },
        { label: 'サイト構築・静的生成', value: 'sitegen' },
        { label: '自動化・連携', value: 'automation' },
        { label: '開発支援ツール', value: 'devsupport' }
      ],
    },
    {
      // 出口の振り分け。業務アプリは「改造して納品」、道具は「使って作る」。
      name: 'funnel', label: '出口', type: 'select', required: true, defaultValue: 'oss',
      options: [
        { label: 'カスタマイズ可（このOSSを改造して納品）', value: 'oss' },
        { label: '開発に使う（このツールを使って作る）', value: 'prototype' }
      ],
    },
    { name: 'summary', label: '一文要約', type: 'textarea', required: true },
    { name: 'description', label: '詳しい説明', type: 'textarea', required: true },
    { name: 'license', label: 'ライセンス', type: 'text', required: true },
    { name: 'japaneseStatus', label: '日本語対応', type: 'text', required: true },
    { name: 'officialUrl', label: '公式URL', type: 'text', required: true },
    { name: 'githubUrl', label: 'GitHub URL', type: 'text' },
    { name: 'lpUrl', label: 'Kurage紹介LP', type: 'text' },
    { name: 'brainUrl', label: 'Brain記事URL', type: 'text' },
    { name: 'brainLabel', label: 'Brainリンク名', type: 'text', defaultValue: '構築手順書をBrainで読む' },
    { name: 'demoUrl', label: 'デモURL', type: 'text' },
    { name: 'featured', label: '注目OSS', type: 'checkbox', defaultValue: false },
    {
      name: 'useCases', label: '主な用途', type: 'array', required: true,
      fields: [{ name: 'text', label: '用途', type: 'text', required: true }],
    },
    {
      name: 'keywords', label: '検索キーワード', type: 'array', required: true,
      fields: [{ name: 'text', label: 'キーワード', type: 'text', required: true }],
    },
    {
      name: 'faqs', label: 'よくある質問', type: 'array', required: true,
      fields: [
        { name: 'question', label: '質問', type: 'text', required: true },
        { name: 'answer', label: '回答', type: 'textarea', required: true },
      ],
    },
    // 手作りの掲載分だけが持つ。GitHubから収集した分は空。
    { name: 'sourceLpName', label: '紹介ページ名（画面に出るので社内の呼び名は入れない）', type: 'text' },
    { name: 'stars', label: 'GitHubスター数', type: 'number' },
    { name: 'language', label: '主な言語', type: 'text' },
    // 一覧・カテゴリ・検索の並び順。手で上げたいときはここに数値を入れる。
    { name: 'priority', label: '優先度の手動加点', type: 'number', defaultValue: 0 },
    // 日本語対応は推測せず実測値を持つ。ページ上でも根拠として出す。
    { name: 'jaFileCount', label: '日本語ロケールの実ファイル数', type: 'number' },
    { name: 'jaSamplePaths', label: '日本語ファイルの実パス', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
    { name: 'githubCreatedAt', label: 'GitHub初回公開', type: 'text' },
    { name: 'githubPushedAt', label: 'GitHub最終更新', type: 'text' },
  ],
}
