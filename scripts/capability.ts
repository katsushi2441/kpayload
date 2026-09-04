/**
 * 「AIでできること」の分類（capability）。
 *
 * exbridge.jp/ai-system/ 側のページ主題に使う。
 * kurage の /oss/<slug>/ が「そのOSSは何か」を扱うのに対し、
 * こちらは「その業務をどうやるか」を扱うので、分類軸が違う。
 *
 * 粒度について（2026-08-23 変更）:
 *   最初は27分類で作ったが、検索する人は「社内Wiki」「請求書 発行」「在庫管理」
 *   のように具体的な言葉で探す。27分類だと label が「社内ナレッジ検索・マニュアル整備」
 *   のような複合語になり、どのロングテール語とも一致しない。
 *   実データ（useCases 5,252種）を数えて、実際に出てくる業務語を約110に分けた。
 *   ページが薄くならないよう、掲載は「一致したOSS全部」（主題が別でも載せる）にし、
 *   一致が MIN_MEMBERS 未満の分類はページを作らない。
 *
 * 語の広さに注意:
 *   「セルフホスト」「オープンソース」のようにカタログ全体に出る語は分類にしない。
 *   一度 selfhost を入れたら他の分類を全部吸った。
 */
export type Capability = {
  key: string
  label: string
  question: string
  rx: RegExp
  group: string
  /**
   * 検索で実際に使われている一般名（GSC実測）。title/H1 はこれを主語にする。
   * label は分類名として短くしてあるので、「勤怠管理システム オープンソース」のような
   * 検索語と一致しない（2026-09-04 実測: 表示318・クリック0・平均12〜56位）。
   */
  noun?: string
  /** GSCで表示が付いている実クエリ。FAQの問いと本文の言い回しに使う。作文しない。 */
  terms?: string[]
}

/** index と一覧ページのナビゲーションに使う大分類。見出しを作ってAEOの引用単位を切る。 */
export const GROUPS: Array<{ key: string; label: string }> = [
  { key: 'knowledge', label: '社内の情報共有・ナレッジ' },
  { key: 'support', label: '問い合わせ・顧客対応' },
  { key: 'sales', label: '顧客管理・営業' },
  { key: 'web', label: 'サイト運営・情報発信' },
  { key: 'commerce', label: 'EC・販売' },
  { key: 'schedule', label: '予約・スケジュール' },
  { key: 'workflow', label: '申請・承認・業務フロー' },
  { key: 'project', label: 'プロジェクト・タスク管理' },
  { key: 'accounting', label: '請求・見積・会計' },
  { key: 'logistics', label: '在庫・受発注・製造' },
  { key: 'hr', label: '勤怠・人事・労務' },
  { key: 'data', label: 'データ活用・分析' },
  { key: 'document', label: '文書・書類の電子化' },
  { key: 'comm', label: '連絡・コミュニケーション' },
  { key: 'ai', label: '生成AI・AIエージェントの活用' },
  { key: 'ops', label: 'システムの運用・内製化' },
  { key: 'industry', label: '業種ごとの業務' },
]

/**
 * 並び順は同点時の優先順位になる。具体的な業務語を先に、広い語を後ろに置く。
 */
export const CAPABILITIES: Capability[] = [
  // 社内の情報共有・ナレッジ
  { group: 'knowledge', key: 'wiki', label: '社内Wiki', question: '社内の知識が個人に溜まったままになっている',
    rx: /(社内wiki|\bwiki\b|ウィキ)/i },
  { group: 'knowledge', key: 'manual', label: '業務マニュアル・手順書の整備', question: '作業手順が人によってばらばら',
    rx: /(マニュアル|手順書|作業手順|業務手順|ハンドブック)/i },
  { group: 'knowledge', key: 'techdocs', label: '技術ドキュメントの公開', question: '技術資料の置き場が決まっていない',
    rx: /(技術ドキュメント|技術文書|apiドキュメント|ドキュメントサイト|開発者向けドキュメント|ドキュメント(の)?(公開|整備|管理))/i },
  { group: 'knowledge', key: 'knowledge', label: '社内ナレッジ検索', question: '社内の資料が探せない',
    rx: /(ナレッジ|知識ベース|社内文書|ノウハウ(共有|蓄積)|情報共有)/i },
  { group: 'knowledge', key: 'note', label: 'メモ・議事録の管理', question: '議事録やメモが散らばっている',
    rx: /(メモ(帳|アプリ|管理)?|ノート(アプリ|管理)|議事録|備忘録)/i },
  { group: 'knowledge', key: 'bookmark', label: '情報収集・記事のクリップ', question: '調べた情報が後から見つからない',
    rx: /(ブックマーク|リンク集|\brss\b|情報収集|クリップ|リーダー)/i },

  // 問い合わせ・顧客対応
  { group: 'support', key: 'helpdesk', label: 'ヘルプデスク・問い合わせ管理', question: '問い合わせの対応漏れが起きる',
    rx: /(ヘルプデスク|問い?合わせ(管理|対応)?|サポートチケット|カスタマーサポート|顧客対応)/i },
  { group: 'support', key: 'chatbot', label: 'チャットボットによる自動応答', question: '同じ質問に何度も答えている',
    rx: /(チャットボット|自動応答|一次対応|ai接客|対話ボット|ボット(応答|開発))/i },
  { group: 'support', key: 'faq', label: 'FAQ・よくある質問の整備', question: 'よくある質問がまとまっていない',
    rx: /(\bfaq\b|よくある質問|q&a|質問集)/i },
  { group: 'support', key: 'livechat', label: 'Web接客・有人チャット', question: 'サイト訪問者に声をかけられていない',
    rx: /(ライブチャット|有人チャット|web接客|チャットサポート|訪問者との)/i },

  // 顧客管理・営業
  { group: 'sales', key: 'crm', label: '顧客管理（CRM）', noun: '顧客管理システム（CRM）', terms: ['顧客管理 オープンソース', 'オープンソース CRM', 'CRM OSS 日本語'], question: '顧客情報がExcelに散らばっている',
    rx: /(\bcrm\b|顧客(管理|情報|関係|データ))/i },
  { group: 'sales', key: 'sfa', label: '営業支援・商談管理', question: '商談の進み具合が見えない',
    rx: /(営業(支援|活動|管理)|商談|パイプライン|リード(管理|獲得)?|\bsfa\b|見込み客)/i },
  { group: 'sales', key: 'mailmarketing', label: 'メール配信・メルマガ', noun: 'メール配信システム', terms: ['メール配信システム オープンソース', 'メール配信システム OSS', 'メルマガ配信 セルフホスト'], question: '案内メールを手作業で送っている',
    rx: /(メール配信|メルマガ|ニュースレター|メールマーケティング|一斉送信|配信リスト)/i },
  { group: 'sales', key: 'marketing', label: 'マーケティング施策の管理', question: '施策の効果がわからないまま続けている',
    rx: /(マーケティング|キャンペーン(管理|運用)?|広告運用|集客施策|リードナーチャ)/i },
  { group: 'sales', key: 'contact', label: '問い合わせフォーム・資料請求', question: 'サイトからの問い合わせを取りこぼしている',
    rx: /(問い?合わせフォーム|資料請求|コンタクトフォーム|お問い合わせ)/i },

  // サイト運営・情報発信
  { group: 'web', key: 'blog', label: 'ブログ運営', question: '記事の更新を外注している',
    rx: /(ブログ)/i },
  { group: 'web', key: 'corporate', label: '企業サイトの運営', question: 'ホームページの更新が自社でできない',
    rx: /(企業(の)?(公式)?(web)?サイト|コーポレートサイト|会社(の)?(web)?サイト|ホームページ(運営|制作|管理|の構築)?)/i },
  { group: 'web', key: 'staticsite', label: '静的サイトの構築', question: 'サイトの表示が遅く保守も重い',
    rx: /(静的(サイト|ページ|web)|静的サイトジェネレー|\bjamstack\b)/i },
  { group: 'web', key: 'headless', label: 'ヘッドレスCMS・API配信', question: '同じ情報をサイトとアプリで二重管理している',
    rx: /(ヘッドレス|headless|api(経由|ベース)でコンテンツ|コンテンツapi)/i },
  { group: 'web', key: 'portal', label: '会員サイト・ポータルの運営', question: '会員向けの情報を配る場所がない',
    rx: /(ポータル|会員(サイト|制|向け)|イントラネット)/i },
  { group: 'web', key: 'mediasite', label: 'メディア・記事サイトの運営', question: '記事を出す場を自社で持ちたい',
    rx: /(メディアサイト|ニュースサイト|記事サイト|オンラインマガジン|出版)/i },
  { group: 'web', key: 'sitebuilder', label: 'ページ制作・サイトビルダー', question: 'ページを作るたびに制作会社に頼んでいる',
    rx: /(ランディングページ|\blp\b|ページビルダー|サイトビルダー|ドラッグ(&|＆|アンド)?ドロップでページ|ウェブサイト(制作|作成))/i },
  { group: 'web', key: 'cms', label: 'コンテンツ管理（CMS）', noun: 'CMS', terms: ['オープンソース CMS', 'CMS OSS 日本語'], question: 'サイト更新を自社でやりたい',
    rx: /(\bcms\b|コンテンツ管理|記事(管理|公開)|webサイトの(コンテンツ|更新|管理))/i },

  // EC・販売
  { group: 'commerce', key: 'ec', label: 'ECサイトの構築', noun: 'ECサイト', terms: ['ECサイト オープンソース', 'ECサイト構築 OSS'], question: 'ネット販売を自社で持ちたい',
    rx: /(ec(サイト|構築|プラットフォーム)?|eコマース|ネットショップ|オンラインショップ|通販|カート)/i },
  { group: 'commerce', key: 'pos', label: 'POS・店舗レジ', question: 'レジと売上管理がつながっていない',
    rx: /(\bpos\b|レジ|店舗(での)?販売|売上管理)/i },
  { group: 'commerce', key: 'subscription', label: 'サブスク・継続課金', question: '毎月の請求を手作業で回している',
    rx: /(サブスクリプション|継続課金|定期(購入|課金)|月額課金)/i },
  { group: 'commerce', key: 'payment', label: 'オンライン決済', question: '入金確認に手間がかかっている',
    rx: /(決済|オンライン(支払|決済)|クレジットカード|payment|入金確認)/i },
  { group: 'commerce', key: 'marketplace', label: 'マーケットプレイスの運営', question: '出品者と購入者をつなぐ場を作りたい',
    rx: /(マーケットプレイス|出品|フリマ|\bc2c\b|多店舗)/i },
  { group: 'commerce', key: 'ticket', label: 'イベント運営・チケット販売', question: 'イベントの申込管理が手作業',
    rx: /(チケット販売|イベント(管理|運営|申込)|参加者管理|セミナー(管理|運営))/i },

  // 予約・スケジュール
  { group: 'schedule', key: 'booking', label: '予約受付システム', question: '予約の電話対応をやめたい',
    rx: /(予約(システム|受付|管理|フォーム)?)/i },
  { group: 'schedule', key: 'calendar', label: 'カレンダー・日程調整', question: '日程調整のやり取りが多すぎる',
    rx: /(カレンダー|日程調整|スケジュール(調整|共有|管理)|空き状況|アポイント)/i },
  { group: 'schedule', key: 'shift', label: 'シフト管理', question: 'シフト表の作成に毎月時間を取られる',
    rx: /(シフト)/i },
  { group: 'schedule', key: 'facility', label: '会議室・設備の予約', question: '会議室の空きがわからない',
    rx: /(施設予約|会議室|設備(予約|管理)|レンタル(管理)?|貸出)/i },

  // 申請・承認・業務フロー
  { group: 'workflow', key: 'workflow', label: '申請・承認の電子化', question: '承認が紙とハンコで止まる',
    rx: /(ワークフロー|申請|承認|決裁|稟議)/i },
  { group: 'workflow', key: 'automation', label: '定型業務の自動化', question: '毎日の繰り返し作業を人がやっている',
    rx: /(業務(の)?自動化|オートメーション|\brpa\b|定型(作業|業務)|作業の自動化|タスクの自動化)/i },
  { group: 'workflow', key: 'integration', label: 'システム間の連携・つなぎ込み', question: 'システムごとに同じ入力を繰り返している',
    rx: /(システム(間)?連携|サービス連携|webhook|iパース|ワークフロー自動化|各種サービスをつな)/i },
  { group: 'workflow', key: 'bpm', label: '業務プロセスの整理と管理', question: '業務の流れが人に依存している',
    rx: /(業務プロセス|\bbpm\b|プロセス管理|業務フロー)/i },
  { group: 'workflow', key: 'esign', label: '電子契約・電子署名', question: '契約書のやり取りが紙と郵送',
    rx: /(電子署名|電子契約|契約(書|管理)|署名|捺印)/i },
  { group: 'workflow', key: 'checklist', label: '点検・チェックリストの記録', question: '点検記録が紙のまま溜まっている',
    rx: /(チェックリスト|点検|検査(記録|管理)|巡回|監査)/i },

  // プロジェクト・タスク管理
  { group: 'project', key: 'project', label: 'プロジェクト管理', noun: 'プロジェクト管理ツール', terms: ['プロジェクト管理 オープンソース', 'プロジェクト管理ツール OSS'], question: '案件の進捗が見えない',
    rx: /(プロジェクト(管理|の(進捗|管理))?)/i },
  { group: 'project', key: 'task', label: 'タスク・ToDo管理', noun: 'タスク管理ツール', terms: ['タスク管理 OSS', 'タスク管理ツール オープンソース', 'ToDo セルフホスト'], question: '誰が何をやっているかわからない',
    rx: /(タスク管理|\btodo\b|やること|作業(管理|割り当て))/i },
  { group: 'project', key: 'issue', label: '課題・不具合の管理', question: '不具合の報告が埋もれる',
    rx: /(課題管理|チケット(管理|システム)?|issue|バグ(管理|追跡)|不具合)/i },
  { group: 'project', key: 'kanban', label: 'カンバンで進捗を見える化', question: '仕事の停滞に気づけない',
    rx: /(カンバン|kanban|進捗(管理|の可視化|状況))/i },
  { group: 'project', key: 'gantt', label: '工程表・スケジュール管理', question: '工程の遅れが後からわかる',
    rx: /(ガント|工程(表|管理)|マイルストーン|日程管理)/i },
  { group: 'project', key: 'timetrack', label: '工数・作業時間の記録', question: '何にどれだけ時間を使ったか把握できていない',
    rx: /(工数|作業時間|時間(追跡|記録)|タイムトラッキング|稼働(時間|管理))/i },
  { group: 'project', key: 'team', label: 'チームの情報共有・共同作業', question: '情報がメールとチャットに分散している',
    rx: /(チーム(内)?(の)?(情報共有|連絡|作業)|コラボレーション|共同(編集|作業)|社内連絡)/i },

  // 請求・見積・会計
  // 2026-09-05 実測: 請求書 発行 システム 590(高・CPC780〜23,025円=買い手の価値が最も高い語)／同 無料 110／電子請求書発行システム 90
  { group: 'accounting', key: 'invoice', label: '請求書の発行と管理', noun: '請求書発行システム', terms: ['請求書 発行 システム', '請求書 発行 システム 無料', '電子請求書 発行 システム'], question: '請求書を手作業で作っている',
    rx: /(請求(書|management|管理|処理)|invoice|インボイス)/i },
  { group: 'accounting', key: 'quote', label: '見積書の作成', question: '見積作成に時間がかかる',
    rx: /(見積)/i },
  { group: 'accounting', key: 'expense', label: '経費精算', question: '経費精算が月末に集中する',
    rx: /(経費|精算|立替)/i },
  { group: 'accounting', key: 'accounting', label: '会計・記帳', question: '記帳が追いついていない',
    rx: /(会計|記帳|仕訳|帳簿|簿記|複式)/i },
  { group: 'accounting', key: 'erp', label: 'ERP・基幹業務の統合', question: '部門ごとにシステムがばらばら',
    rx: /(\berp\b|基幹(業務|システム)|統合業務)/i },
  { group: 'accounting', key: 'budget', label: '予算・原価・収支の管理', question: '案件ごとの利益がわからない',
    rx: /(予算|原価|コスト管理|収支|採算|資金繰り|家計)/i },
  { group: 'accounting', key: 'asset', label: '資産・備品の管理', question: '備品の所在がわからない',
    rx: /(資産管理|備品|固定資産|貸出管理|inventory of assets|it資産)/i },

  // 在庫・受発注・製造
  { group: 'logistics', key: 'inventory', label: '在庫管理', question: '在庫をExcelで管理している',
    rx: /(在庫|棚卸)/i },
  { group: 'logistics', key: 'order', label: '受発注の管理', question: '受発注が電話とFAXのまま',
    rx: /(受発注|発注|受注)/i },
  { group: 'logistics', key: 'purchase', label: '購買・仕入の管理', question: '仕入価格の履歴が残っていない',
    rx: /(購買|仕入|調達|サプライヤー)/i },
  { group: 'logistics', key: 'warehouse', label: '倉庫・出荷の管理', question: '出荷ミスが減らない',
    rx: /(倉庫|出荷|入出庫|ピッキング|\bwms\b)/i },
  { group: 'logistics', key: 'delivery', label: '配送・物流の管理', question: '配送状況を聞かれるたびに調べている',
    rx: /(配送|物流|運送|配車|追跡番号)/i },
  { group: 'logistics', key: 'production', label: '生産・製造工程の管理', question: '製造の進み具合が現場にしかない',
    rx: /(生産管理|製造(工程|管理|業)|工程管理|\bmes\b|加工)/i },
  { group: 'logistics', key: 'maintenance', label: '設備の保守・メンテナンス管理', question: '設備の故障が突然起きる',
    rx: /(保守|設備管理|メンテナンス|\bcmms\b|修理履歴)/i },

  // 勤怠・人事・労務
  { group: 'hr', key: 'attendance', label: '勤怠管理', noun: '勤怠管理システム', terms: ['勤怠管理システム オープンソース', '勤怠管理 OSS', '勤怠管理システム 無料 自社サーバー'], question: '勤怠がタイムカードのまま',
    rx: /(勤怠|出退勤|打刻|出勤|タイムカード)/i },
  { group: 'hr', key: 'hr', label: '人事・従業員情報の管理', question: '従業員の情報が紙のファイルにある',
    rx: /(人事|従業員(情報|管理|データ)|人材管理|\bhrm?\b|組織図)/i },
  { group: 'hr', key: 'payroll', label: '給与計算', question: '給与計算に毎月手作業が入る',
    rx: /(給与|報酬計算)/i },
  { group: 'hr', key: 'recruit', label: '採用・応募者管理', question: '応募者への連絡が遅れる',
    rx: /(採用|応募者|求人|\bats\b|面接管理)/i },
  { group: 'hr', key: 'lms', label: '研修・eラーニング', question: '社内研修が属人的になっている',
    rx: /(研修|eラーニング|学習管理|\blms\b|講座|トレーニング|教育)/i },
  { group: 'hr', key: 'evaluation', label: '目標管理・人事評価', question: '評価の根拠が残っていない',
    rx: /(人事評価|目標管理|\bokr\b|1on1|評価制度)/i },

  // データ活用・分析
  { group: 'data', key: 'bi', label: 'BI・ダッシュボード', noun: 'BIツール・ダッシュボード', terms: ['BIツール オープンソース', 'ダッシュボードツール OSS', 'BI 無料 オープンソース'], question: '経営数字を見るのに毎回集計している',
    rx: /(\bbi\b|ビジネスインテリジェンス|ダッシュボード)/i },
  { group: 'data', key: 'visualize', label: 'データの可視化', question: '数字が表のままで判断に使えない',
    rx: /(可視化|グラフ(化|作成)|チャート|見える化)/i },
  { group: 'data', key: 'report', label: 'レポート・帳票の自動作成', question: '定例レポートの作成に時間がかかる',
    rx: /(レポート|帳票|定型資料|集計)/i },
  { group: 'data', key: 'dwh', label: 'データ基盤・データウェアハウス', question: 'データが各システムに分断されている',
    rx: /(データ(基盤|ウェアハウス|レイク)|\bdwh\b|分析基盤)/i },
  { group: 'data', key: 'etl', label: 'データ連携・移行', question: 'システムを乗り換えるとデータが引き継げない',
    rx: /(\betl\b|データ(連携|統合|同期|移行|パイプライン)|同期)/i },
  { group: 'data', key: 'analytics', label: 'アクセス解析・行動分析', question: 'サイトの成果が測れていない',
    rx: /(アクセス解析|web解析|行動分析|アナリティクス|トラッキング|計測)/i },
  { group: 'data', key: 'database', label: 'データベースの管理', question: 'データの置き場と権限が整理されていない',
    rx: /(データベース|db管理|\bsql\b|テーブル管理)/i },
  { group: 'data', key: 'spreadsheet', label: 'Excel業務の置き換え', question: 'Excelの管理表が壊れやすい',
    rx: /(スプレッドシート|表計算|excel|エクセル|csv)/i },

  // 文書・書類の電子化
  { group: 'document', key: 'dms', label: '文書管理・ファイル共有', question: 'ファイルの置き場がばらばら',
    rx: /(文書管理|ファイル(共有|管理|保管)|書類管理|ドキュメント管理)/i },
  // 2026-09-05 キーワードプランナー実測: ai ocr 8,100(中)／ai ocr 無料 590／手書き ocr 480／帳票 ocr 210(CPC346〜1,069円)
  { group: 'document', key: 'ocr', label: 'OCR・書類の読み取り', noun: 'AI-OCR・帳票の読み取り', terms: ['ai ocr', '帳票 ocr', '手書き ocr', 'ai ocr 無料'], question: '紙やPDFの入力を手でやっている',
    rx: /(\bocr\b|読み取り|文字認識|スキャン|データ入力|転記)/i },
  { group: 'document', key: 'paperless', label: 'ペーパーレス・書類の電子化', question: '書類が紙で溜まり続けている',
    rx: /(ペーパーレス|電子化|紙(の)?(書類|業務|文書)|保存義務)/i },
  { group: 'document', key: 'storage', label: 'オンラインストレージ・ファイルサーバー', question: '社外とのファイル受け渡しが煩雑',
    rx: /(ストレージ|ファイルサーバー|クラウド(保存|ストレージ)|ファイル送信|同期(と共有)?)/i },
  { group: 'document', key: 'pdf', label: 'PDFの生成・編集', question: 'PDFの加工に手間がかかる',
    rx: /(\bpdf\b)/i },
  { group: 'document', key: 'form', label: 'フォーム作成・アンケート集計', question: 'アンケート集計が手作業',
    rx: /(フォーム(作成|ビルダー)?|アンケート|survey|回答収集|投票|調査)/i },

  // 連絡・コミュニケーション
  { group: 'comm', key: 'chat', label: '社内チャット', question: '連絡が個人のLINEに散っている',
    rx: /(社内チャット|チャット(ツール|基盤|アプリ)|メッセージング|インスタントメッセージ|slack)/i },
  { group: 'comm', key: 'forum', label: '掲示板・コミュニティ運営', question: '社内外の情報交換の場がない',
    rx: /(掲示板|フォーラム|コミュニティ|社内sns|議論)/i },
  { group: 'comm', key: 'mail', label: 'メール・グループウェア', question: 'メールの共有と引き継ぎができていない',
    rx: /(メール(サーバー|クライアント|システム|管理)|グループウェア|webメール|共有メール)/i },
  { group: 'comm', key: 'meeting', label: 'オンライン会議・ビデオ通話', question: '会議のたびに外部サービスに頼っている',
    rx: /(オンライン会議|ビデオ(通話|会議)|web会議|画面共有|ウェビナー)/i },
  { group: 'comm', key: 'notify', label: '通知・アラートの配信', question: '大事な連絡が伝わっていない',
    rx: /(通知|アラート|プッシュ通知|\bsms\b|リマインド)/i },

  // 生成AI・AIエージェントの活用
  { group: 'ai', key: 'aiagent', label: 'AIエージェントの構築', noun: 'AIエージェント', terms: ['AIエージェント オープンソース', 'AIエージェント OSS'], question: 'AIに作業そのものを任せたい',
    rx: /(aiエージェント|エージェント|自律的|autonomous|マルチエージェント)/i },
  { group: 'ai', key: 'rag', label: '社内文書のAI検索（RAG）', question: '社内文書をAIに答えさせたい',
    rx: /(\brag\b|検索拡張|社内文書(を|の)ai|文書検索ai|独自データ(を|で)ai)/i },
  { group: 'ai', key: 'llmops', label: 'LLMの運用・切り替え', question: 'AIの利用料と品質を管理できていない',
    rx: /(\bllm\b|大規模言語モデル|モデル(管理|切り替え|提供)|推論(基盤|api|サーバー)|ローカルai)/i },
  { group: 'ai', key: 'chatui', label: '生成AIのチャット画面', question: '社内で安全に生成AIを使わせたい',
    rx: /(チャット(ui|画面|インター)|生成aiの(利用|画面)|chatgpt(代替|クローン|のような))/i },
  { group: 'ai', key: 'prompt', label: 'プロンプトの管理と評価', question: 'AIの出力品質が安定しない',
    rx: /(プロンプト)/i },
  // 文書翻訳 (2026-09-04 追加。キーワードプランナー実測: pdf 翻訳18,100/月・競合中・CPC60〜245円、pdf 翻訳 無料2,900、論文 翻訳1,600、pdf 和訳1,000)
  { group: 'ai', key: 'translate', label: '文書の翻訳', noun: 'PDF翻訳・文書翻訳', terms: ['pdf 翻訳', 'pdf 翻訳 無料', '論文 翻訳', '翻訳 オンプレミス'], question: '英語の資料を読むのに時間がかかる',
    rx: /(翻訳|多言語化|machine translation|translat(e|ion)|和訳)/i },
  { group: 'ai', key: 'aiwrite', label: '文章の生成・要約・校閲', question: '文章作成に時間がかかる',
    rx: /(校閲|校正|文章(生成|作成)|要約|翻訳|ライティング)/i },
  { group: 'ai', key: 'aiimage', label: '画像の生成・編集', question: '画像素材の用意が追いつかない',
    rx: /(画像(生成|編集|処理|加工)|イラスト|写真(編集|加工)|デザイン生成)/i },
  { group: 'ai', key: 'aivoice', label: '音声合成・文字起こし', noun: '文字起こしAI', terms: ['whisper 文字起こし', '文字起こし ai 無料', '議事録 ai 無料'], question: '録音や読み上げを人がやっている',  // 2026-09-04 実測: whisper 文字起こし4,400(中)/whisper cpp1,000(低)/議事録 ai 無料1,600
    rx: /(音声(合成|認識|処理)|文字起こし|\btts\b|読み上げ|書き起こし)/i },
  // ショートドラマ (2026-09-04 追加。キーワードプランナー実測: 縦型ショートドラマ1,000/月・競合低、ショートドラマ 制作会社260、AI ショートドラマ140)
  { group: 'ai', key: 'shortdrama', label: 'ショートドラマ・短尺動画の制作', noun: 'ショートドラマ制作', terms: ['縦型ショートドラマ', 'AI ショートドラマ', 'ショートドラマ 制作'], question: 'SNS向けの短い動画を作り続ける手が足りない',
    rx: /(ショートドラマ|短剧|short.?drama|縦型動画|ショート動画|短尺動画|short.?(form )?video|動画生成|動画を生成|text-to-video|image-to-video|video generation)/i },
  { group: 'ai', key: 'aivideo', label: '動画の生成・編集', question: '動画制作に手が回らない',
    rx: /(動画|映像|字幕)/i },
  { group: 'ai', key: 'vectordb', label: 'ベクトル検索・類似検索', question: '言葉が違うと社内検索で見つからない',
    rx: /(ベクトル|埋め込み|embedding|類似(検索|度)|セマンティック)/i },
  { group: 'ai', key: 'search', label: '全文検索の仕組み', noun: '全文検索システム', terms: ['全文検索 システム', 'namazu 全文検索', 'fess 全文検索', 'pdf 全文検索'], question: '検索しても目的の資料に辿り着けない',  // 2026-09-04 実測: namazu1,600(低)/fess1,000(低)/全文検索 システム50
    rx: /(全文検索|検索エンジン|検索(基盤|機能|システム))/i },

  // システムの運用・内製化
  { group: 'ops', key: 'lowcode', label: '社内ツールの内製化（ローコード）', question: '欲しい画面を都度外注している',
    rx: /(ローコード|ノーコード|管理画面|社内(ツール|システム)|業務アプリ|内部ツール)/i },
  { group: 'ops', key: 'monitoring', label: 'システムの監視・障害検知', question: '障害に気づくのが遅い',
    rx: /(監視|ヘルスチェック|稼働(監視|状況)|障害(検知|対応)|死活)/i },
  { group: 'ops', key: 'log', label: 'ログの収集と分析', question: '何が起きたか後から追えない',
    rx: /(ログ(収集|管理|分析|基盤)|監査ログ|トレース)/i },
  { group: 'ops', key: 'backup', label: 'バックアップ・データ保全', question: 'データが消えたら戻せない',
    rx: /(バックアップ|復旧|データ保全|災害対策|アーカイブ)/i },
  { group: 'ops', key: 'auth', label: '認証・アクセス権の管理', question: '退職者のアカウントが残っている',
    rx: /(認証|シングルサインオン|\bsso\b|アクセス(権|制御)|権限管理|id管理|パスワード管理)/i },
  { group: 'ops', key: 'security', label: 'セキュリティ・脆弱性対応', question: '情報漏えいへの備えが不十分',
    rx: /(セキュリティ|脆弱性|不正アクセス|暗号化|漏えい|ファイアウォール)/i },
  { group: 'ops', key: 'deploy', label: 'デプロイ・環境構築の自動化', question: 'リリースのたびに手作業が発生する',
    rx: /(デプロイ|ci\/?cd|環境構築|コンテナ|kubernetes|docker|セルフホスティング基盤)/i },
  { group: 'ops', key: 'devtool', label: '開発作業の効率化', question: '開発に人手がかかりすぎる',
    rx: /(開発(効率|支援|の自動化)|コード(生成|レビュー|解析|補完)|リポジトリ|バージョン管理|テスト自動)/i },
  { group: 'ops', key: 'api', label: 'API開発・API連携', question: '外部サービスとのつなぎ込みが毎回作り込みになる',
    rx: /(api(開発|連携|管理|ゲートウェイ|構築|提供)|rest api|graphql)/i },

  // 業種ごとの業務
  { group: 'industry', key: 'medical', label: '医療・介護の記録管理', question: '診療や介護の記録が紙のまま',
    rx: /(医療|カルテ|介護|クリニック|病院|診療|患者)/i },
  { group: 'industry', key: 'education', label: '学校・教育機関の業務', question: '校務の事務作業が多い',
    rx: /(学校|教育機関|生徒|授業|校務|学習(記録|管理)|大学)/i },
  { group: 'industry', key: 'realestate', label: '不動産・物件の管理', question: '物件情報の更新が追いつかない',
    rx: /(不動産|物件|賃貸|入居)/i },
  { group: 'industry', key: 'restaurant', label: '飲食店の運営', question: '注文とメニューの管理が手作業',
    rx: /(飲食|レストラン|メニュー管理|注文(受付|管理)|テイクアウト)/i },
  { group: 'industry', key: 'membership', label: '会員組織・団体の運営', question: '会員名簿と会費の管理が煩雑',
    rx: /(会員(管理|名簿)|会費|団体|\bnpo\b|協会|自治会)/i },
  { group: 'industry', key: 'construction', label: '建設・工事の管理', question: '現場の状況が事務所に届かない',
    rx: /(建設|工事|現場(管理|作業)|施工|建築)/i },
  // 地図・位置情報 (2026-09-01 追加。カタログにGIS系がほぼ無い空白をkshoken構築と同時に埋める)
  { group: 'data', key: 'gis', label: '地図・位置情報の活用（GIS）', question: '住所や位置のデータを地図で見られていない',
    rx: /(\bgis\b|地図|位置情報|ジオコーディング|geospatial|geocod|maplibre|leaflet|openstreetmap|地理空間|空間データ|routing engine|経路探索|isochrone|測位|ジオフェンス)/i },  // 「マップ」はロードマップ/サイトマップ/マインドマップを誤爆するので入れない(2026-09-01実測)
  { group: 'data', key: 'shoken', label: '商圏分析・エリアマーケティング', noun: '商圏分析ツール', terms: ['商圏分析 ツール', '商圏分析 無料', '商圏 分析 gis'], question: '出店や営業エリアを勘で決めている',  // 2026-09-04 キーワードプランナー実測: 商圏1,600/商圏 分析480/商圏 分析 ツール210/商圏 分析 無料70
    rx: /(商圏|到達圏|trade area|catchment|エリアマーケ|人口メッシュ|メッシュ統計|出店(判断|計画|候補|戦略)|立地分析|demographics? analysis)/i },  // 「出店」単独はECテンプレ(ネットショップ出店)を誤爆したので複合語に限定(2026-09-04)
  { group: 'industry', key: 'civic', label: '政治・市民参加・合意形成', question: '支援者や住民の声を集めて活かす仕組みがない',
    rx: /(政治|選挙|議会|市民参加|パブリック?コメント|民主主義|熟議|広聴|後援会|自治体.{0,6}(参加|意見)|participatory|democracy|civic|advocacy|petition)/i },
]

export const OTHER: Capability = {
  group: 'ops', key: 'other', label: '業務システムの内製化', question: '自社の業務に合う仕組みがない',
  rx: /.*/,
}

/** 一覧ページを作る最少件数。これ未満は薄いページになるので作らない。 */
export const MIN_MEMBERS = 5

/**
 * カタログ側の category を大分類に対応づける。主題を選ぶときの加点に使う。
 *
 * なぜ必要か: Ghost の要約は「出版や会員制、ニュースレター配信」で、
 * 語の数だけ見るとメルマガが勝つ。だが category は cms で、keywords も
 * ブログ・CMS。人が探す言葉は「ブログ」なので、独立に付いている category を
 * 弱い加点として効かせる。
 *
 * devtools（512件・最多）は入れない。中身がAI基盤から監視まで広すぎて、
 * 加点すると AIエージェント等の主題が「開発作業の効率化」に流れる。
 */
export const CATEGORY_GROUP: Record<string, string> = {
  cms: 'web', commerce: 'commerce', pos: 'commerce', accounting: 'accounting',
  knowledge: 'knowledge', project: 'project', crm: 'sales', marketing: 'sales',
  forum: 'comm', groupware: 'comm', support: 'support', hr: 'hr', lms: 'hr',
  dms: 'document', survey: 'document', inventory: 'logistics',
  booking: 'schedule', lowcode: 'ops', analytics: 'data', esign: 'workflow',
  gis: 'data',
  shoken: 'data',
  civic: 'industry',
}

/** category が一致したときの加点。要約に1回出たのと同じ重み。 */
const CATEGORY_BONUS = 3

/**
 * texts[0]=要約, texts[1]=説明, 以降=用途。
 * 用途は数が多いので、単純な回数比較だと副次的な用途が主題を上回る
 * （例: ghost は用途に「ニュースレター」が3回出てCMSに勝ってしまう）。
 * 要約と説明を重く見て、そのOSSの本質が反映されるようにする。
 */
export function score(texts: string[], cap: Capability): number {
  const head = [texts[0] || '', texts[1] || ''].join(' ')
  const rest = texts.slice(2).join(' ')
  const hits = (s: string) => (s.match(new RegExp(cap.rx.source, 'gi')) || []).length
  return hits(head) * 3 + hits(rest)
}

/**
 * 主題を1つ選ぶ。allowed を渡すと、その中からだけ選ぶ
 * （一覧ページを作らなかった分類を主題にすると、パンくずの行き先が無くなるため）。
 */
export function classify(texts: string[], allowed?: Set<string>, category?: string): Capability {
  const boosted = category ? CATEGORY_GROUP[category] : undefined
  let best: Capability | null = null
  let bestScore = 0
  for (const cap of CAPABILITIES) {
    if (allowed && !allowed.has(cap.key)) continue
    const base = score(texts, cap)
    // 当てはまりがゼロの分類に category だけで主題を与えない
    const s = base > 0 && cap.group === boosted ? base + CATEGORY_BONUS : base
    if (s > bestScore) {
      best = cap
      bestScore = s
    }
  }
  return best ?? OTHER
}

/** そのOSSが少しでも当てはまる分類を、当てはまりの強い順に返す。一覧ページの掲載に使う。 */
export function matches(texts: string[]): Array<{ cap: Capability; s: number }> {
  return CAPABILITIES.map((cap) => ({ cap, s: score(texts, cap) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
}
