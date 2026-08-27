import 'dotenv/config'
import fs from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '../src/payload.config'
const payload = await getPayload({ config })
const { docs } = await payload.find({ collection: 'oss-projects', limit: 5000, depth: 0 })
const out = docs.map((p: any) => ({ slug: p.slug, name: p.name, summary: p.summary, category: p.category,
  githubUrl: p.githubUrl, stars: p.stars ?? 0, japaneseStatus: p.japaneseStatus, funnel: p.funnel }))
await fs.writeFile('/tmp/claude-1000/-home-kojima-work/7230f738-72fc-4ac2-ae71-cd89b6f444a1/scratchpad/oss_projects.json', JSON.stringify(out), 'utf8')
console.log('projects:', out.length, '| stars>1000:', out.filter((x:any)=>x.stars>1000).length)
process.exit(0)
