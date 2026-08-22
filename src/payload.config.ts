import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { ja } from '@payloadcms/translations/languages/ja'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { OSSProjects } from './collections/OSSProjects'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  i18n: { supportedLanguages: { en, ja }, fallbackLanguage: 'ja' },
  admin: { user: Users.slug, importMap: { baseDir: path.resolve(dirname) } },
  collections: [OSSProjects, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URL || 'file:./kpayload.db' } }),
})
