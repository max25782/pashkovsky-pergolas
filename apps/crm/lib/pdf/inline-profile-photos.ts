import fs from 'node:fs'
import path from 'node:path'

let photoDirCache: string | null | undefined

function photoDir(): string | null {
  if (photoDirCache !== undefined) return photoDirCache
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    const direct = path.join(dir, 'public/profile-photo-check/photos')
    const nested = path.join(dir, 'apps/crm/public/profile-photo-check/photos')
    if (fs.existsSync(direct)) {
      photoDirCache = direct
      return direct
    }
    if (fs.existsSync(nested)) {
      photoDirCache = nested
      return nested
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  photoDirCache = null
  return null
}

function photoFile(src: string): string | null {
  const dir = photoDir()
  if (!dir) return null
  const base = decodeURIComponent(src.split('/').pop() ?? '').split('?')[0]
  if (!base || base.startsWith('data:')) return null
  const exact = path.join(dir, base)
  if (fs.existsSync(exact)) return exact
  const lower = base.toLowerCase()
  const found = fs.readdirSync(dir).find((name) => name.toLowerCase() === lower)
  return found ? path.join(dir, found) : null
}

/** Replace local profile <img> sources with data URIs so about:blank can paint them. */
export function inlineProfilePhotoDataUris(html: string): string {
  return html.replace(/(\bsrc=")([^"]+)(")/gi, (all, open: string, src: string, close: string) => {
    const file = photoFile(src)
    if (!file) return all
    const mime = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    return `${open}data:${mime};base64,${fs.readFileSync(file).toString('base64')}${close}`
  })
}
