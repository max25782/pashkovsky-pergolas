import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_STAGES,
  generateStageKey,
  keysWithRole,
  resolverFor,
  sortStages,
  stagesFromTemplate,
  validateStageDrafts,
  type DealStageDef,
  type StageBlocked,
  type StageDraft,
  type StageLabels,
  type StageRole,
  type StageTemplateId,
  type StageWarning,
} from '@/lib/deals/stages'

interface StageRow {
  key: string
  role: string | null
  label: string | null
  labels: StageLabels | null
  color: string
  sort_order: number
  is_active: boolean
}

const STAGE_COLUMNS = 'key, role, label, labels, color, sort_order, is_active'

/** PostgREST / Postgres signals for "migration 063 is not applied yet". */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /deal_stages/.test(error.message ?? '') && /(does not exist|schema cache)/.test(error.message ?? '')
}

function fromRow(row: StageRow): DealStageDef {
  return {
    key: row.key,
    role: (row.role as StageRole | null) ?? null,
    color: row.color,
    label: row.label,
    labels: row.labels,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

export interface LoadedStages {
  stages: DealStageDef[]
  /** True when the firm has no rows of its own (or the table does not exist yet): the aluminium set is shown. */
  isDefault: boolean
}

/**
 * The firm's columns, hidden ones included. A firm with no rows, or a database
 * without the table, gets the aluminium set, which is what every firm had
 * before columns became configurable.
 */
export async function loadCompanyStages(
  supabase: SupabaseClient,
  companyId: string,
): Promise<LoadedStages> {
  const { data, error } = await supabase
    .from('deal_stages')
    .select(STAGE_COLUMNS)
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return { stages: [...DEFAULT_STAGES], isDefault: true }
    throw new Error(`Failed to load deal stages: ${error.message}`)
  }
  if (!data || data.length === 0) return { stages: [...DEFAULT_STAGES], isDefault: true }
  return { stages: sortStages((data as StageRow[]).map(fromRow)), isDefault: false }
}

/** Deals per stage key for one firm. */
export async function countDealsByStage(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('deals')
      .select('stage')
      .eq('company_id', companyId)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Failed to count deals per stage: ${error.message}`)
    for (const row of data ?? []) {
      const key = (row as { stage: string | null }).stage ?? ''
      counts[key] = (counts[key] ?? 0) + 1
    }
    if (!data || data.length < pageSize) break
  }
  return counts
}

function toRow(companyId: string, stage: DealStageDef): Record<string, unknown> {
  return {
    company_id: companyId,
    key: stage.key,
    role: stage.role,
    label: stage.label?.trim() || null,
    labels: stage.labels && Object.keys(stage.labels).length > 0 ? stage.labels : null,
    color: stage.color,
    sort_order: stage.sortOrder,
    is_active: stage.isActive,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Writes a firm's initial columns (registration). Replaces any rows the firm
 * has, so a new firm shows exactly the chosen set and nothing else.
 */
export async function seedCompanyStages(
  supabase: SupabaseClient,
  companyId: string,
  stages: readonly DealStageDef[],
): Promise<void> {
  const del = await supabase.from('deal_stages').delete().eq('company_id', companyId)
  if (del.error) throw new Error(`Failed to reset deal stages: ${del.error.message}`)
  const { error } = await supabase
    .from('deal_stages')
    .insert(stages.map((s) => toRow(companyId, s)))
  if (error) throw new Error(`Failed to create deal stages: ${error.message}`)
}

/** Turns what the registration step sends into stages; invalid input returns the error codes. */
export function stagesFromRegistration(
  input: unknown,
): { ok: true; stages: DealStageDef[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, errors: ['at_least_one_active_stage'] }
  const drafts: StageDraft[] = input.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>
    return {
      key: null,
      role: (r.role as StageRole | null | undefined) ?? null,
      color: typeof r.color === 'string' ? r.color : '',
      label: typeof r.label === 'string' ? r.label : null,
      labels: (r.labels as StageLabels | null | undefined) ?? null,
      isActive: true,
    }
  })
  const check = validateStageDrafts({ drafts, existing: [], dealCounts: {} })
  if (check.errors.length > 0) return { ok: false, errors: check.errors }

  const taken = new Set<string>()
  const stages = drafts.map((d, index): DealStageDef => {
    const key = generateStageKey(taken)
    taken.add(key)
    return {
      key,
      role: d.role ?? null,
      color: d.color,
      label: d.label?.trim() || null,
      labels: d.labels ?? null,
      sortOrder: index,
      isActive: true,
    }
  })
  return { ok: true, stages }
}

export interface SaveStagesInput {
  drafts: readonly StageDraft[]
  moves?: Readonly<Record<string, string>>
  acknowledgeWarnings?: boolean
}

export type SaveStagesResult =
  | { ok: true; stages: DealStageDef[] }
  | { ok: false; status: 400; errors: string[] }
  | { ok: false; status: 409; code: 'stage_has_deals'; blocked: StageBlocked[] }
  | { ok: false; status: 409; code: 'stage_warnings'; warnings: StageWarning[]; noCompletedStage: boolean }
  | { ok: false; status: 503; code: 'migration_not_applied' }

/**
 * Validates and stores the firm's columns. A column that holds deals cannot be
 * hidden or deleted until `moves` says where its deals go; those deals are
 * moved first. Removing a column with logic needs an explicit acknowledgement.
 */
export async function saveCompanyStages(
  supabase: SupabaseClient,
  companyId: string,
  input: SaveStagesInput,
): Promise<SaveStagesResult> {
  const probe = await supabase.from('deal_stages').select('key').eq('company_id', companyId).limit(1)
  if (probe.error) {
    if (isMissingTable(probe.error)) return { ok: false, status: 503, code: 'migration_not_applied' }
    throw new Error(`Failed to read deal stages: ${probe.error.message}`)
  }

  const loaded = await loadCompanyStages(supabase, companyId)
  // A firm still on the default set is edited as if its rows existed: the first save writes them.
  const existing = loaded.stages
  const dealCounts = await countDealsByStage(supabase, companyId)

  const check = validateStageDrafts({
    drafts: input.drafts,
    existing,
    dealCounts,
    moves: input.moves,
  })
  if (check.errors.length > 0) return { ok: false, status: 400, errors: check.errors }
  if (check.blocked.length > 0) {
    return { ok: false, status: 409, code: 'stage_has_deals', blocked: check.blocked }
  }
  if ((check.warnings.length > 0 || check.noCompletedStage) && input.acknowledgeWarnings !== true) {
    return {
      ok: false,
      status: 409,
      code: 'stage_warnings',
      warnings: check.warnings,
      noCompletedStage: check.noCompletedStage,
    }
  }

  const existingByKey = new Map(existing.map((s) => [s.key, s]))
  const draftKeys = new Set(input.drafts.filter((d) => d.key).map((d) => d.key as string))

  // 1. Move deals out of columns that are being hidden or removed.
  for (const current of existing) {
    const draft = input.drafts.find((d) => d.key === current.key)
    if (draft?.isActive === true) continue
    if ((dealCounts[current.key] ?? 0) === 0) continue
    const target = input.moves?.[current.key]
    if (!target) continue
    const { error } = await supabase
      .from('deals')
      .update({ stage: target })
      .eq('company_id', companyId)
      .eq('stage', current.key)
    if (error) throw new Error(`Failed to move deals out of ${current.key}: ${error.message}`)
  }

  // 2. Keys for new columns, then upsert everything in the new order.
  const taken = new Set([...existingByKey.keys(), ...draftKeys])
  const stages: DealStageDef[] = input.drafts.map((draft, index) => {
    const key = draft.key ?? generateStageKey(taken)
    taken.add(key)
    const current = existingByKey.get(key)
    return {
      key,
      role: current ? current.role : (draft.role ?? null),
      color: draft.color,
      label: draft.label?.trim() || null,
      labels: draft.labels ?? null,
      sortOrder: index,
      isActive: draft.isActive,
    }
  })

  const { error: upsertError } = await supabase
    .from('deal_stages')
    .upsert(stages.map((s) => toRow(companyId, s)), { onConflict: 'company_id,key' })
  if (upsertError) throw new Error(`Failed to save deal stages: ${upsertError.message}`)

  // 3. Delete columns that were removed (their deals are already moved).
  const removedKeys = existing.filter((s) => !draftKeys.has(s.key)).map((s) => s.key)
  if (removedKeys.length > 0) {
    const { error } = await supabase
      .from('deal_stages')
      .delete()
      .eq('company_id', companyId)
      .in('key', removedKeys)
    if (error) throw new Error(`Failed to delete deal stages: ${error.message}`)
  }

  return { ok: true, stages: sortStages(stages) }
}

export type ResetStagesResult =
  | { ok: true; stages: DealStageDef[] }
  | { ok: false; status: 400; errors: string[] }
  | { ok: false; status: 409; code: 'stage_has_deals'; blocked: StageBlocked[] }
  | { ok: false; status: 409; code: 'stage_warnings'; warnings: StageWarning[]; noCompletedStage: boolean }
  | { ok: false; status: 503; code: 'migration_not_applied' }

/**
 * Replaces the firm's columns with an industry template. Deals keep their keys;
 * those in a column the template does not have must be moved (to a template
 * column) before the old column goes.
 */
export async function resetCompanyStages(
  supabase: SupabaseClient,
  companyId: string,
  templateId: StageTemplateId,
  options: { moves?: Readonly<Record<string, string>>; acknowledgeWarnings?: boolean } = {},
): Promise<ResetStagesResult> {
  const probe = await supabase.from('deal_stages').select('key').eq('company_id', companyId).limit(1)
  if (probe.error) {
    if (isMissingTable(probe.error)) return { ok: false, status: 503, code: 'migration_not_applied' }
    throw new Error(`Failed to read deal stages: ${probe.error.message}`)
  }

  const target = stagesFromTemplate(templateId)
  const targetKeys = new Set(target.map((s) => s.key))
  const { stages: existing } = await loadCompanyStages(supabase, companyId)
  const dealCounts = await countDealsByStage(supabase, companyId)

  const dropped = existing.filter((s) => !targetKeys.has(s.key))
  const blocked: StageBlocked[] = []
  for (const stage of dropped) {
    const count = dealCounts[stage.key] ?? 0
    const to = options.moves?.[stage.key]
    if (count > 0 && !(to !== undefined && targetKeys.has(to))) blocked.push({ key: stage.key, dealCount: count })
  }
  if (blocked.length > 0) return { ok: false, status: 409, code: 'stage_has_deals', blocked }

  const warnings: StageWarning[] = dropped
    .filter((s) => s.role !== null)
    .map((s) => ({ key: s.key, role: s.role as StageRole }))
  const noCompletedStage = !target.some((s) => s.role === 'completed')
  if ((warnings.length > 0 || noCompletedStage) && options.acknowledgeWarnings !== true) {
    return { ok: false, status: 409, code: 'stage_warnings', warnings, noCompletedStage }
  }

  for (const stage of dropped) {
    if ((dealCounts[stage.key] ?? 0) === 0) continue
    const to = options.moves?.[stage.key]
    if (!to) continue
    const { error } = await supabase
      .from('deals')
      .update({ stage: to })
      .eq('company_id', companyId)
      .eq('stage', stage.key)
    if (error) throw new Error(`Failed to move deals out of ${stage.key}: ${error.message}`)
  }

  const { error: upsertError } = await supabase
    .from('deal_stages')
    .upsert(target.map((s) => toRow(companyId, s)), { onConflict: 'company_id,key' })
  if (upsertError) throw new Error(`Failed to save deal stages: ${upsertError.message}`)

  if (dropped.length > 0) {
    const { error } = await supabase
      .from('deal_stages')
      .delete()
      .eq('company_id', companyId)
      .in('key', dropped.map((s) => s.key))
    if (error) throw new Error(`Failed to delete deal stages: ${error.message}`)
  }
  return { ok: true, stages: target }
}

/** What the server-side statistics need: the firm's role lookup and the keys behind a role. */
export async function loadStageContext(supabase: SupabaseClient, companyId: string) {
  const { stages } = await loadCompanyStages(supabase, companyId)
  return {
    stages,
    roleOf: resolverFor(stages),
    keysWithRole: (roles: readonly StageRole[]) => keysWithRole(stages, roles),
  }
}
