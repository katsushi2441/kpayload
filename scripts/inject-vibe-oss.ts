import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.resolve(root, '..', 'kurage_web', 'vibe-oss.html')
const snippet = await fs.readFile(path.join(root, 'dist', 'vibe-oss-catalog.html'), 'utf8')
const source = await fs.readFile(target, 'utf8')
const start = '<!-- BEGIN kpayload-catalog -->'
const end = '<!-- END kpayload-catalog -->'

let next: string
if (source.includes(start) && source.includes(end)) {
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`)
  next = source.replace(pattern, `${start}\n${snippet}\n${end}`)
} else {
  const pattern = /  <section class="block" id="examples">[\s\S]*?<\/section>/
  if (!pattern.test(source)) throw new Error('Could not find the existing OSS examples section')
  next = source.replace(pattern, `  ${start}\n${snippet}\n${end}`)
}

next = next.replace('href="#examples"', 'href="#oss-catalog"')
await fs.writeFile(target, next)
console.log(`Updated ${target}`)
