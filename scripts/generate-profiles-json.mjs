import fs from 'fs'
import path from 'path'

const root = process.cwd()
const imagesDir = path.join(root, 'public', 'images', 'profiles')
const jsonPath = path.join(root, 'public', 'data', 'profiles.json')

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // drop extension
    .replace(/[^a-z0-9\u0590-\u05FF\u0400-\u04FF]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function readExisting() {
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data?.profiles)) return data
  } catch {}
  return { profiles: [] }
}

function main() {
  if (!fs.existsSync(imagesDir)) {
    console.error('Images directory not found:', imagesDir)
    process.exit(1)
  }

  const existing = readExisting()
  const profiles = existing.profiles
  const byBasename = new Map(
    profiles
      .filter((p) => typeof p?.image === 'string')
      .map((p) => [path.basename(p.image), p])
  )

  const files = fs
    .readdirSync(imagesDir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()

  let added = 0
  for (const file of files) {
    if (byBasename.has(file)) continue
    const base = file
    const id = slugify(base)
    const label = base.replace(/\.[^.]+$/, '')
    profiles.push({
      id,
      name: { he: label, ru: label, en: label },
      image: `/images/profiles/${file}`,
      dimensions: '',
      description: { he: '', ru: '', en: '' },
    })
    added++
  }

  // write pretty
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, JSON.stringify({ profiles }, null, 2), 'utf-8')
  console.log(`Profiles updated. Total: ${profiles.length}. Added: ${added}.`)
}

main()


