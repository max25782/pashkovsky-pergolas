import type { ProfileDimensions } from './types'
import {
  findPandaAlumBySku,
  pandaAlumPergolaRows,
  parseCatalogNameDims,
  type PandaAlumProfile,
  type PergolaCatalogSlot,
} from './supplier/pandaAlum'

export type LamellaWallThicknessMm = 0.8 | 1.6

export const LAMELLA_70_08_ID = 'f7020'
export const LAMELLA_70_16_ID = 'pa 1121'
/** @deprecated old 1.0 option — kept so saved plans still resolve */
export const LAMELLA_70_10_ID = 'f7020-1'

function fromRow(row: PandaAlumProfile, dims: ProfileDimensions): ProfileDimensions {
  return {
    ...dims,
    availableStockLengthsMm: row.stockLengthsMm.length ? row.stockLengthsMm : dims.availableStockLengthsMm,
    weightKgPerMeter: row.weightKgPerM ?? dims.weightKgPerMeter,
    wallThicknessMm: row.wallThicknessMm ?? dims.wallThicknessMm,
    labelHe: row.nameHe,
    categoryHe: row.categoryHe ?? dims.categoryHe,
    sku: row.sku ?? dims.sku,
  }
}

function fromSupplier(sku: string, dims: ProfileDimensions): ProfileDimensions {
  const row = findPandaAlumBySku(sku)
  return row ? fromRow(row, dims) : { ...dims, sku }
}

function slotFlags(slot: PergolaCatalogSlot): Partial<ProfileDimensions> {
  if (slot === 'lamella') return { maxLamellaSpanMm: 1500 }
  if (slot === 'purlin-led') return { maxSpanMm: 3000, interruptsLamella: true, hasLedChannel: true }
  if (slot === 'purlin') return { maxSpanMm: 3000, interruptsLamella: false }
  return {}
}

function catalogEntries(): Array<[string, ProfileDimensions]> {
  const entries: Array<[string, ProfileDimensions]> = []
  for (const row of pandaAlumPergolaRows()) {
    const parsed = parseCatalogNameDims(row.nameHe, row.slot)
    if (!parsed) continue
    entries.push([row.id, fromRow(row, {
      widthMm: parsed.widthMm,
      heightMm: parsed.heightMm,
      ...slotFlags(row.slot),
      sku: row.id,
    })])
  }
  return entries
}

/**
 * Construction catalog for the 3D / cut-list hosts.
 * Marked panda-alum rows first; legacy ids stay so old saved plans still resolve.
 */
export function buildPergolaConstructionProfiles(): Map<string, ProfileDimensions> {
  const map = new Map<string, ProfileDimensions>(catalogEntries())

  const legacy: Array<[string, ProfileDimensions]> = [
    ['f8080', fromSupplier('F8080', {
      widthMm: 80, heightMm: 80, availableStockLengthsMm: [4000, 6000],
    })],
    ['f6060', fromSupplier('pa 1055', {
      widthMm: 60, heightMm: 60, availableStockLengthsMm: [4000, 6000],
      labelHe: 'עמוד 60/60 פלוס מכסה',
    })],
    ['f10040', fromSupplier('f10040', {
      widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [6000, 7000],
    })],
    ['f12050', {
      widthMm: 50, heightMm: 120, maxSpanMm: 6000, availableStockLengthsMm: [6000, 7000, 8000],
      labelHe: 'מלבן 50/120',
    }],
    ['f2020', fromSupplier('f2020', {
      widthMm: 20, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000],
    })],
    ['f4020', fromSupplier('F4020', {
      widthMm: 40, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000],
    })],
    [LAMELLA_70_08_ID, fromSupplier('f7020', {
      widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000, 6500, 7000],
      wallThicknessMm: 0.8,
    })],
    [LAMELLA_70_16_ID, fromSupplier('pa 1121', {
      widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000, 6500, 7000],
      wallThicknessMm: 1.6,
    })],
    [LAMELLA_70_10_ID, fromSupplier('pa 1121', {
      widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000, 6500, 7000],
      wallThicknessMm: 1.6,
      sku: LAMELLA_70_10_ID,
    })],
    ['purlin-plain-5030', {
      widthMm: 30, heightMm: 50, maxSpanMm: 3000, interruptsLamella: false,
      availableStockLengthsMm: [6000],
      labelHe: 'חוצץ',
    }],
    ['purlin-led-6040', {
      widthMm: 40, heightMm: 60, maxSpanMm: 3000, interruptsLamella: true,
      hasLedChannel: true,
      availableStockLengthsMm: [6000],
      labelHe: 'טי תאורה',
    }],
  ]
  for (const [id, dims] of legacy) {
    const existing = map.get(id)
    if (!existing) {
      map.set(id, dims)
      continue
    }
    map.set(id, {
      ...existing,
      maxSpanMm: existing.maxSpanMm ?? dims.maxSpanMm,
      maxLamellaSpanMm: existing.maxLamellaSpanMm ?? dims.maxLamellaSpanMm,
    })
  }
  return map
}

export const PERGOLA_CONSTRUCTION_PROFILES = buildPergolaConstructionProfiles()

function idsForSlots(slots: PergolaCatalogSlot[]): string[] {
  const ids: string[] = []
  for (const row of pandaAlumPergolaRows()) {
    if (!slots.includes(row.slot)) continue
    if (!PERGOLA_CONSTRUCTION_PROFILES.has(row.id)) continue
    ids.push(row.id)
  }
  return ids
}

export const CONSTRUCTION_LAMELLA_IDS = idsForSlots(['lamella'])
export const CONSTRUCTION_BEAM_IDS = [
  ...idsForSlots(['beam']),
  ...['f10040', 'f12050'].filter((id) => !idsForSlots(['beam']).includes(id)),
]
export const CONSTRUCTION_POST_IDS = [
  ...idsForSlots(['post']),
  ...['f8080', 'f6060'].filter((id) => !idsForSlots(['post']).includes(id)),
]
export const CONSTRUCTION_PURLIN_IDS = [
  ...idsForSlots(['purlin-led', 'purlin']),
  ...['purlin-led-6040', 'purlin-plain-5030'].filter(
    (id) => !idsForSlots(['purlin-led', 'purlin']).includes(id),
  ),
]

export function applyLamellaWallThickness(profileId: string, thicknessMm: LamellaWallThicknessMm): string {
  const is70 = profileId === LAMELLA_70_08_ID
    || profileId === LAMELLA_70_16_ID
    || profileId === LAMELLA_70_10_ID
  if (!is70) return profileId
  return thicknessMm === 1.6 ? LAMELLA_70_16_ID : LAMELLA_70_08_ID
}

export function parseLamellaWallThicknessMm(value: unknown): LamellaWallThicknessMm | undefined {
  if (value === 1.6 || value === '1.6') return 1.6
  if (value === 1 || value === 1.0 || value === '1' || value === '1.0') return 1.6
  if (value === 0.8 || value === '0.8') return 0.8
  return undefined
}

export function formatConstructionProfileLabel(
  profileId: string,
  profile: ProfileDimensions | undefined = PERGOLA_CONSTRUCTION_PROFILES.get(profileId),
): string {
  if (!profile) return profileId
  const wall = profile.wallThicknessMm != null ? ` × ${profile.wallThicknessMm}` : ''
  const name = profile.labelHe ?? profileId
  const category = profile.categoryHe ? ` · ${profile.categoryHe}` : ''
  const sku = profile.sku && profile.sku !== name ? ` · ${profile.sku}` : ''
  return `${name} (${profile.widthMm}×${profile.heightMm}${wall} mm)${category}${sku}`
}
