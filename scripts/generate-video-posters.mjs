import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'

ffmpeg.setFfmpegPath(ffmpegPath.path)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov'])

function isVideo(file){
  return VIDEO_EXTS.has(path.extname(file).toLowerCase())
}

function* walk(dir){
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

function ensureDir(dir){
  fs.mkdirSync(path.dirname(dir), { recursive: true })
}

async function createPoster(videoPath){
  const posterPath = videoPath.replace(/\.(mp4|webm|mov)$/i, '.webp')
  if (fs.existsSync(posterPath)){
    console.log(`✓ Poster exists: ${path.relative(process.cwd(), posterPath)}`)
    return
  }
  ensureDir(posterPath)
  console.log(`🎞  Creating poster for ${path.relative(process.cwd(), videoPath)}`)
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-ss', '00:00:00.5', // seek to 0.5s
        '-vframes', '1',      // one frame
        '-vf', 'scale=1280:-2',
        '-q:v', '70',
      ])
      .output(posterPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
  console.log(`✓ Poster created: ${path.relative(process.cwd(), posterPath)}`)
}

async function main(){
  const roots = [
    path.join(__dirname, '../public/images'),
    path.join(__dirname, '../public/video'),
  ]
  for (const root of roots){
    if (!fs.existsSync(root)) continue
    const vids = Array.from(walk(root)).filter(isVideo)
    for (const v of vids){
      try { await createPoster(v) } catch (e){
        console.error('✗ Poster failed for', v, e?.message)
      }
    }
  }
  console.log('Done.')
}

main()


