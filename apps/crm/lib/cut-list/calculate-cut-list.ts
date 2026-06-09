import fs from 'fs'
import path from 'path'
import type { Offer } from '@/types/offer'
import { hangerPipeLengthCm } from '@pashkovsky/pergola-configurator'
import { chooseStockLength, STOCK_LENGTHS_CM, type ProfileCategory } from './stock-lengths'
import { calculateSuntufSheets } from '@/lib/calculations/suntuf-sheets'

interface ProfileEntry {
  id: string
  name: { he?: string; en?: string; ru?: string }
  dimensions?: string
}

function loadProfilesMap(): Map<string, ProfileEntry> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'profiles.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw) as { profiles: ProfileEntry[] }
    return new Map(json.profiles.map((p) => [p.id, p]))
  } catch {
    return new Map()
  }
}

function profileLabel(profileId: string | null | undefined, fallback: string): string {
  if (!profileId) return fallback
  const map = loadProfilesMap()
  const entry = map.get(profileId)
  if (!entry) return fallback
  const name = entry.name.he ?? entry.name.en ?? profileId
  const dims = entry.dimensions ? ` (${entry.dimensions})` : ''
  return `${name}${dims}`
}

/**
 * Parse a dimensions string like "70x20mm" → { a: 7, b: 2 } (in cm).
 * Returns null if unparseable.
 */
function parseDimsCm(dimensions: string | undefined): { a: number; b: number } | null {
  if (!dimensions) return null
  const match = dimensions.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)mm$/i)
  if (!match) return null
  return { a: Number(match[1]) / 10, b: Number(match[2]) / 10 }
}

function profileDimsCm(profileId: string | null | undefined): { a: number; b: number } | null {
  if (!profileId) return null
  const map = loadProfilesMap()
  const entry = map.get(profileId)
  if (!entry) return null
  return parseDimsCm(entry.dimensions)
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CutPiece {
  label: string
  lengthCm: number
  qty: number
}

export interface StockBar {
  stockLengthCm: number
  cuts: CutPiece[]
  usedCm: number
  wasteCm: number
}

export interface ProfileGroup {
  category: ProfileCategory
  profileId: string | null
  profileName: string
  stockLengthCm: number
  pieces: CutPiece[]
  bars: StockBar[]
  totalBars: number
  totalUsedCm: number
  totalWasteCm: number
  wastePercent: number
}

/** Santaf BH order line — one entry per required length */
export interface SantafOrderLine {
  lengthCm: number   // e.g. 100, 125, 150 …
  qty: number        // number of pieces of this length needed
}

export interface CutListResult {
  customerName: string
  widthCm: number
  depthCm: number
  heightCm: number
  groups: ProfileGroup[]
  /** Santaf BH order lines (empty if santaf not enabled on the offer) */
  santafLines: SantafOrderLine[]
  /** Lamella gap used in count calculation (cm) */
  lamellaGapCm: number
  /** Lamella count calculated */
  lamellaQty: number
  generatedAt: string
  /** True when configuratorMeta.params is missing — result is estimated from shape only */
  estimated: boolean
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Saw kerf lost per cut (cm) */
export const KERF_CM = 0.5

/**
 * Expand pieces into individual segment cuts.
 * If a piece is longer than stockLengthCm, split it into full-bar segments
 * plus a remainder, labelling each segment with a "(חלק N/M)" suffix.
 * Each segment boundary costs KERF_CM of material.
 */
function expandToSegments(pieces: CutPiece[], stockLengthCm: number): CutPiece[] {
  // Usable length per bar after reserving kerf for the first cut at bar start
  // We account for kerf inside packIntoBars instead — here just split by net length.
  const result: CutPiece[] = []
  for (const p of pieces) {
    for (let i = 0; i < p.qty; i++) {
      if (p.lengthCm <= stockLengthCm) {
        result.push({ label: p.label, lengthCm: p.lengthCm, qty: 1 })
      } else {
        // Split into full-bar segments + remainder.
        // Each segment except the last needs a kerf cut at its end.
        const usablePerBar = stockLengthCm - KERF_CM
        const totalSegments = Math.ceil(p.lengthCm / usablePerBar)
        let remaining = p.lengthCm
        for (let s = 1; s <= totalSegments; s++) {
          const segLen = Math.min(remaining, usablePerBar)
          result.push({
            label: `${p.label} (חלק ${s}/${totalSegments})`,
            lengthCm: segLen,
            qty: 1,
          })
          remaining -= segLen
        }
      }
    }
  }
  return result
}

/**
 * First-fit bin-packing: pack cut segments into stock bars of `stockLengthCm`.
 * Each cut consumes its length + KERF_CM (saw kerf), except the very last cut
 * on a bar where no trailing kerf is needed.
 * We conservatively add kerf to every cut for simplicity (slight overestimate
 * of 0.5 cm per bar, which is acceptable).
 */
function packIntoBars(pieces: CutPiece[], stockLengthCm: number): StockBar[] {
  const cuts = expandToSegments(pieces, stockLengthCm)

  const bars: StockBar[] = []
  let current: StockBar | null = null

  for (const cut of cuts) {
    // Each cut occupies its length + one kerf (cut line after it)
    const slotNeeded = cut.lengthCm + KERF_CM
    if (current === null || current.usedCm + slotNeeded > stockLengthCm) {
      current = { stockLengthCm, cuts: [], usedCm: 0, wasteCm: stockLengthCm }
      bars.push(current)
    }
    current.cuts.push(cut)
    current.usedCm += slotNeeded
    current.wasteCm = stockLengthCm - current.usedCm
  }

  return bars
}

function buildGroup(
  category: ProfileCategory,
  profileId: string | null,
  profileName: string,
  pieces: CutPiece[],
): ProfileGroup | null {
  if (pieces.length === 0) return null

  // Pick the shortest stock that fits the longest piece.
  // If no single stock fits (piece > max stock), use the longest available stock
  // and the piece will be split into segments in packIntoBars.
  const maxCut = Math.max(...pieces.map((p) => p.lengthCm))
  const stockOptions = [...STOCK_LENGTHS_CM[category]].sort((a, b) => a - b)
  const stockLengthCm = chooseStockLength(category, maxCut) ?? stockOptions[stockOptions.length - 1]

  const bars = packIntoBars(pieces, stockLengthCm)
  const totalBars = bars.length
  const totalUsedCm = bars.reduce((s, b) => s + b.usedCm, 0)
  const totalWasteCm = bars.reduce((s, b) => s + b.wasteCm, 0)
  const totalStockCm = totalBars * stockLengthCm
  const wastePercent = totalStockCm > 0 ? (totalWasteCm / totalStockCm) * 100 : 0

  return {
    category,
    profileId,
    profileName,
    stockLengthCm,
    pieces,
    bars,
    totalBars,
    totalUsedCm,
    totalWasteCm,
    wastePercent,
  }
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

export function calculateCutList(offer: Offer): CutListResult {
  const cfg = offer.configuratorMeta?.params
  const shape = (offer.pergolas?.[0] ?? offer.pergola)?.shape
  const isRect = shape?.type === 'rectangle'

  // Dimensions — prefer configurator params, fall back to shape
  const widthCm = cfg?.widthCm ?? (isRect && shape?.type === 'rectangle' ? shape.width * 100 : 0)
  const depthCm = cfg?.depthCm ?? (isRect && shape?.type === 'rectangle' ? shape.length * 100 : 0)
  const heightCm = cfg?.heightCm ?? 260
  const attachedToWall = cfg?.attachedToWall ?? false
  const hangingPergola = cfg?.hangingPergola ?? false
  const hangerCount = Math.min(8, Math.max(1, Math.round(cfg?.hangerCount ?? 2)))
  const lamellaAlongWidth = cfg?.lamellaAlongWidth ?? false
  const lamellaGapCm = cfg?.lamellaGapCm ?? 2
  const lamellaStanding = cfg?.lamellaStanding ?? false
  const estimated = !cfg

  // Profile names resolved from profiles.json
  const postName = profileLabel(cfg?.postProfileId, 'עמוד (פרופיל לא נבחר)')
  const beamName = profileLabel(cfg?.beamProfileId, 'קורה (פרופיל לא נבחר)')
  const dividerName = profileLabel(cfg?.dividerProfileId ?? cfg?.beamProfileId, 'חוצץ פנימי (כמו קורה)')
  const lamellaName = profileLabel(cfg?.lamellaProfileId, 'הצללה (פרופיל לא נבחר)')

  // ── Posts ──────────────────────────────────────────────────────────────────
  // Corner posts: 4 if free-standing, 2 if attached to wall (front only)
  const cornerPostQty = hangingPergola ? 0 : attachedToWall ? 2 : 4

  // Intermediate posts along outer beams — max 400 cm span, split equally
  const POST_MAX_SPAN = 400
  function intermediatePostCount(spanCm: number): number {
    if (spanCm <= POST_MAX_SPAN) return 0
    return Math.ceil(spanCm / POST_MAX_SPAN) - 1
  }
  // Width beams: front beam always has posts, back beam only if free-standing
  const widthBeamCount = hangingPergola ? 0 : attachedToWall ? 1 : 2
  const widthIntermediatePosts = intermediatePostCount(widthCm) * widthBeamCount
  const depthBeamCount = hangingPergola ? 0 : attachedToWall ? 0 : 2
  const depthIntermediatePosts = intermediatePostCount(depthCm) * depthBeamCount
  const totalPostQty = cornerPostQty + widthIntermediatePosts + depthIntermediatePosts

  const postPieces: CutPiece[] = totalPostQty > 0
    ? [{ label: 'עמוד', lengthCm: heightCm, qty: totalPostQty }]
    : []

  const hangerPieces: CutPiece[] =
    hangingPergola && depthCm > 0
      ? [
          {
            label: 'צינור מתלה (תלוייה)',
            lengthCm: hangerPipeLengthCm(depthCm),
            qty: hangerCount,
          },
        ]
      : []

  // ── Frame beams ────────────────────────────────────────────────────────────
  // 2 width beams (front + back) + 2 depth beams (sides)
  // Intermediate cross-beams: ceil(widthCm/140) - 1 beams, each = depthCm
  const BEAM_MAX_SPAN = 140
  const beamSegments = widthCm > BEAM_MAX_SPAN ? Math.ceil(widthCm / BEAM_MAX_SPAN) : 1
  const intermediateBeamQty = beamSegments - 1

  const beamPieces: CutPiece[] = []
  if (widthCm > 0) beamPieces.push({ label: 'קורת מסגרת רוחב', lengthCm: widthCm, qty: 2 })
  if (depthCm > 0) beamPieces.push({ label: 'קורת מסגרת עומק', lengthCm: depthCm, qty: 2 })

  // ── Divider (חוצץ פנימי) length deduction ──────────────────────────────────
  // The divider sits between the two side depth-beams.
  // The frame beam profile is installed standing (בעמידה), so its horizontal
  // footprint (the thin dimension) protrudes into the span on each side.
  // Divider cut length = depthCm − 2 × beamThinCm
  //
  // Examples:
  //   200x50mm standing  → thin = 5 cm  → deduct 10 cm
  //   דאבל-טי 142        → flange = 7 cm → deduct 14 cm (no parseable dims → use beamProfileId dims)
  //   דאבל-טי מעוצב      → flange = 7 cm → deduct 14 cm
  //
  // If beam dims are not parseable (no "NxNmm" in profiles.json), deduction = 0.
  const beamDims = profileDimsCm(cfg?.beamProfileId)
  // Thin dimension = the smaller of the two (the horizontal/standing thickness)
  const beamThinCm = beamDims ? Math.min(beamDims.a, beamDims.b) : 0
  const dividerDeductionCm = beamThinCm * 2
  const dividerLengthCm = Math.max(0, depthCm - dividerDeductionCm)

  // Intermediate (divider) beams — separate group if a different profile is chosen
  const dividerPieces: CutPiece[] = []
  if (intermediateBeamQty > 0 && depthCm > 0) {
    const dividerTarget = cfg?.dividerProfileId ? dividerPieces : beamPieces
    const deductLabel = dividerDeductionCm > 0 ? ` (עומק ${depthCm} − ${dividerDeductionCm} ס״מ)` : ''
    dividerTarget.push({ label: `חוצץ פנימי${deductLabel}`, lengthCm: dividerLengthCm, qty: intermediateBeamQty })
  }

  // ── Lamellas ───────────────────────────────────────────────────────────────
  // Resolve real profile dims from profiles.json; fall back to 70x20mm defaults
  const lamellaDims = profileDimsCm(cfg?.lamellaProfileId)
  const lamellaWideCm = lamellaDims ? Math.max(lamellaDims.a, lamellaDims.b) : 7
  const lamellaThinCm = lamellaDims ? Math.min(lamellaDims.a, lamellaDims.b) : 2
  // Footprint = the dimension that takes up space along the span axis
  const lamellaFootprintCm = lamellaStanding ? lamellaThinCm : lamellaWideCm

  const lamellaSpanCm = lamellaAlongWidth ? depthCm : widthCm
  const lamellaLengthCm = lamellaAlongWidth ? widthCm : depthCm

  let lamellaQty = 0
  if (lamellaSpanCm > 0 && lamellaFootprintCm > 0) {
    const gap = lamellaGapCm
    const minCount = gap > 0
      ? Math.ceil((lamellaSpanCm - gap) / (lamellaFootprintCm + gap))
      : Math.floor(lamellaSpanCm / lamellaFootprintCm)
    lamellaQty = Math.max(1, minCount)
  }

  const lamellaPieces: CutPiece[] = lamellaQty > 0 && lamellaLengthCm > 0
    ? [{ label: 'למילה', lengthCm: lamellaLengthCm, qty: lamellaQty }]
    : []

  // ── Build groups ───────────────────────────────────────────────────────────
  const groups: ProfileGroup[] = []

  const postGroup = buildGroup('post', cfg?.postProfileId ?? null, postName, [
    ...postPieces,
    ...hangerPieces,
  ])
  if (postGroup) groups.push(postGroup)

  const beamGroup = buildGroup('beam', cfg?.beamProfileId ?? null, beamName, beamPieces)
  if (beamGroup) groups.push(beamGroup)

  if (dividerPieces.length > 0) {
    const dividerGroup = buildGroup('beam', cfg?.dividerProfileId ?? null, dividerName, dividerPieces)
    if (dividerGroup) groups.push(dividerGroup)
  }

  const lamellaGroup = buildGroup('lamella', cfg?.lamellaProfileId ?? null, lamellaName, lamellaPieces)
  if (lamellaGroup) groups.push(lamellaGroup)

  // ── Santaf BH ──────────────────────────────────────────────────────────────
  // Santaf sheets (Profile 76/18 corrugated polycarbonate):
  //   - Physical sheet width: 104.5 cm
  //   - Effective coverage per sheet (double overlap): ~96.9 cm
  //   - Sheet count = ceil(pergolaWidth / effectiveSheetWidth)
  // Sheet length = pergola depth, rounded UP to nearest 25 cm starting from 100 cm.
  const santafLines: SantafOrderLine[] = []
  if (offer.santaf?.enabled && widthCm > 0 && depthCm > 0) {
    const SANTAF_MIN_CM = 100
    const SANTAF_STEP_CM = 25
    const overlapType = offer.santaf.overlapType ?? 'double'
    // widthCm / depthCm are in cm; calculateSuntufSheets expects meters
    const suntufCalc = calculateSuntufSheets(widthCm / 100, depthCm / 100, overlapType)
    const sheetsCount = suntufCalc.sheetsCount
    // Sheet length = depthCm rounded up to nearest santaf available length
    const santafLengthCm = depthCm <= SANTAF_MIN_CM
      ? SANTAF_MIN_CM
      : SANTAF_MIN_CM + Math.ceil((depthCm - SANTAF_MIN_CM) / SANTAF_STEP_CM) * SANTAF_STEP_CM
    santafLines.push({ lengthCm: santafLengthCm, qty: sheetsCount })
  }

  return {
    customerName: offer.customerName,
    widthCm,
    depthCm,
    heightCm,
    groups,
    santafLines,
    lamellaGapCm,
    lamellaQty,
    generatedAt: new Date().toISOString(),
    estimated,
  }
}
