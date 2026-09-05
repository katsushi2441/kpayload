/** カテゴリ別OGP画像を作るための一覧書き出し（make_category_ogp.py が読む）。 */
import fs from 'fs'
import { categoryLabels } from './site'
import { CAPABILITIES } from './capability'
const out = {
  oss: Object.entries(categoryLabels).map(([key, label]) => ({ key, label })),
  cap: (CAPABILITIES as Array<{ key: string; label: string; noun?: string }>)
        .map((c) => ({ key: c.key, label: c.label, noun: c.noun ?? null })),
}
fs.writeFileSync('outputs-cats.json', JSON.stringify(out, null, 1))
console.log('oss', out.oss.length, '/ cap', out.cap.length)
