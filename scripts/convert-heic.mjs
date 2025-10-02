import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import heicConvert from 'heic-convert'

const root = process.cwd()
const searchDirs = [
  path.join(root, 'public', 'images'),
  path.join(root, 'public', 'hero')
]

async function convertFile(srcPath){
  const dir = path.dirname(srcPath)
  const base = path.basename(srcPath, path.extname(srcPath))
  const dstPath = path.join(dir, `${base}.jpg`)
  try {
    await sharp(srcPath).rotate().jpeg({ quality: 82 }).toFile(dstPath)
    fs.unlinkSync(srcPath)
    console.log(`Converted ${srcPath} -> ${dstPath} (sharp)`)    
  } catch (e){
    try {
      const input = fs.readFileSync(srcPath)
      const output = await heicConvert({ buffer: input, format: 'JPEG', quality: 0.82 })
      fs.writeFileSync(dstPath, output)
      fs.unlinkSync(srcPath)
      console.log(`Converted ${srcPath} -> ${dstPath} (heic-convert)`) 
    } catch (e2){
      console.error(`Failed to convert ${srcPath}:`, e2.message)
    }
  }
}

function walk(dir){
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries){
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.isFile()){
      const ext = path.extname(e.name).toLowerCase()
      if (ext === '.heic') pending.push(full)
    }
  }
}

const pending = []
for (const dir of searchDirs) {
  if (fs.existsSync(dir)) walk(dir)
}
;(async ()=>{
  for (const p of pending){
    await convertFile(p)
  }
  console.log(`Done. Converted ${pending.length} file(s).`)
})()


