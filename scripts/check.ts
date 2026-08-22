import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist', 'oss')
const catalog = JSON.parse(await fs.readFile(path.join(dist, 'catalog.json'), 'utf8')) as Array<{ slug: string; brainUrl?: string | null; funnel?: string }>

if (catalog.length < 20) throw new Error(`Expected at least 20 OSS records, got ${catalog.length}`)
if (new Set(catalog.map((item) => item.slug)).size !== catalog.length) throw new Error('Duplicate slugs found')

const selfOwnedSlugs = [
  'aiknowledgecms', 'aimediapost', 'airadio', 'airadio-scripted-mv', 'aixec', 'kappstore',
  'karchitect', 'kcbrain', 'kclauncher', 'kfinanalyst', 'kfreqai', 'kfxai', 'kfxbrain',
  'kgeo', 'kmontage', 'ksbrain', 'ktajp', 'tradingagents-jp', 'kurl2gr', 'kvtuber',
  'kzabbix', 'kurage', 'nofx', 'url2ai', 'url2brain', 'url2pub',
]
for (const slug of selfOwnedSlugs) {
  const item = catalog.find((entry) => entry.slug === slug) as { githubUrl?: string | null, lpUrl?: string | null } | undefined
  if (!item || !item.githubUrl?.includes('github.com/katsushi2441/') || !item.lpUrl?.includes('.exbridge.jp')) {
    throw new Error(`${slug}: self-owned OSS GitHub or product page is missing`)
  }
}

const index = await fs.readFile(path.join(dist, 'index.html'), 'utf8')
if (!index.includes('ItemList') || !index.includes('Service') || !index.includes('FAQPage') || !index.includes('simpletrack.php') || !index.includes('G-BP0650KDFR')) throw new Error('Index SEO, AEO, GEO or analytics is incomplete')
if (!index.includes('OSSをバイブコーディングでカスタマイズするとは？')) throw new Error('Index direct answer for OSS vibe coding is missing')
if (!index.includes('AI開発ツールを使ったバイブコーディング開発とは？')) throw new Error('Index direct answer for prototype development is missing')
if (!index.includes('data-kind="prototype"')) throw new Error('Index funnel filter is missing')

// 全件をトップに並べるとHTMLが数MBになる。実体はカテゴリページに置く。
const MAX_INDEX_BYTES = 400_000
if (Buffer.byteLength(index, 'utf8') > MAX_INDEX_BYTES) throw new Error(`Index HTML is too large: ${Buffer.byteLength(index, 'utf8')} bytes`)
const categories = [...new Set(catalog.map((entry) => (entry as { category?: string }).category).filter(Boolean))] as string[]
if (!categories.length) throw new Error('catalog.json has no category')
for (const category of categories) {
  if (!index.includes(`/oss/c/${category}/`)) throw new Error(`Index does not link to category ${category}`)
  const page = await fs.readFile(path.join(dist, 'c', category, 'index.html'), 'utf8')
  if (!page.includes(`https://kurage.exbridge.jp/oss/c/${category}/`)) throw new Error(`${category}: canonical is missing`)
  if (!page.includes('ItemList') || !page.includes('BreadcrumbList') || !page.includes('FAQPage')) throw new Error(`${category}: structured data is incomplete`)
  if (!page.includes('simpletrack.php') || !page.includes('G-BP0650KDFR')) throw new Error(`${category}: analytics is missing`)
  const shown = (page.match(/class="card"/g) || []).length
  const expected = catalog.filter((entry) => (entry as { category?: string }).category === category).length
  if (shown !== expected) throw new Error(`${category}: shows ${shown} cards but catalog has ${expected}`)
}
{
  const infra = ['sqlite', 'postgresql', 'mysql-community', 'libreoffice']
  for (const slug of infra) {
    const item = catalog.find((entry) => entry.slug === slug)
    if (item && item.funnel !== 'prototype') throw new Error(`${slug}: infrastructure must not be sold as a customization target`)
  }
}

for (const item of catalog) {
  const html = await fs.readFile(path.join(dist, item.slug, 'index.html'), 'utf8')
  const expectedCanonical = `https://kurage.exbridge.jp/oss/${item.slug}/`
  if (!html.includes(expectedCanonical) || !html.includes('SoftwareApplication') || !html.includes('Service') || !html.includes('FAQPage') || !html.includes('BreadcrumbList')) throw new Error(`${item.slug}: SEO, AEO or GEO data is incomplete`)
  if (item.funnel !== 'oss' && item.funnel !== 'prototype') throw new Error(`${item.slug}: funnel is missing`)
  if (item.funnel === 'prototype') {
    if (!html.includes('を使ったシステム開発')) throw new Error(`${item.slug}: prototype development explanation is missing`)
    if (!html.includes(`ref=proto-${item.slug}`) || !html.includes('/vibe-prototype.html')) throw new Error(`${item.slug}: prototype CTA is missing`)
    if (html.includes('/vibe-oss.html?ref=')) throw new Error(`${item.slug}: prototype page must not offer OSS customization`)
    if (html.includes('をバイブコーディングでカスタマイズ</h2>')) throw new Error(`${item.slug}: prototype page must not claim the tool itself is customizable`)
  } else {
    if (!html.includes('をバイブコーディングでカスタマイズ')) throw new Error(`${item.slug}: OSS customization explanation is missing`)
    if (!html.includes(`ref=oss-${item.slug}`) || !html.includes('/vibe-oss.html')) throw new Error(`${item.slug}: customization CTA is missing`)
  }
  const hasBrainLink = html.includes(`data-brain-for="${item.slug}"`)
  if (hasBrainLink !== Boolean(item.brainUrl)) throw new Error(`${item.slug}: Brain link does not match catalog data`)
}

const vibeSnippet = await fs.readFile(path.join(root, 'dist', 'vibe-oss-catalog.html'), 'utf8')
if (!vibeSnippet.includes(`${catalog.length}件のOSSを掲載`)) throw new Error('vibe-oss snippet count is missing')
if (!vibeSnippet.includes('バイブコーディングでカスタマイズできるOSS')) throw new Error('vibe-oss snippet customization message is missing')

const llms = await fs.readFile(path.join(dist, 'llms.txt'), 'utf8')
if (!llms.includes('OSS customization service') || !llms.includes('/vibe-oss.html')) throw new Error('llms.txt service guidance is incomplete')
if (!llms.includes('Prototype development service') || !llms.includes('/vibe-prototype.html')) throw new Error('llms.txt prototype guidance is incomplete')
console.log(`Validated ${catalog.length} OSS pages, conditional Brain links, SEO/AEO/GEO, analytics and CTA links.`)
