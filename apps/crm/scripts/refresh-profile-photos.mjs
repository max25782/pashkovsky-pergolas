/**
 * Downloads catalog photos that answer on the public gallery URL.
 * Profiles with no readable file get a section drawn from the catalog size.
 * Re-run when gallery keys work; this script only uses the public URL.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const profiles = JSON.parse(readFileSync(join(root, 'public/data/profiles.json'), 'utf8')).profiles
const pagePath = join(root, 'public/profile-photo-check/index.html')
const photoDir = join(root, 'public/profile-photo-check/photos')
const base = 'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com'
mkdirSync(photoDir, { recursive: true })

function unsuffixed(imagePath) {
  return imagePath.replace(/-300x200(?=\.[a-z0-9]+$)/i, '')
}

async function downloadOne(profile) {
  const path = unsuffixed(profile.image)
  const url = encodeURI(base + path)
  const response = await fetch(url)
  if (!response.ok) return { id: profile.id, ok: false, status: response.status }
  const bytes = Buffer.from(await response.arrayBuffer())
  const name = basename(path)
  writeFileSync(join(photoDir, name), bytes)
  return { id: profile.id, ok: true, name, bytes: bytes.length, url }
}

const results = []
for (let i = 0; i < profiles.length; i += 8) {
  const batch = profiles.slice(i, i + 8)
  results.push(...await Promise.all(batch.map((profile) => downloadOne(profile).catch((error) => ({
    id: profile.id,
    ok: false,
    status: error.message,
  })))))
}

const byId = new Map(results.filter((row) => row.ok).map((row) => [row.id.toLowerCase(), row]))

function sectionSvg(sizeText) {
  const match = sizeText.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/)
  const wall = sizeText.match(/стенка\s+(\d+(?:\.\d+)?)/)
  const w = match ? Number(match[1]) : 40
  const h = match ? Number(match[2]) : 40
  const longer = Math.max(w, h, 1)
  const rw = Math.round((w / longer) * 78)
  const rh = Math.round((h / longer) * 78)
  const x = Math.round((120 - rw) / 2)
  const y = Math.round((100 - rh) / 2)
  const wallMm = wall ? Number(wall[1]) : 0
  const inset = wallMm > 0 ? Math.max(3, Math.round((wallMm / longer) * 78)) : 0
  const inner = inset > 0 && rw > inset * 2 && rh > inset * 2
    ? `<rect x="${x + inset}" y="${y + inset}" width="${rw - inset * 2}" height="${rh - inset * 2}" fill="#fff" stroke="#111" stroke-width="1"/>`
    : ''
  return `<svg viewBox="0 0 120 110" width="100%" height="140" role="img" aria-label="сечение ${w}×${h}">
    <rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="#e5e7eb" stroke="#111" stroke-width="2"/>
    ${inner}
    <text x="60" y="104" text-anchor="middle" font-size="11" font-family="Arial">${w}×${h}</text>
  </svg>`
}

let html = readFileSync(pagePath, 'utf8')
html = html.replace(
  /<p class="lead">[\s\S]*?<\/p>/,
  '<p class="lead">Строительный каталог. Фото скачаны по публичной ссылке, если файл открывается. Где ссылки нет — сечение по размерам каталога, с пометкой. Оригинал догрузится, когда заработают ключи галереи.</p>',
)

html = html.replace(/<article class="bad">([\s\S]*?)<\/article>/g, (article, body) => {
  const id = (body.match(/<h2>([^<]+)<\/h2>/) ?? [])[1] ?? ''
  const downloaded = byId.get(id.toLowerCase())
  if (downloaded) {
    const next = body.replace(
      /<div class="missing">нет файла<\/div>/,
      `<img src="photos/${downloaded.name}" alt="${id}">`,
    ).replace(
      /<p class="file">[\s\S]*?<\/p>/,
      `<p class="file">${downloaded.url}<br>${downloaded.bytes} байт</p>`,
    )
    return `<article class="">${next}</article>`
  }
  const size = (body.match(/<p>([^<]*мм[^<]*)<\/p>/) ?? [])[1] ?? ''
  const next = body.replace(
    /<div class="missing">нет файла<\/div>/,
    sectionSvg(size),
  ).replace(
    /<p class="file">[\s\S]*?<\/p>/,
    '<p class="file">оригинал не скачан</p><p class="note">Сечение по размерам каталога. Оригинал догрузится, когда заработают ключи.</p>',
  )
  return `<article class="flag">${next}</article>`
})

function weightLine(id, text) {
  const pattern = new RegExp(`(<h2>${id}</h2>\\s*<p>[^<]*</p>\\s*<p>[^<]*</p>)`)
  if (html.includes(`<h2>${id}</h2>`) && !html.includes(text)) {
    html = html.replace(pattern, `$1\n      <p class="note">${text}</p>`)
  }
}
weightLine('pa1191', 'Вес 1.29 кг/м.')
weightLine('square-150', 'Вес 4.256 кг/м (pa2012).')
writeFileSync(pagePath, html)
const ok = results.filter((row) => row.ok).length
console.log(`downloaded ${ok} of ${profiles.length}`)
console.log(results.filter((row) => !row.ok).map((row) => `${row.id} ${row.status}`).join('\n'))
