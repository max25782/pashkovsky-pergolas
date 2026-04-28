/**
 * Deal may include multiple product lines (pergola + fence + …) stored in project_config.product_lines.
 * work_type stays a single DB field: derive with deriveWorkTypeFromProductLines (multi → other).
 */

export type DealProductLine = 'pergola' | 'fence' | 'railings' | 'gates' | 'facade'

const LINE_ORDER: readonly DealProductLine[] = ['pergola', 'fence', 'railings', 'gates', 'facade']

export type WorkTypeSingle = 'pergola' | 'railings' | 'gates' | 'facade' | 'fence' | 'other'

function isDealProductLine(v: unknown): v is DealProductLine {
  return (
    v === 'pergola' || v === 'fence' || v === 'railings' || v === 'gates' || v === 'facade'
  )
}

export function normalizeProductLines(lines: DealProductLine[]): DealProductLine[] {
  const set = new Set(lines)
  return LINE_ORDER.filter((l) => set.has(l))
}

/** Legacy: project_config.warranty.scopes (max 3 values) before product_lines existed. */
function parseLegacyWarrantyScopes(projectConfig: unknown): DealProductLine[] | undefined {
  if (projectConfig === null || projectConfig === undefined) return undefined
  if (typeof projectConfig !== 'object' || Array.isArray(projectConfig)) return undefined
  const w = (projectConfig as Record<string, unknown>).warranty
  if (w === null || w === undefined || typeof w !== 'object' || Array.isArray(w)) return undefined
  if (!Object.prototype.hasOwnProperty.call(w, 'scopes')) return undefined
  const raw = (w as Record<string, unknown>).scopes
  if (!Array.isArray(raw)) return undefined
  const out: DealProductLine[] = []
  for (const item of raw) {
    if (isDealProductLine(item)) out.push(item)
  }
  return normalizeProductLines(out)
}

/**
 * Returns `undefined` when `product_lines` key is absent (use inference / legacy).
 * Returns an array when the key exists (may be empty).
 */
export function parseProductLinesConfig(projectConfig: unknown): DealProductLine[] | undefined {
  if (projectConfig === null || projectConfig === undefined) return undefined
  if (typeof projectConfig !== 'object' || Array.isArray(projectConfig)) return undefined
  if (!Object.prototype.hasOwnProperty.call(projectConfig, 'product_lines')) return undefined
  const raw = (projectConfig as Record<string, unknown>).product_lines
  if (!Array.isArray(raw)) return undefined
  const out: DealProductLine[] = []
  for (const item of raw) {
    if (isDealProductLine(item)) out.push(item)
  }
  return normalizeProductLines(out)
}

export function inferProductLinesFromWorkType(wt: string | null | undefined): DealProductLine[] {
  if (!wt || wt === 'other') return []
  if (isDealProductLine(wt)) return [wt]
  return []
}

export function resolveProductLinesForDealUi(deal: {
  project_config?: unknown
  work_type?: string | null
}): DealProductLine[] {
  const direct = parseProductLinesConfig(deal.project_config)
  if (direct !== undefined) return direct.length > 0 ? direct : ['pergola']
  const legacy = parseLegacyWarrantyScopes(deal.project_config)
  if (legacy !== undefined && legacy.length > 0) return legacy
  const inferred = inferProductLinesFromWorkType(deal.work_type)
  if (inferred.length > 0) return inferred
  return ['pergola']
}

export function dealIncludesProductLine(
  line: DealProductLine,
  workType: string | null | undefined,
  projectConfig: unknown,
): boolean {
  if (workType === line) return true
  return resolveProductLinesForDealUi({ project_config: projectConfig, work_type: workType }).includes(line)
}

export function deriveWorkTypeFromProductLines(lines: DealProductLine[]): WorkTypeSingle {
  const n = normalizeProductLines(lines)
  if (n.length === 0) return 'pergola'
  if (n.length === 1) return n[0]
  return 'other'
}

export function mergeProjectConfigProductLines(
  existingProjectConfig: unknown,
  lines: DealProductLine[],
): Record<string, unknown> {
  const base =
    existingProjectConfig && typeof existingProjectConfig === 'object' && !Array.isArray(existingProjectConfig)
      ? { ...(existingProjectConfig as Record<string, unknown>) }
      : {}
  const prevWarranty =
    base.warranty && typeof base.warranty === 'object' && !Array.isArray(base.warranty)
      ? { ...(base.warranty as Record<string, unknown>) }
      : {}
  const wl = normalizeProductLines(lines)
  const warrantySubset = wl.filter((l) => l === 'pergola' || l === 'fence' || l === 'railings')
  return {
    ...base,
    product_lines: wl,
    warranty: {
      ...prevWarranty,
      scopes: warrantySubset,
    },
  }
}

/** Create / POST: prefers project_config.product_lines, else single work_type, else default pergola. */
export function resolveProductLinesForCreate(opts: {
  project_config?: unknown
  work_type?: string | null
}): DealProductLine[] {
  const parsed = parseProductLinesConfig(opts.project_config ?? null)
  if (parsed !== undefined && parsed.length > 0) return parsed
  const inferred = inferProductLinesFromWorkType(opts.work_type)
  if (inferred.length > 0) return inferred
  return ['pergola']
}

/** PDF + API: prefers product_lines; legacy warranty.scopes; then work_type (default pergola). Explicit empty product_lines → empty (generic PDF). */
export function resolveProductLinesForPdf(projectConfig: unknown, workType: string | null): DealProductLine[] {
  const direct = parseProductLinesConfig(projectConfig)
  if (direct !== undefined) {
    if (direct.length > 0) return direct
    return []
  }
  const legacy = parseLegacyWarrantyScopes(projectConfig)
  if (legacy !== undefined && legacy.length > 0) return legacy
  const inferred = inferProductLinesFromWorkType(workType)
  return inferred.length > 0 ? inferred : ['pergola']
}

export interface WarrantyPdfSection {
  title: string
  lines: string[]
}

export function buildWarrantyPdfSections(productLines: DealProductLine[]): WarrantyPdfSection[] {
  const normalized = normalizeProductLines(productLines)
  const sections: WarrantyPdfSection[] = []
  for (const s of normalized) {
    if (s === 'pergola') {
      sections.push({
        title: 'פרגולת אלומיניום',
        lines: [
          'תקופת אחריות: 7 (שבע) שנים מיום ההתקנה.',
          'האחריות מכסה: צבע (גימור RAL), קונסטרוקציה ואטימות בהתקנה, ופרופילי מערכת סנטף BH (Santaf BH) — בהתאם למפרט היצרן והשימוש התקין.',
        ],
      })
    } else if (s === 'fence') {
      sections.push({
        title: 'גדר',
        lines: [
          'תקופת אחריות: 12 חודשים מיום ההתקנה.',
          'האחריות מכסה פגמי ייצור והתקנה סטנדרטיים; אינה מכסה נזקי מכות, שריפה, שריטות המשך או שימוש חורג מהמקובל.',
        ],
      })
    } else if (s === 'railings') {
      sections.push({
        title: 'מעקה',
        lines: [
          'תקופת אחריות: 12 חודשים מיום ההתקנה.',
          'האחריות מכסה פגמי ייצור והתקנה סטנדרטיים; זכוכית ורכיבים שנפגעו ממכה או שימוש שגוי אינם כלולים.',
        ],
      })
    } else if (s === 'gates') {
      sections.push({
        title: 'שערים',
        lines: [
          'תקופת אחריות: 12 חודשים מיום ההתקנה (מהדגמה כללית; ניתן לעדכן לפי מפרט הפרויקט).',
          'האחריות מכסה פגמי ייצור והתקנה סטנדרטיים לפי ביצוע בפועל.',
        ],
      })
    } else if (s === 'facade') {
      sections.push({
        title: 'חזית / צירוב',
        lines: [
          'תקופת אחריות: 12 חודשים מיום ההתקנה (מהדגמה כללית; ניתן לעדכן לפי מפרט הפרויקט).',
          'היקף הכיסוי לפי הסכם הפרויקט והצעת המחיר.',
        ],
      })
    }
  }
  return sections
}
