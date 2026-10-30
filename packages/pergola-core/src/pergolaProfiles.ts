import { attachBeamPlanWidth } from './beamPlanWidth'
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
/** 40×20 lamella, wall 0.9 mm. Sold only as a 6000 mm bar. */
export const LAMELLA_40_09_ID = 'HS002'
export const LAMELLA_70_16_ID = 'pa 1121'
/** Aluminum density for a closed-tube check against the catalog kg/m. */
export const ALUMINUM_DENSITY_KG_PER_M3 = 2700
/** Deprecated profiles. Saved plans still resolve the id; new-plan pickers omit them. */
export const RETIRED_PROFILE_IDS = ['purlin-led-6040', 'purlin-plain-5030'] as const
/** Plain purlin and wing shelf: 60×40, plan width 40. No silent default. */
export const PLAIN_PURLIN_PROFILE_IDS = ['F4060', 'PA1296'] as const
/** Lighting purlin for new plans: טי תאורה 120/40. */
export const DEFAULT_LED_PURLIN_ID = 'PA3022'

export function isRetiredProfileId(profileId: string | undefined): boolean {
  return profileId != null && (RETIRED_PROFILE_IDS as readonly string[]).includes(profileId)
}

/**
 * Closed-tube kg/m from the outer section and wall thickness.
 * Catalog kg/m stays the ordered weight; this is the check against it.
 */
export function hollowRectWeightKgPerM(
  widthMm: number,
  heightMm: number,
  wallMm: number,
  densityKgPerM3 = ALUMINUM_DENSITY_KG_PER_M3,
): number | null {
  if (!(wallMm > 0) || !(widthMm > 2 * wallMm) || !(heightMm > 2 * wallMm)) return null
  const areaMm2 = widthMm * heightMm - (widthMm - 2 * wallMm) * (heightMm - 2 * wallMm)
  return areaMm2 * 1e-6 * densityKgPerM3
}

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
    const base = fromRow(row, {
      widthMm: parsed.widthMm,
      heightMm: parsed.heightMm,
      ...slotFlags(row.slot),
      sku: row.id,
    })
    entries.push([
      row.id,
      row.slot === 'beam' ? attachBeamPlanWidth(base, row.nameHe, row.sku) : base,
    ])
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
    ['f10040', attachBeamPlanWidth(fromSupplier('f10040', {
      widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [6000, 7000],
    }), 'מלבן 40/120', 'f10040')],
    ['pa2012', fromSupplier('pa2012', {
      widthMm: 150, heightMm: 150, availableStockLengthsMm: [6000, 7000],
    })],
    ['f2020', fromSupplier('f2020', {
      widthMm: 20, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000],
    })],
    ['f4020', fromSupplier('F4020', {
      widthMm: 40, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000],
    })],
    [LAMELLA_70_08_ID, fromSupplier('f7020', {
      widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000],
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
    ['F4060', fromSupplier('F4060', {
      widthMm: 40, heightMm: 60, maxSpanMm: 3000, interruptsLamella: false,
      availableStockLengthsMm: [6000],
      wallThicknessMm: 1.2,
    })],
    ['PA1296', fromSupplier('PA1296', {
      widthMm: 40, heightMm: 60, maxSpanMm: 3000, interruptsLamella: false,
      availableStockLengthsMm: [6000, 6500, 7000],
      wallThicknessMm: 2,
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
      deprecated: true,
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
      deprecated: dims.deprecated === true || existing.deprecated === true,
    })
  }
  // 70×20 / 0.8 and 40×20 / 0.9 are sold only as 6000 mm. Other profiles keep
  // the supplier list, including thicker lamellas.
  for (const id of [LAMELLA_70_08_ID, LAMELLA_40_09_ID]) {
    const profile = map.get(id)
    if (!profile) continue
    map.set(id, {
      ...profile,
      availableStockLengthsMm: [6000],
      wallThicknessMm: id === LAMELLA_70_08_ID ? 0.8 : (profile.wallThicknessMm ?? 0.9),
    })
  }
  // Ids that older saved plans stored in a different spelling. Same profile, so the plan
  // builds, cuts and prints without rewriting the saved JSON.
  for (const [alias, canonical] of Object.entries(PROFILE_ID_ALIASES)) {
    const profile = map.get(canonical)
    if (profile && !map.has(alias)) map.set(alias, profile)
  }
  return map
}

/** Old spelling → current construction id. */
export const PROFILE_ID_ALIASES: Readonly<Record<string, string>> = {
  f20050: 'F20050',
  '1197 pa': 'pa1197',
}

/** Current construction id for a stored id; unknown ids come back unchanged. */
export function canonicalProfileId(profileId: string): string {
  return PROFILE_ID_ALIASES[profileId] ?? profileId
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
  ...['f10040'].filter((id) => !idsForSlots(['beam']).includes(id)),
]
export const CONSTRUCTION_POST_IDS = [
  ...idsForSlots(['post']),
  ...['f8080', 'f6060'].filter((id) => !idsForSlots(['post']).includes(id)),
]
export const CONSTRUCTION_PURLIN_IDS = [
  ...idsForSlots(['purlin-led', 'purlin']).filter((id) => !isRetiredProfileId(id)),
  ...PLAIN_PURLIN_PROFILE_IDS.filter(
    (id) => PERGOLA_CONSTRUCTION_PROFILES.has(id) && !idsForSlots(['purlin-led', 'purlin']).includes(id),
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
  const weightNote = profile.weightKgPerMeter == null ? ' · вес не задан' : ''
  return `${name} (${profile.widthMm}×${profile.heightMm}${wall} mm)${category}${sku}${weightNote}`
}
