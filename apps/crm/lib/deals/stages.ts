/**
 * Kanban columns of a firm, as data.
 *
 * A column has an immutable technical `key` (what deals.stage stores) and an
 * optional `role`: the business meaning the system relies on. Statistics,
 * profit, offer approval, Tazrim and the dashboard work by role, never by the
 * name a firm chose, so a column can be renamed freely.
 *
 * The aluminium template reproduces the nine columns that used to be hardcoded;
 * there the key equals the role, so Pashkovsky is unchanged.
 *
 * Pure: no React, no Supabase.
 */

export type StageRole =
  | 'signed'
  | 'material_ordered'
  | 'material_arrived'
  | 'in_production'
  | 'installation'
  | 'completed'

export const STAGE_ROLES: readonly StageRole[] = [
  'signed',
  'material_ordered',
  'material_arrived',
  'in_production',
  'installation',
  'completed',
]

export type StageLocale = 'he' | 'ru' | 'en' | 'sr'
export const STAGE_LOCALES: readonly StageLocale[] = ['he', 'ru', 'en', 'sr']

export type StageLabels = Partial<Record<StageLocale, string>>

export interface DealStageDef {
  key: string
  role: StageRole | null
  /** Tailwind background class, one of STAGE_COLORS. */
  color: string
  /** One label chosen by the firm, used for every language without its own. */
  label?: string | null
  labels?: StageLabels | null
  sortOrder: number
  isActive: boolean
}

// Full class names, so Tailwind's scanner keeps them.
export const STAGE_COLORS = [
  'bg-gray-500',
  'bg-slate-600',
  'bg-purple-500',
  'bg-violet-600',
  'bg-yellow-500',
  'bg-yellow-600',
  'bg-amber-600',
  'bg-orange-500',
  'bg-red-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-blue-500',
  'bg-sky-500',
  'bg-cyan-600',
  'bg-teal-600',
  'bg-green-500',
  'bg-emerald-600',
  'bg-indigo-500',
] as const

export const DEFAULT_STAGE_COLOR = 'bg-gray-500'

export function isStageColor(value: string): boolean {
  return (STAGE_COLORS as readonly string[]).includes(value)
}

/** Meaning of each role, for what depends on it. */
export const REVENUE_ROLES: ReadonlySet<StageRole> = new Set<StageRole>([
  'signed',
  'material_ordered',
  'material_arrived',
  'in_production',
  'installation',
  'completed',
])

/** Roles whose deals Tazrim forecasts, and in how many days the money is expected. */
export const FORECAST_DAYS_BY_ROLE: Partial<Record<StageRole, number>> = {
  material_ordered: 60,
  material_arrived: 30,
  in_production: 21,
  installation: 14,
}

/** Roles of deals that are being worked on (dashboard "in progress"). */
export const IN_PROGRESS_ROLES: readonly StageRole[] = [
  'material_ordered',
  'material_arrived',
  'in_production',
  'installation',
]

// --- Templates -------------------------------------------------------------

export type StageTemplateId = 'aluminum' | 'construction' | 'repair' | 'windows' | 'roofing'

export interface StageTemplateEntry {
  key: string
  role: StageRole | null
  color: string
  /** Null = use the translated default for this key (aluminium keeps its existing names). */
  labels: Record<StageLocale, string> | null
}

function entry(
  key: string,
  role: StageRole | null,
  color: string,
  labels: Record<StageLocale, string> | null,
): StageTemplateEntry {
  return { key, role, color, labels }
}

/** The nine columns that were hardcoded before. Order, keys and colors are unchanged. */
export const ALUMINUM_TEMPLATE: readonly StageTemplateEntry[] = [
  entry('new', null, 'bg-gray-500', null),
  entry('measure', null, 'bg-purple-500', null),
  entry('offer', null, 'bg-yellow-500', null),
  entry('offer_approved', 'signed', 'bg-yellow-600', null),
  entry('material_ordered', 'material_ordered', 'bg-blue-500', null),
  entry('approved', 'material_arrived', 'bg-green-500', null),
  entry('production', 'in_production', 'bg-orange-500', null),
  entry('install', 'installation', 'bg-indigo-500', null),
  entry('done', 'completed', 'bg-emerald-600', null),
]

export const STAGE_TEMPLATES: Record<StageTemplateId, readonly StageTemplateEntry[]> = {
  aluminum: ALUMINUM_TEMPLATE,
  construction: [
    entry('signed', 'signed', 'bg-yellow-600', {
      he: 'עסקה נחתמה',
      ru: 'Сделка подписана',
      en: 'Deal signed',
      sr: 'Posao potpisan',
    }),
    entry('in_progress', 'in_production', 'bg-orange-500', {
      he: 'עסקה בביצוע',
      ru: 'Сделка в работе',
      en: 'Deal in progress',
      sr: 'Posao u toku',
    }),
    entry('completed', 'completed', 'bg-emerald-600', {
      he: 'עסקה הסתיימה',
      ru: 'Сделка закончена',
      en: 'Deal completed',
      sr: 'Posao završen',
    }),
  ],
  repair: [
    entry('request', null, 'bg-gray-500', {
      he: 'פנייה חדשה',
      ru: 'Новая заявка',
      en: 'New request',
      sr: 'Novi zahtev',
    }),
    entry('estimate_agreed', 'signed', 'bg-yellow-600', {
      he: 'הצעה אושרה',
      ru: 'Смета согласована',
      en: 'Estimate agreed',
      sr: 'Predračun odobren',
    }),
    entry('in_progress', 'in_production', 'bg-orange-500', {
      he: 'בעבודה',
      ru: 'В работе',
      en: 'In progress',
      sr: 'U toku',
    }),
    entry('done', 'completed', 'bg-emerald-600', {
      he: 'הושלם',
      ru: 'Выполнено',
      en: 'Done',
      sr: 'Završeno',
    }),
  ],
  windows: [
    entry('new', null, 'bg-gray-500', { he: 'חדש', ru: 'Новая', en: 'New', sr: 'Novo' }),
    entry('measure', null, 'bg-purple-500', { he: 'מדידה', ru: 'Замер', en: 'Measurement', sr: 'Merenje' }),
    entry('offer', null, 'bg-yellow-500', { he: 'הצעת מחיר', ru: 'Предложение', en: 'Quote', sr: 'Ponuda' }),
    entry('signed', 'signed', 'bg-yellow-600', { he: 'נחתם', ru: 'Подписано', en: 'Signed', sr: 'Potpisano' }),
    entry('production', 'in_production', 'bg-orange-500', {
      he: 'בייצור',
      ru: 'Производство',
      en: 'In production',
      sr: 'U proizvodnji',
    }),
    entry('installation', 'installation', 'bg-indigo-500', {
      he: 'בהתקנה',
      ru: 'Монтаж',
      en: 'Installation',
      sr: 'Montaža',
    }),
    entry('done', 'completed', 'bg-emerald-600', { he: 'הושלם', ru: 'Готово', en: 'Done', sr: 'Završeno' }),
  ],
  roofing: [
    entry('new', null, 'bg-gray-500', { he: 'חדש', ru: 'Новая', en: 'New', sr: 'Novo' }),
    entry('inspection', null, 'bg-purple-500', {
      he: 'בדיקת גג',
      ru: 'Осмотр крыши',
      en: 'Roof inspection',
      sr: 'Pregled krova',
    }),
    entry('offer', null, 'bg-yellow-500', { he: 'הצעת מחיר', ru: 'Предложение', en: 'Quote', sr: 'Ponuda' }),
    entry('signed', 'signed', 'bg-yellow-600', { he: 'נחתם', ru: 'Подписано', en: 'Signed', sr: 'Potpisano' }),
    entry('material_ordered', 'material_ordered', 'bg-blue-500', {
      he: 'חומר הוזמן',
      ru: 'Материал заказан',
      en: 'Material ordered',
      sr: 'Materijal naručen',
    }),
    entry('installation', 'installation', 'bg-indigo-500', {
      he: 'בעבודה על הגג',
      ru: 'Работа на крыше',
      en: 'On the roof',
      sr: 'Radovi na krovu',
    }),
    entry('done', 'completed', 'bg-emerald-600', { he: 'הושלם', ru: 'Готово', en: 'Done', sr: 'Završeno' }),
  ],
}

export const STAGE_TEMPLATE_IDS = Object.keys(STAGE_TEMPLATES) as StageTemplateId[]

/** Which template a firm's industry starts from. Unknown industries get the aluminium set (legacy behaviour). */
export function templateIdForIndustry(industry: string | null | undefined): StageTemplateId {
  switch ((industry ?? '').trim().toLowerCase()) {
    case 'construction':
      return 'construction'
    case 'repair':
    case 'renovation':
      return 'repair'
    case 'windows':
      return 'windows'
    case 'roofing':
      return 'roofing'
    default:
      return 'aluminum'
  }
}

/**
 * The built-in aluminium names in the four languages (same text as the `deals.stages`
 * messages). Only the registration step needs them: it writes names into a brand-new
 * firm's own rows, while Pashkovsky's rows keep no name and read the messages.
 */
const ALUMINUM_STAGE_NAMES: Record<string, Record<StageLocale, string>> = {
  new: { he: 'חדש', ru: 'Новая', en: 'New', sr: 'Novo' },
  measure: { he: 'מדידה', ru: 'Замер', en: 'Measure', sr: 'Merenje' },
  offer: { he: 'הצעת מחיר', ru: 'Предложение', en: 'Offer', sr: 'Ponuda' },
  offer_approved: { he: 'הצעת מחיר מאושרת', ru: 'Предложение утверждено', en: 'Offer Approved', sr: 'Ponuda odobrena' },
  material_ordered: { he: 'חומר הוזמן', ru: 'Материал заказан', en: 'Material Ordered', sr: 'Materijal naručen' },
  approved: { he: 'חומר שהגיע למפעל', ru: 'Материал на заводе', en: 'Material Received', sr: 'Materijal primljen' },
  production: { he: 'ייצור', ru: 'Производство', en: 'Production', sr: 'Produkcija' },
  install: { he: 'התקנה', ru: 'Установка', en: 'Installation', sr: 'Ugradnja' },
  done: { he: 'הושלם', ru: 'Готово', en: 'Done', sr: 'Završeno' },
}

/** A template as a new firm's starting list: every column carries its names, none relies on defaults. */
export function stagesForNewFirm(id: StageTemplateId): DealStageDef[] {
  return stagesFromTemplate(id).map((stage) => ({
    ...stage,
    labels: stage.labels ?? ALUMINUM_STAGE_NAMES[stage.key] ?? null,
  }))
}

export function stagesFromTemplate(id: StageTemplateId): DealStageDef[] {
  return STAGE_TEMPLATES[id].map((t, index) => ({
    key: t.key,
    role: t.role,
    color: t.color,
    label: null,
    labels: t.labels ? { ...t.labels } : null,
    sortOrder: index,
    isActive: true,
  }))
}

/** Used while the firm's own list is loading, and when it has none: the aluminium set. */
export const DEFAULT_STAGES: readonly DealStageDef[] = stagesFromTemplate('aluminum')

// --- Reading ---------------------------------------------------------------

const LEGACY_ALUMINUM_KEYS: ReadonlySet<string> = new Set(ALUMINUM_TEMPLATE.map((t) => t.key))
const LEGACY_ROLE_BY_KEY: ReadonlyMap<string, StageRole | null> = new Map(
  ALUMINUM_TEMPLATE.map((t) => [t.key, t.role]),
)

export function isLegacyAluminumKey(key: string): boolean {
  return LEGACY_ALUMINUM_KEYS.has(key)
}

export function sortStages<T extends { sortOrder: number }>(stages: readonly T[]): T[] {
  return [...stages].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function activeStages(stages: readonly DealStageDef[]): DealStageDef[] {
  return sortStages(stages.filter((s) => s.isActive))
}

/** The role of a deal's stage key within a firm's columns. */
export function roleOfStage(
  key: string | null | undefined,
  stages: readonly DealStageDef[],
): StageRole | null {
  if (!key) return null
  return stages.find((s) => s.key === key)?.role ?? null
}

/** Role lookup that falls back to the aluminium meaning of the old fixed keys (no stage list at hand). */
export function legacyRoleOfKey(key: string | null | undefined): StageRole | null {
  if (!key) return null
  return LEGACY_ROLE_BY_KEY.get(key) ?? null
}

export type StageRoleResolver = (key: string | null | undefined) => StageRole | null

export function resolverFor(stages: readonly DealStageDef[] | null | undefined): StageRoleResolver {
  if (!stages || stages.length === 0) return legacyRoleOfKey
  return (key) => roleOfStage(key, stages)
}

export function keysWithRole(
  stages: readonly DealStageDef[],
  roles: readonly StageRole[],
): string[] {
  return stages.filter((s) => s.role !== null && roles.includes(s.role)).map((s) => s.key)
}

/** The first active column: where deals without a stage (or with an unknown one) are shown. */
export function firstStageKey(stages: readonly DealStageDef[]): string {
  return activeStages(stages)[0]?.key ?? DEFAULT_STAGES[0].key
}

/** The column key a deal is shown in. */
export function displayStageKey(
  dealStage: string | null | undefined,
  stages: readonly DealStageDef[],
): string {
  if (dealStage && stages.some((s) => s.key === dealStage && s.isActive)) return dealStage
  return firstStageKey(stages)
}

/**
 * Where a signed offer moves a deal: the firm's first active "signed" column,
 * but only when the deal still sits in a column before it that has no logic of
 * its own. Null = leave the deal where it is (later stages never move back; a
 * firm without a "signed" column keeps its deals in place).
 */
export function approvalTargetStage(
  dealStage: string | null | undefined,
  stages: readonly DealStageDef[],
): string | null {
  const signed = activeStages(stages).find((s) => s.role === 'signed')
  if (!signed) return null
  if (!dealStage) return signed.key
  const current = stages.find((s) => s.key === dealStage)
  if (!current || current.role !== null) return null
  return current.sortOrder < signed.sortOrder ? signed.key : null
}

/**
 * The label for a language: the firm's per-language label, then its single
 * label, then the translated default for a known key, then the key itself.
 */
export function stageLabel(
  stage: Pick<DealStageDef, 'key' | 'label' | 'labels'>,
  locale: string,
  defaultFor?: (key: string) => string | undefined,
): string {
  const perLanguage = stage.labels?.[locale as StageLocale]?.trim()
  if (perLanguage) return perLanguage
  const single = stage.label?.trim()
  if (single) return single
  const fallbackLabels = stage.labels
    ? (stage.labels.en ?? stage.labels.ru ?? stage.labels.he ?? stage.labels.sr)?.trim()
    : undefined
  if (fallbackLabels) return fallbackLabels
  return defaultFor?.(stage.key) ?? stage.key
}

// --- Editing ---------------------------------------------------------------

export interface StageDraft {
  /** Existing column key; empty for a new column (the server generates one). */
  key?: string | null
  role?: StageRole | null
  color: string
  label?: string | null
  labels?: StageLabels | null
  isActive: boolean
}

export interface StageValidationInput {
  drafts: readonly StageDraft[]
  existing: readonly DealStageDef[]
  /** Number of deals per stage key. */
  dealCounts: Readonly<Record<string, number>>
  /** For a removed or hidden column that holds deals: the column to move them to. */
  moves?: Readonly<Record<string, string>>
}

export interface StageBlocked {
  key: string
  dealCount: number
}

export interface StageWarning {
  key: string
  role: StageRole
}

export interface StageValidationResult {
  errors: string[]
  /** Columns that hold deals and have no (valid) target to move them to. */
  blocked: StageBlocked[]
  /** Functions that stop working because their column was removed or hidden. */
  warnings: StageWarning[]
  /** Set when no active column has the "completed" role: revenue statistics stay empty. */
  noCompletedStage: boolean
}

const MAX_LABEL_LENGTH = 60

function hasName(draft: StageDraft): boolean {
  // A built-in aluminium column without a stored name shows its translated default.
  if (draft.key && isLegacyAluminumKey(draft.key)) return true
  if (draft.label?.trim()) return true
  return STAGE_LOCALES.some((locale) => draft.labels?.[locale]?.trim())
}

export function validateStageDrafts(input: StageValidationInput): StageValidationResult {
  const errors: string[] = []
  const blocked: StageBlocked[] = []
  const warnings: StageWarning[] = []
  const existingByKey = new Map(input.existing.map((s) => [s.key, s]))
  const seen = new Set<string>()

  if (!input.drafts.some((d) => d.isActive)) errors.push('at_least_one_active_stage')

  for (const draft of input.drafts) {
    if (!hasName(draft)) errors.push('stage_name_required')
    for (const text of [draft.label, ...STAGE_LOCALES.map((l) => draft.labels?.[l])]) {
      if (text && text.trim().length > MAX_LABEL_LENGTH) errors.push('stage_name_too_long')
    }
    if (!isStageColor(draft.color)) errors.push('stage_color_invalid')
    if (draft.role !== null && draft.role !== undefined && !STAGE_ROLES.includes(draft.role)) {
      errors.push('stage_role_invalid')
    }

    if (draft.key) {
      if (seen.has(draft.key)) errors.push('stage_key_duplicate')
      seen.add(draft.key)
      const current = existingByKey.get(draft.key)
      if (!current) errors.push('stage_key_unknown')
      // Like the key, the meaning of a column is fixed when it is created; only its
      // name, color, order and visibility change.
      else if ((draft.role ?? null) !== current.role) {
        errors.push('stage_role_locked')
      }
    }
  }

  const keptActiveKeys = new Set(
    input.drafts.filter((d) => d.isActive && d.key).map((d) => d.key as string),
  )

  for (const current of input.existing) {
    const draft = input.drafts.find((d) => d.key === current.key)
    const stillActive = draft?.isActive === true
    if (stillActive || !current.isActive) continue

    const dealCount = input.dealCounts[current.key] ?? 0
    if (dealCount > 0) {
      const target = input.moves?.[current.key]
      const targetValid =
        target !== undefined && target !== current.key && keptActiveKeys.has(target)
      if (!targetValid) blocked.push({ key: current.key, dealCount })
    }
    if (current.role) warnings.push({ key: current.key, role: current.role })
  }

  // Deals are moved only into columns that already exist (a brand-new column has no key yet).

  const activeRoles = input.drafts
    .filter((d) => d.isActive)
    .map((d) => (d.key ? (existingByKey.get(d.key)?.role ?? null) : (d.role ?? null)))
  const noCompletedStage = !activeRoles.includes('completed')

  return { errors: [...new Set(errors)], blocked, warnings, noCompletedStage }
}

const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** A new immutable key for a custom column. `random` is injectable for tests. */
export function generateStageKey(
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
): string {
  for (;;) {
    let suffix = ''
    for (let i = 0; i < 6; i += 1) suffix += KEY_ALPHABET[Math.floor(random() * KEY_ALPHABET.length)]
    const key = `custom_${suffix}`
    if (!taken.has(key)) return key
  }
}
