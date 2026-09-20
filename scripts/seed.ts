import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import type { OssProject } from '../src/payload-types'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(root, 'data', 'oss-catalog.json')
// 自動収集分は別ファイル。手作り46件と混ぜず、あとから足し引きできるようにする。
const harvestedPath = path.join(root, 'data', 'oss-catalog-harvested.json')

type SeedProject = Omit<OssProject, 'id' | 'createdAt' | 'updatedAt'>
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8')) as SeedProject[]
let harvested: SeedProject[] = []
try {
  harvested = JSON.parse(await fs.readFile(harvestedPath, 'utf8')) as SeedProject[]
} catch {
  harvested = []
}
catalog.push(...harvested)

// 検索結果での題名・説明文の上書き（slug → {seoTitle, summary}）。
// harvest/enrich が harvested を作り直すと手で直した題名が消えるので、別ファイルに分けて最後に重ねる。
// 2026-09-09 に5件を直接書き換えたが、9/18 の再生成で4件が消えていた（GSCでクリック0のまま）。
const seoPath = path.join(root, 'data', 'oss-catalog-seo.json')
try {
  const seo = JSON.parse(await fs.readFile(seoPath, 'utf8')) as Record<string, { seoTitle?: string; summary?: string }>
  let applied = 0
  for (const item of catalog) {
    const o = seo[String(item.slug)]
    if (!o) continue
    if (o.seoTitle) (item as Record<string, unknown>).seoTitle = o.seoTitle
    if (o.summary) (item as Record<string, unknown>).summary = o.summary
    applied++
  }
  console.log(`SEO overrides applied to ${applied} records`)
} catch {
  console.log('SEO overrides file not found; skipped')
}

const payload = await getPayload({ config })

for (const item of catalog) {
  const slug = String(item.slug)
  const existing = await payload.find({
    collection: 'oss-projects',
    limit: 1,
    where: { slug: { equals: slug } },
  })

  if (existing.docs[0]) {
    await payload.update({ collection: 'oss-projects', id: existing.docs[0].id, data: item })
    payload.logger.info(`Updated ${slug}`)
  } else {
    await payload.create({ collection: 'oss-projects', data: item })
    payload.logger.info(`Created ${slug}`)
  }
}

payload.logger.info(`Seeded ${catalog.length} OSS records (${catalog.length - harvested.length} handmade + ${harvested.length} harvested)`)
process.exit(0)
