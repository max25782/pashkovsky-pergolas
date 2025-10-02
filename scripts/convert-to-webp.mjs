import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const root = process.cwd()
const searchDirs = [
  path.join(root, 'public', 'images'),
  path.join(root, 'public', 'hero')
]

async function convertFile(srcPath) {
  const dir = path.dirname(srcPath)
  const base = path.basename(srcPath, path.extname(srcPath))
  const dstPath = path.join(dir, `${base}.webp`)
  
  try {
    await sharp(srcPath)
      .rotate()
      .webp({ quality: 90, effort: 6 })
      .toFile(dstPath)
    console.log(`✓ ${srcPath} → ${dstPath}`)
  } catch (e) {
    console.error(`✗ Failed ${srcPath}:`, e.message)
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase()
      if (ext === '.jpg' || ext === '.jpeg') pending.push(full)
    }
  }
}

const pending = []
for (const dir of searchDirs) {
  if (fs.existsSync(dir)) walk(dir)
}

;(async () => {
  console.log(`Found ${pending.length} JPG files to convert...\n`)
  for (const p of pending) {
    await convertFile(p)
  }
  console.log(`\n✓ Done. Converted ${pending.length} file(s) to WebP.`)
})()

