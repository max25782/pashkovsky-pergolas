import fs from 'fs'
import path from 'path'

const root = process.cwd()
const publicDir = path.join(root, 'public')
const videoDir = path.join(publicDir, 'video')
const outDir = path.join(root, 'data', 'gallery')
const outFile = path.join(outDir, 'videos.json')

const VIDEO_EXTS = new Set(['.mp4', '.webm'])

function ensureDir(dir){ fs.mkdirSync(dir, { recursive: true }) }

function list(dir){
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
}

function main(){
  ensureDir(outDir)
  const items = []
  for (const e of list(videoDir)){
    if (!e.isFile()) continue
    const ext = path.extname(e.name).toLowerCase()
    if (!VIDEO_EXTS.has(ext)) continue
    const src = `/video/${e.name}`
    const posterCandidate = `/video/${e.name.replace(/\.(mp4|webm)$/i, '.webp')}`
    const posterPath = path.join(videoDir, e.name.replace(/\.(mp4|webm)$/i, '.webp'))
    const poster = fs.existsSync(posterPath) ? posterCandidate : null
    items.push({ src, poster, type: 'video' })
  }
  const data = { items }
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8')
  console.log(`✓ Wrote ${outFile} with ${items.length} videos`)
}

main()


