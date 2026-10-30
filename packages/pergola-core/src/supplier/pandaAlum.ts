import catalogJson from './panda-alum-catalog.json'

export const PANDA_ALUM_CATALOG_URL = 'https://www.panda-alum.co.il/profile-calculator/'

export interface PandaAlumProfile {
  nameHe: string
  sku: string | null
  stockLengthsMm: number[]
  weightKgPerM: number | null
  wallThicknessMm: number | null
  categoryHe: string | null
}

export const PANDA_ALUM_PROFILES: PandaAlumProfile[] = catalogJson.profiles

function normSku(sku: string): string {
  return sku.replace(/\s+/g, '').toLowerCase()
}

/**
 * Panda lists the 50/150 wall-4 frame as «1197 pa». The project calls it pa1197
 * (same pattern as pa1162, pa1429). Construction id and lookups use the project code.
 */
const PANDA_SKU_PROJECT_CODES: Record<string, string> = {
  '1197pa': 'pa1197',
}

export function findPandaAlumBySku(sku: string): PandaAlumProfile | undefined {
  const normalized = normSku(sku)
  const want = Object.entries(PANDA_SKU_PROJECT_CODES).find(([, code]) => code === normalized)?.[0] ?? normalized
  return PANDA_ALUM_PROFILES.find((p) => p.sku != null && normSku(p.sku) === want)
}

export function pandaAlumLabel(profile: PandaAlumProfile): string {
  const bits = [profile.nameHe]
  if (profile.categoryHe) bits.push(profile.categoryHe)
  if (profile.wallThicknessMm != null) bits.push(`${profile.wallThicknessMm} mm`)
  if (profile.sku) bits.push(profile.sku)
  return bits.join(' · ')
}

export type PergolaCatalogSlot = 'lamella' | 'beam' | 'post' | 'purlin' | 'purlin-led'

export function pergolaCatalogSlot(categoryHe: string | null | undefined): PergolaCatalogSlot | null {
  if (!categoryHe) return null
  if (categoryHe === 'lamella לפרגולה') return 'lamella'
  if (categoryHe === 'עמוד פרגולה') return 'post'
  if (categoryHe === 'מסגרת לפרגולה') return 'beam'
  if (categoryHe === 'חוצץ/אגד לפרגולה עם מקום לתאורה') return 'purlin-led'
  if (categoryHe === 'חוצץ/אגד לפרגולה') return 'purlin'
  return null
}

export interface ParsedCatalogDims {
  widthMm: number
  heightMm: number
  /** True when the name had only one size (T / double-T). Width is not on the calculator. */
  widthAssumed: boolean
}

const PAIR = /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?/

/**
 * Double-T flange (horizontal) for webs named on the calculator as a single size.
 * 120/70 and 142/70 are user-stated; other T sizes stay unassumed.
 */
const DOUBLE_T_FLANGE_MM: Record<number, number> = {
  120: 70,
  142: 70,
}

/**
 * Plain T purlin named with only the web. Flange is the plan width.
 * טי 80 → 40×80, טי 100 → 40×100, טי 120 → 40×120. Other single sizes stay unassumed.
 */
const PLAIN_T_FLANGE_MM: Record<number, number> = {
  80: 40,
  100: 40,
  120: 40,
}

function parseDoubleTDims(nameHe: string): ParsedCatalogDims | null {
  if (!nameHe.includes('דאבל טי')) return null
  const first = nameHe.match(/(\d+(?:\.\d+)?)/)
  const web = first ? Number(first[1]) : NaN
  if (!Number.isFinite(web) || web <= 0) return null
  const flange = DOUBLE_T_FLANGE_MM[web]
  if (flange == null) return { widthMm: web, heightMm: web, widthAssumed: true }
  return { widthMm: flange, heightMm: web, widthAssumed: false }
}

/** Section sizes from the supplier Hebrew name. Does not invent a missing width. */
export function parseCatalogNameDims(
  nameHe: string,
  slot: PergolaCatalogSlot,
): ParsedCatalogDims | null {
  const doubleT = parseDoubleTDims(nameHe)
  if (doubleT) return doubleT
  const pair = nameHe.match(PAIR)
  if (pair) {
    const a = Number(pair[1])
    const b = Number(pair[2])
    const third = pair[3] != null ? Number(pair[3]) : null
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null
    // "142/1.6" is size/wall, not a 142×1.6 section.
    if (third == null && b < 10 && a >= 15) {
      return { widthMm: a, heightMm: a, widthAssumed: true }
    }
    if (slot === 'lamella') return { widthMm: b, heightMm: a, widthAssumed: false }
    if (slot === 'post') return { widthMm: a, heightMm: b, widthAssumed: false }
    if (slot === 'beam') return { widthMm: a, heightMm: b, widthAssumed: false }
    return { widthMm: Math.min(a, b), heightMm: Math.max(a, b), widthAssumed: false }
  }
  const single = nameHe.match(/(?:טי|דאבל טי)[^\d]*(\d+(?:\.\d+)?)/)
  if (single && (slot === 'purlin' || slot === 'purlin-led' || slot === 'beam')) {
    const n = Number(single[1])
    if (!Number.isFinite(n) || n <= 0) return null
    const flange = slot === 'purlin' ? PLAIN_T_FLANGE_MM[n] : undefined
    if (flange != null) return { widthMm: flange, heightMm: n, widthAssumed: false }
    return { widthMm: n, heightMm: n, widthAssumed: true }
  }
  return null
}

export function catalogConstructionId(row: PandaAlumProfile): string {
  if (row.sku && row.sku.trim()) return PANDA_SKU_PROJECT_CODES[normSku(row.sku)] ?? row.sku
  const dims = row.nameHe.match(/(\d+)\s*\/\s*(\d+)/)
  if (dims) return `square-${dims[1]}`
  return `unnamed-${row.nameHe}`
}

export function pandaAlumPergolaRows(): Array<PandaAlumProfile & { slot: PergolaCatalogSlot; id: string }> {
  const out: Array<PandaAlumProfile & { slot: PergolaCatalogSlot; id: string }> = []
  for (const row of PANDA_ALUM_PROFILES) {
    const slot = pergolaCatalogSlot(row.categoryHe)
    if (!slot) continue
    out.push({ ...row, slot, id: catalogConstructionId(row) })
  }
  return out
}
