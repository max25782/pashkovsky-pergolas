import fs from 'fs'
import path from 'path'

const root = process.cwd()
const dir = path.join(root, 'public', 'images', 'profiles')

function normalizeName(filename) {
  const ext = path.extname(filename)
  const name = path.basename(filename, ext)

  // remove " (n)" duplicates
  let base = name.replace(/\s*\(\d+\)\s*$/i, '')
  // remove dimension suffixes like -300x200, _300x200, –300x200
  base = base.replace(/[\s_-]*\d{2,4}x\d{2,4}$/i, '')

  // trim stray dashes/underscores/space
  base = base.replace(/[\s_-]+$/g, '')
  return base + ext.toLowerCase()
}

function main(){
  if (!fs.existsSync(dir)){
    console.error('Folder not found:', dir)
    process.exit(1)
  }

  const files = fs.readdirSync(dir)
    .filter(f => /\.(png|jpe?g|webp)$/i.test(f))

  let renamed = 0
  for (const f of files){
    const nf = normalizeName(f)
    if (nf !== f){
      const src = path.join(dir, f)
      let dst = path.join(dir, nf)
      // prevent overwrite: if exists, add numeric suffix
      let i = 1
      while (fs.existsSync(dst)){
        const ext = path.extname(nf)
        const name = path.basename(nf, ext)
        dst = path.join(dir, `${name}-${i}${ext}`)
        i++
      }
      fs.renameSync(src, dst)
      renamed++
      console.log('Renamed:', f, '->', path.basename(dst))
    }
  }

  console.log(`Done. Renamed ${renamed} files.`)
}

main()


