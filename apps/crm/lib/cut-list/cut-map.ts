import type { ProfileDimensions, StockBar } from '@pashkovsky/pergola-core'
import { DEFAULT_KERF_MM } from '@pashkovsky/pergola-core'
import {
  beamSegmentPart,
  buildOrderSheetTotals,
  chosenStockLengthMm,
  displayCutDeg,
  formatCutDeg,
  type ProfileBundlePlan,
} from './order-sheet'

/** Local gallery files whose name is the profile id (lowercase .jpg). Anything else is drawn. */
const LOCAL_PROFILE_PHOTOS = new Set([
  'f100100', 'f10020', 'f10040', 'f12040', 'f20050', 'f4060', 'f7020', 'f8080',
  'hs001', 'hs003', 'hs004', 'hs005', 'hs006', 'hs007', 'hs009', 'hs012', 'hs013',
  'hs022', 'hs024', 'hs025',
  // r242.jpg in the gallery is labeled 142×100 — wrong vs catalog 142×70. R242 uses
  // the drawn double-T section below, not that file.
  'pa1162', 'pa1197', 'pa1296', 'pa3022', 'pa1429', 'p1034',
])

/** Profiles with a real drawn section (not the hollow-rectangle schematic). */
const DRAWN_SECTION_PROFILE_IDS = new Set(['r242'])

export interface ProfilePhotoMatch {
  profileId: string
  file: string | null
  confidence: 'high' | 'medium' | 'none'
}

export function profilePhotoMatch(profileId: string): ProfilePhotoMatch {
  const stem = profileId.trim().toLowerCase()
  if (!LOCAL_PROFILE_PHOTOS.has(stem)) return { profileId, file: null, confidence: 'none' }
  const confidence = stem === 'pa1296' ? 'medium' : 'high'
  return { profileId, file: `${stem}.jpg`, confidence }
}

export function hasDrawnProfileSection(profileId: string): boolean {
  return DRAWN_SECTION_PROFILE_IDS.has(profileId.trim().toLowerCase())
}

export interface CutMapLabels {
  title: string
  rest: string
  wall: string
  stock: string
  bars: string
  weight: string
  weightMissing: string
  noImage: string
  noData: string
  /** PA1296 uses the shared 40×60 drawing. */
  sharedDrawing: string
  kerf: string
  schematic: string
  howTitle: string
  howAngle: string
  howBeam: string
  howPart: string
  howColor: string
  lamellas: string
  beamMark: (n: number) => string
  weightIncomplete?: (profileId: string) => string
}

function beamNumber(pieceId: string): number | null {
  const match = /^beam-(\d+)/.exec(pieceId)
  return match ? Number(match[1]) + 1 : null
}

function pieceCaption(pieceId: string, role: string, pieceIds: readonly string[], beamMark: (n: number) => string): string {
  const part = beamSegmentPart(pieceId, role, pieceIds)
  const index = beamNumber(pieceId)
  if (part && index != null) return `${part.part}/${part.total} · ${beamMark(index)}`
  if (role === 'beam' && index != null) return beamMark(index)
  return ''
}

function pieceFill(role: string, lengthMm: number, beamIndex: number | null): string {
  if (role === 'lamella') return lengthMm > 1500 ? '#86efac' : '#93c5fd'
  if (role === 'purlin') return '#fdba74'
  if (role === 'post') return '#e7e5e4'
  const ambers = ['#f6d7a8', '#f3c98b', '#e8b86d', '#f8e0b0', '#efd3a6', '#e7cba0']
  return ambers[(beamIndex ?? 0) % ambers.length]
}

function bdi(text: string): string {
  return text.replace(/(\d[\d.,/×x°]*)/g, '<bdi dir="ltr">$1</bdi>')
}

function schematicSection(widthMm: number, heightMm: number, wallMm: number | undefined, caption: string): string {
  // Landscape box: wider side = larger section dim (usually heightMm for DT beams).
  const tall = Math.max(widthMm, heightMm)
  const wide = Math.min(widthMm, heightMm)
  const outerW = 86
  const outerH = 58
  const wall = wallMm != null && wallMm > 0 ? Math.max(3, Math.min(10, wallMm * 2)) : 4
  const hLabel = Number.isFinite(tall) && tall > 0 ? String(Math.round(tall)) : ''
  const wLabel = Number.isFinite(wide) && wide > 0 ? String(Math.round(wide)) : ''
  const captionText = caption
    ? `<text x="60" y="82" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#44403c">${caption}</text>`
    : ''
  return `<svg class="schematic" viewBox="0 0 120 92" role="img" aria-label="${caption || `${hLabel}×${wLabel}`}">
    <rect x="16" y="4" width="${outerW}" height="${outerH}" fill="#fafaf9" stroke="#111827" stroke-width="${wall}"/>
    <rect x="${16 + wall}" y="${4 + wall}" width="${outerW - wall * 2}" height="${outerH - wall * 2}" fill="#ffffff" stroke="#111827" stroke-width="1"/>
    ${hLabel ? `<text x="60" y="16" text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="700" fill="#111827">${hLabel}</text>` : ''}
    ${wLabel ? `<text x="108" y="36" text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="700" fill="#111827">${wLabel}</text>` : ''}
    ${captionText}
  </svg>`
}

/**
 * WT R242 double-T as installed on the plan.
 * Catalog / construction: widthMm = plan width (70), heightMm = section height (142).
 * `planWidthMm` override is also 70 (`override-70` in beamPlanWidth). Gallery
 * r242.jpg is 142×100 — wrong; do not use it.
 */
function doubleTSectionDrawing(widthMm: number, heightMm: number): string {
  const planW = String(Math.round(widthMm))
  const sectH = String(Math.round(heightMm))
  // Flanges top & bottom, web vertical: horizontal = plan width 70, vertical = 142.
  return `<svg class="schematic" viewBox="0 0 120 100" role="img" aria-label="WT R242 plan ${planW} × height ${sectH}">
    <g fill="#fafaf9" stroke="#111827" stroke-width="1.6" stroke-linejoin="miter">
      <path d="M34 4 H86 V16 H64 V72 H86 V84 H34 V72 H56 V16 H34 Z"/>
    </g>
    <text x="60" y="96" text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="700" fill="#111827">${planW}</text>
    <text x="108" y="48" text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="700" fill="#111827">${sectH}</text>
  </svg>`
}

function profileSectionPicture(
  profileId: string,
  widthMm: number,
  heightMm: number,
  wallMm: number | undefined,
  photoSrc: string | null,
  labels: Pick<CutMapLabels, 'schematic' | 'noImage'>,
): string {
  if (photoSrc) {
    return `<img src="${photoSrc}" alt="${esc(profileId)}" width="120" height="80"/>`
  }
  const stem = profileId.trim().toLowerCase()
  if (hasDrawnProfileSection(stem) && widthMm > 0 && heightMm > 0) {
    return doubleTSectionDrawing(widthMm, heightMm)
  }
  const hasDims = widthMm > 0 && heightMm > 0
  if (hasDims) return schematicSection(widthMm, heightMm, wallMm, labels.schematic)
  return `<div class="missing-photo"><p class="no-photo">${labels.noImage}</p>${schematicSection(Math.max(widthMm, 40), Math.max(heightMm, 20), wallMm, labels.schematic)}</div>`
}

interface DrawnPiece {
  lengthMm: number
  startDeg: number
  endDeg: number
  handStart: string
  handEnd: string
  caption: string
  fill: string
}

interface DrawnBar {
  count: number
  stockMm: number
  wasteMm: number
  pieces: DrawnPiece[]
}

function barSignature(bar: DrawnBar): string {
  const pieces = bar.pieces.map((piece) => `${piece.lengthMm}|${piece.startDeg}|${piece.endDeg}|${piece.caption}|${piece.fill}`).join('+')
  return `${bar.stockMm}|${Math.round(bar.wasteMm)}|${pieces}`
}

function groupBars(bars: DrawnBar[]): DrawnBar[] {
  const grouped: DrawnBar[] = []
  const index = new Map<string, number>()
  for (const bar of bars) {
    const key = barSignature(bar)
    const found = index.get(key)
    if (found == null) {
      index.set(key, grouped.length)
      grouped.push({ ...bar, count: 1, pieces: bar.pieces })
    } else {
      grouped[found].count += 1
    }
  }
  return grouped
}

function toDrawnBar(bar: StockBar, pieceIds: readonly string[], beamMark: (n: number) => string): DrawnBar {
  return {
    count: 1,
    stockMm: bar.stockLengthMm,
    wasteMm: bar.wasteMm,
    pieces: bar.pieces.map((piece) => {
      const index = beamNumber(piece.pieceId)
      return {
        lengthMm: Math.floor(piece.lengthLongMm + 0.005),
        startDeg: displayCutDeg(piece.cutMiterStartDeg),
        endDeg: displayCutDeg(piece.cutMiterEndDeg),
        handStart: piece.cutHandStart,
        handEnd: piece.cutHandEnd,
        caption: pieceCaption(piece.pieceId, piece.role, pieceIds, beamMark),
        fill: pieceFill(piece.role, piece.lengthLongMm, index),
      }
    }),
  }
}

function slant(deg: number, height: number): number {
  if (!(deg > 0) || Math.abs(deg - 90) < 0.05) return 0
  return Math.min(height * 0.9, Math.tan((deg * Math.PI) / 180) * height)
}

function piecePoints(x: number, width: number, y: number, h: number, piece: DrawnPiece): string {
  const start = slant(piece.startDeg, h)
  const end = slant(piece.endDeg, h)
  let x0t = x
  let x0b = x
  if (piece.handStart === 'R') x0t = x + start
  else if (start > 0) x0b = x + start
  const right = x + width
  let x1t = right
  let x1b = right
  if (piece.handEnd === 'L') x1b = right - end
  else if (piece.handEnd === 'R') x1t = right - end
  else if (end > 0) x1b = right - end
  return `${x0t},${y} ${x1t},${y} ${x1b},${y + h} ${x0b},${y + h}`
}

function barSvg(bar: DrawnBar, labels: CutMapLabels, kerfMm: number): string {
  const scale = 0.1
  const pad = 78
  const width = bar.stockMm * scale + pad * 2
  const barY = 28
  const barH = 32
  // Three under-bar bands: captions, then angles, then остаток — 45° on the
  // last piece must not cover "остаток NNN" (pa1162 Б4, R242 3/3 · Б1).
  // Short length callouts stay ABOVE the bar so they never meet "остаток"
  // (f7020 475 vs остаток 347/350).
  const captionY = barY + barH + 16
  const angleBelowY = barY + barH + 34
  const restY = barY + barH + 52
  const height = 168
  let x = pad
  const pieces = bar.pieces.map((piece) => {
    const pieceW = piece.lengthMm * scale
    const drawn = { piece, x, pieceW }
    x += pieceW + kerfMm * scale
    return drawn
  })
  const wasteX = x
  const wasteW = Math.max(0, bar.wasteMm * scale)
  let dropped = 0
  const polygons = pieces.map(({ piece, x: px, pieceW }, pieceIndex) => {
    const mid = px + pieceW / 2
    const text = String(piece.lengthMm)
    const textW = Math.max(22, text.length * 12)
    const isLast = pieceIndex === pieces.length - 1
    // Short last piece before waste: always call out above+left (f7020 475 / остаток).
    const below = piece.lengthMm < 40 || textW > pieceW * 0.72 || (isLast && wasteW > 1 && pieceW < 60)
    // Length above when it fits; angles on the opposite band from length.
    // Last piece + waste: end 45° stays ABOVE so it never sits on "остаток".
    const endAngleY = below || (isLast && wasteW > 1) ? 18 : angleBelowY
    const startAngleY = below ? 18 : angleBelowY
    const startLabel = piece.startDeg !== 90
      ? `<text x="${px + 1}" y="${startAngleY}" text-anchor="start" font-size="15" font-family="sans-serif" font-weight="700" fill="#b91c1c">${formatCutDeg(piece.startDeg)}°</text>`
      : ''
    const endLabel = piece.endDeg !== 90
      ? `<text x="${px + pieceW - 1}" y="${endAngleY}" text-anchor="end" font-size="15" font-family="sans-serif" font-weight="700" fill="#b91c1c">${formatCutDeg(piece.endDeg)}°</text>`
      : ''
    const lengthText = below
      ? ''
      : `<text x="${mid}" y="16" text-anchor="middle" font-size="18" font-family="sans-serif" font-weight="700" fill="#111827">${text}</text>`
    const leader = below
      ? (() => {
          const row = dropped++
          // Above the bar — never on the остаток / caption band.
          const ly = 14 + (row % 3) * 12
          // Last short piece before waste: pull left so "475" does not sit on "остаток".
          const nearWaste = isLast && wasteW > 1
          const lx = nearWaste ? mid - Math.max(18, pieceW * 0.35) : mid + (row % 2 === 0 ? -10 : 10)
          return `<line x1="${mid}" y1="${barY}" x2="${lx}" y2="${ly + 2}" stroke="#111827" stroke-width="0.8"/>
            <text x="${lx}" y="${ly}" text-anchor="middle" font-size="16" font-family="sans-serif" font-weight="700" fill="#111827">${text}</text>`
        })()
      : ''
    const caption = piece.caption
      ? `<text x="${mid}" y="${captionY}" text-anchor="middle" font-size="15" font-family="sans-serif" fill="#44403c">${piece.caption}</text>`
      : ''
    return `<polygon points="${piecePoints(px, pieceW, barY, barH, piece)}" fill="${piece.fill}" stroke="#44403c" stroke-width="1"/>
      ${lengthText}${startLabel}${endLabel}${caption}${leader}`
  }).join('')
  const rest = `${labels.rest} ${Math.floor(bar.wasteMm + 0.005)}`
  // Narrow waste: right-align "остаток N" at the stock end so it does not cover a short last piece (f7020 475).
  const restNarrow = wasteW > 1 && wasteW < Math.max(70, rest.length * 9)
  const restX = restNarrow ? wasteX + wasteW : wasteX + Math.max(wasteW, 12) / 2
  const restAnchor = restNarrow ? 'end' : 'middle'
  const waste = wasteW > 1
    ? `<rect x="${wasteX}" y="${barY}" width="${wasteW}" height="${barH}" fill="none" stroke="#9ca3af" stroke-width="1.2" stroke-dasharray="4 3"/>
       <text x="${restX}" y="${restY}" text-anchor="${restAnchor}" font-size="15" font-family="sans-serif" fill="#57534e">${rest}</text>`
    : ''
  // 32mm keeps six structural rows + profile head inside one A4 port page
  // (38mm overflowed and Chrome split the last bar onto a headless page).
  return `<svg class="bar" viewBox="0 0 ${width.toFixed(1)} ${height}" width="${(bar.stockMm * 0.022).toFixed(1)}mm" height="32mm" role="img">${polygons}${waste}</svg>`
}

function profileHead(
  bundle: ProfileBundlePlan,
  labels: CutMapLabels,
  photoSrc: string | null,
  wallMm: number | undefined,
  weightKg: number | null,
  stockMm: number,
  barCount: number,
  kerfMm: number,
): string {
  const width = bundle.profileWidthMm ?? 0
  const height = bundle.profileHeightMm ?? 0
  const gauge = width > 0 && height > 0 ? `${Math.max(width, height)}×${Math.min(width, height)}` : ''
  const stem = bundle.profileId.trim().toLowerCase()
  const picture = profileSectionPicture(bundle.profileId, width, height, wallMm, photoSrc, labels)
  const weightBit = weightKg == null
    ? labels.weightMissing
    : `${labels.weight} <bdi dir="ltr">${weightKg.toFixed(1)}</bdi>`
  const bits = [
    gauge ? `<bdi dir="ltr">${gauge}</bdi>` : '',
    wallMm != null ? `${labels.wall} <bdi dir="ltr">${wallMm}</bdi>` : '',
    `${labels.stock} <bdi dir="ltr">${(stockMm / 1000).toFixed(1)}</bdi>`,
    `${labels.bars} <bdi dir="ltr">${barCount}</bdi>`,
    weightBit,
    `${labels.kerf} <bdi dir="ltr">${kerfMm}</bdi>`,
  ].filter(Boolean)
  const lamella = bundle.profileId === 'f7020' ? ` · ${labels.lamellas}` : ''
  const drawing = stem === 'pa1296' ? `<p>${labels.sharedDrawing}</p>` : ''
  return `<header class="profile-head">${picture}<div><strong class="ltr">${bundle.profileId}${lamella}</strong>${drawing}<p>${bits.join(' · ')}</p></div></header>`
}

function profilesMissingWeight(
  plans: ProfileBundlePlan[],
  chosen: ReadonlyMap<string, number>,
): string[] {
  const ids: string[] = []
  for (const bundle of plans) {
    const stock = chosenStockLengthMm(bundle, chosen)
    const plan = stock == null ? null : bundle.options.find((option) => option.stockLengthMm === stock)?.plan ?? null
    if (plan == null || plan.totalBars <= 0 || bundle.weightKgPerMeter != null) continue
    if (!ids.includes(bundle.profileId)) ids.push(bundle.profileId)
  }
  return ids
}

function weightWarningHtml(ids: string[], format?: (profileId: string) => string): string {
  if (!format || ids.length === 0) return ''
  return `<p class="weight-warn">${ids.map((id) => esc(format(id))).join('<br>')}</p>`
}

function legend(labels: CutMapLabels): string {
  return `<footer class="legend"><p><strong>${labels.howTitle}</strong></p><p>${bdi(labels.howAngle)}</p><p>${bdi(labels.howBeam)}</p><p>${bdi(labels.howPart)}</p><p>${bdi(labels.howColor)}</p></footer>`
}

/** Split rows so the last page is never a single orphan when avoidable. */
function chunkAvoidOrphan<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return []
  if (size < 2 || items.length <= size) return [items.slice()]
  const chunks: T[][] = []
  let i = 0
  while (i < items.length) {
    let n = Math.min(size, items.length - i)
    if (items.length - i - n === 1 && n === size) n = size - 1
    chunks.push(items.slice(i, i + n))
    i += n
  }
  return chunks
}

export function renderCuttingPages(input: {
  plans: ProfileBundlePlan[]
  profiles: Map<string, ProfileDimensions>
  labels: CutMapLabels
  rtl: boolean
  kerfMm?: number
  photoSrc?: (file: string) => string
  chosenLengths?: ReadonlyMap<string, number>
}): { html: string; photos: ProfilePhotoMatch[] } {
  const kerfMm = input.kerfMm ?? DEFAULT_KERF_MM
  const dir = input.rtl ? 'rtl' : 'ltr'
  const photos: ProfilePhotoMatch[] = []
  const pages: string[] = []
  const rowsPerPage = 6

  const chosen = input.chosenLengths ?? new Map<string, number>()
  const missingWeight = profilesMissingWeight(input.plans, chosen)
  let warned = false
  const profilesInOrder = input.plans.filter((bundle) => {
    const stock = chosenStockLengthMm(bundle, chosen)
    return stock != null && bundle.options.some((option) => option.stockLengthMm === stock && option.plan)
  })

  profilesInOrder.forEach((bundle, profileIndex) => {
    const stock = chosenStockLengthMm(bundle, chosen) ?? 0
    const plan = bundle.options.find((option) => option.stockLengthMm === stock)?.plan
    if (!plan) return
    const photo = profilePhotoMatch(bundle.profileId)
    photos.push(photo)
    const src = photo.file && input.photoSrc ? input.photoSrc(photo.file) : null
    const profile = input.profiles.get(bundle.profileId)
    const weight = profile?.weightKgPerMeter != null && plan.totalBars > 0
      ? (plan.totalBars * stock / 1000) * profile.weightKgPerMeter
      : null
    const pieceIds = plan.bars.flatMap((bar) => bar.pieces.map((piece) => piece.pieceId))
    const bars = groupBars(plan.bars.map((bar) => toDrawnBar(bar, pieceIds, input.labels.beamMark)))
    const head = profileHead(bundle, input.labels, src, profile?.wallThicknessMm, weight, stock, plan.totalBars, kerfMm)
    const lamellaPage = plan.bars.every((bar) => bar.pieces.length > 0 && bar.pieces.every((piece) => piece.role === 'lamella'))
    const pageRows = lamellaPage ? 11 : rowsPerPage
    const chunks = chunkAvoidOrphan(bars, pageRows)
    chunks.forEach((chunk, chunkIndex) => {
      const last = profileIndex === profilesInOrder.length - 1 && chunkIndex === chunks.length - 1
      const title = chunkIndex === 0 && profileIndex === 0
        ? input.labels.title
        : `${input.labels.title} · ${bundle.profileId}`
      const banner = warned ? '' : weightWarningHtml(missingWeight, input.labels.weightIncomplete)
      warned = true
      const body = chunk.map((bar) => `<div class="bar-row"><div class="times">×${bar.count}</div>${barSvg(bar, input.labels, kerfMm)}</div>`).join('')
      const dense = lamellaPage ? ' lamella-dense' : ''
      // Every continuation repeats the profile head (icon + id + params).
      pages.push(`<section class="port cut-page${dense}" data-pdf-page="" data-pdf-orient="port" data-pdf-kind="html" dir="${dir}"><h1>${title}</h1>${banner}${head}${body}${last ? legend(input.labels) : ''}</section>`)
    })
  })

  return { html: pages.join(''), photos }
}

export interface OrderPageLabels {
  title: string
  wall: string
  stock: string
  bars: string
  meters: string
  weight: string
  weightMissing: string
  profile: string
  total: string
  /** Red banner when a profile has bars but no kg/m. */
  weightIncomplete?: (profileId: string) => string
  /** Suffix on the weight total, e.g. ללא <profile id>. */
  weightExcluding?: (profileIds: string) => string
  noImage: string
  noData: string
  schematic: string
  sharedDrawing: string
  kerfNote: string
}

export interface SummaryPageLabels {
  title: string
  profile: string
  bars: string
  meters: string
  weight: string
  weightMissing: string
  total: string
  kerfNote: string
  weightIncomplete?: (profileId: string) => string
  weightExcluding?: (profileIds: string) => string
}

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] ?? ch))
}

function orderCard(
  bundle: ProfileBundlePlan,
  labels: OrderPageLabels,
  stock: number,
  bars: number,
  wallMm: number | undefined,
  weightKgPerMeter: number | undefined,
  src: string | null,
): string {
  const width = bundle.profileWidthMm ?? 0
  const height = bundle.profileHeightMm ?? 0
  const gauge = width > 0 && height > 0 ? `${Math.max(width, height)}×${Math.min(width, height)}` : ''
  const stem = bundle.profileId.trim().toLowerCase()
  const picture = profileSectionPicture(bundle.profileId, width, height, wallMm, src, labels).replace(
    'width="120" height="80"',
    'width="160" height="110"',
  )
  const meters = (bars * stock) / 1000
  const weight = weightKgPerMeter != null
    ? `${labels.weight} <bdi dir="ltr">${(meters * weightKgPerMeter).toFixed(1)}</bdi>`
    : labels.weightMissing
  const drawing = stem === 'pa1296' ? `<p>${labels.sharedDrawing}</p>` : ''
  const bits = [
    gauge ? `<bdi dir="ltr">${gauge}</bdi>` : '',
    wallMm != null ? `${labels.wall} <bdi dir="ltr">${wallMm}</bdi>` : '',
    `${labels.stock} <bdi dir="ltr">${(stock / 1000).toFixed(1)}</bdi>`,
    `${labels.bars} <bdi dir="ltr">${bars}</bdi>`,
    `${labels.meters} <bdi dir="ltr">${meters.toFixed(1)}</bdi>`,
    weight,
  ].filter(Boolean)
  return `<article class="order-card profile-head">${picture}<div><strong class="ltr">${esc(bundle.profileId)}</strong>${drawing}<p>${bits.join(' · ')}</p></div></article>`
}

/** Order PDF: one card per profile. A missing photo is a caption plus a drawn section, never a color swatch. */
export function renderOrderPages(input: {
  plans: ProfileBundlePlan[]
  profiles: Map<string, ProfileDimensions>
  labels: OrderPageLabels
  rtl: boolean
  chosenLengths?: ReadonlyMap<string, number>
  photoSrc?: (file: string) => string
}): { html: string; photos: ProfilePhotoMatch[] } {
  const chosen = input.chosenLengths ?? new Map<string, number>()
  const dir = input.rtl ? 'rtl' : 'ltr'
  const photos: ProfilePhotoMatch[] = []
  const cards: string[] = []
  for (const bundle of input.plans) {
    const stock = chosenStockLengthMm(bundle, chosen)
    const plan = stock == null ? null : bundle.options.find((option) => option.stockLengthMm === stock)?.plan ?? null
    if (stock == null || !plan) continue
    const photo = profilePhotoMatch(bundle.profileId)
    photos.push(photo)
    const src = photo.file && input.photoSrc ? input.photoSrc(photo.file) : null
    const profile = input.profiles.get(bundle.profileId)
    cards.push(orderCard(
      bundle,
      input.labels,
      stock,
      plan.totalBars,
      profile?.wallThicknessMm,
      profile?.weightKgPerMeter,
      src,
    ))
  }
  const pages: string[] = []
  const perPage = 4
  const missingWeight = profilesMissingWeight(input.plans, chosen)
  for (let i = 0; i < cards.length; i += perPage) {
    const note = i === 0 ? `<p class="note">${input.labels.kerfNote}</p>` : ''
    const banner = i === 0 ? weightWarningHtml(missingWeight, input.labels.weightIncomplete) : ''
    const body = cards.slice(i, i + perPage).join('')
    pages.push(`<section class="port order-page" data-pdf-page="" data-pdf-orient="port" data-pdf-kind="html" dir="${dir}"><h1>${input.labels.title}</h1>${banner}${note}${body}</section>`)
  }
  const totals = renderTotalsTable(input.plans, input.chosenLengths ?? new Map(), {
    profile: input.labels.profile,
    bars: input.labels.bars,
    meters: input.labels.meters,
    weight: input.labels.weight,
    weightMissing: input.labels.weightMissing,
    total: input.labels.total,
    weightIncomplete: input.labels.weightIncomplete,
    weightExcluding: input.labels.weightExcluding,
  })
  if (cards.length > 0) {
    pages.push(`<section class="port order-page" data-pdf-page="" data-pdf-orient="port" data-pdf-kind="html" dir="${dir}"><h1>${input.labels.title}</h1>${totals}</section>`)
  }
  return { html: pages.join(''), photos }
}

function renderTotalsTable(
  plans: ProfileBundlePlan[],
  chosenLengths: ReadonlyMap<string, number>,
  labels: Pick<SummaryPageLabels, 'profile' | 'bars' | 'meters' | 'weight' | 'weightMissing' | 'total' | 'weightIncomplete' | 'weightExcluding'>,
): string {
  const totals = buildOrderSheetTotals(plans, chosenLengths)
  const rows = totals.map((row) => {
    const weight = row.totalWeightKg == null ? labels.weightMissing : row.totalWeightKg.toFixed(1)
    return `<tr><td><bdi dir="ltr">${esc(row.profileId)}</bdi></td><td class="num"><bdi dir="ltr">${row.totalBars}</bdi></td><td class="num"><bdi dir="ltr">${row.totalMeters.toFixed(1)}</bdi></td><td class="num">${row.totalWeightKg == null ? esc(weight) : `<bdi dir="ltr">${weight}</bdi>`}</td></tr>`
  }).join('')
  const bars = totals.reduce((sum, row) => sum + row.totalBars, 0)
  const meters = totals.reduce((sum, row) => sum + row.totalMeters, 0)
  const known = totals.filter((row) => row.totalWeightKg != null)
  const missing = totals.filter((row) => row.totalWeightKg == null && row.totalBars > 0).map((row) => row.profileId)
  const weight = known.length === 0
    ? labels.weightMissing
    : known.reduce((sum, row) => sum + Number((row.totalWeightKg ?? 0).toFixed(1)), 0).toFixed(1)
  const exclude = missing.length > 0 && labels.weightExcluding
    ? ` <span class="exclude">${esc(labels.weightExcluding(missing.join(', ')))}</span>`
    : ''
  const totalWeight = known.length === 0 ? esc(weight) : `<bdi dir="ltr">${weight}</bdi>`
  const banner = weightWarningHtml(missing, labels.weightIncomplete)
  return `${banner}<table class="totals"><thead><tr><th>${esc(labels.profile)}</th><th class="num">${esc(labels.bars)}</th><th class="num">${esc(labels.meters)}</th><th class="num">${esc(labels.weight)}</th></tr></thead><tbody>${rows}<tr class="total"><td>${esc(labels.total)}</td><td class="num"><bdi dir="ltr">${bars}</bdi></td><td class="num"><bdi dir="ltr">${meters.toFixed(1)}</bdi></td><td class="num">${totalWeight}${exclude}</td></tr></tbody></table>`
}

/** Last page of the production PDF: profile, bars, metres, weight. No color chip. */
export function renderProductionSummary(input: {
  plans: ProfileBundlePlan[]
  labels: SummaryPageLabels
  rtl: boolean
  chosenLengths?: ReadonlyMap<string, number>
}): string {
  const table = renderTotalsTable(input.plans, input.chosenLengths ?? new Map(), input.labels)
  return `<h1>${input.labels.title}</h1><p class="note">${input.labels.kerfNote}</p>${table}`
}
