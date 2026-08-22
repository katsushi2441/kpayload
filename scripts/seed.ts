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
