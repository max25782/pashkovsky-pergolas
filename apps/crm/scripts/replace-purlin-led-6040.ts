/**
 * Prepare a replacement of the retired purlin purlin-led-6040 with PA3022.
 *
 * Default is a read-only report. Nothing is written unless --apply is passed.
 * --apply saves the previous JSON first, then updates offers.
 * --rollback restores that snapshot. A second --apply is refused while the
 * snapshot file still exists, so the backup cannot be overwritten.
 *
 *   npx tsx scripts/replace-purlin-led-6040.ts
 *   npx tsx scripts/replace-purlin-led-6040.ts --apply
 *   npx tsx scripts/replace-purlin-led-6040.ts --rollback
 */
import { config } from 'dotenv'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  PERGOLA_CONSTRUCTION_PROFILES,
  WING_SHELF_SPAN_DIVIDER_ID,
  buildLamellaSections,
  buildPiecesFromPlan,
  resolveBeamPlanWidth,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { PlanConstructionParams, Point2D } from '@pashkovsky/pergola-core'
import { parsePergolaPlan } from '../lib/pergolas/normalize-pergola'

config({ path: resolve(__dirname, '../.env.local') })

const FROM = 'purlin-led-6040'
const TO = 'PA3022'
const ROLLBACK_PATH = resolve(__dirname, '.purlin-led-6040-rollback.json')

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

interface OfferRow {
  id: string
  offer_number: string | null
  customer_name: string | null
  approved: boolean | null
  pdf_url: string | null
  pergolas_data: unknown
  configurator_meta: unknown
}

interface RollbackFile {
  createdAt: string
  from: string
  to: string
  rows: Array<Pick<OfferRow, 'id' | 'pergolas_data' | 'configurator_meta'>>
}

function statusOf(row: OfferRow): 'draft' | 'sent' | 'accepted' {
  if (row.approved === true) return 'accepted'
  if (row.pdf_url != null && String(row.pdf_url).trim() !== '') return 'sent'
  return 'draft'
}

function replaceId(value: unknown): unknown {
  if (value === FROM) return TO
  if (Array.isArray(value)) return value.map(replaceId)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = replaceId(v)
    return out
  }
  return value
}

function countId(value: unknown): number {
  return JSON.stringify(value ?? null).split(FROM).length - 1
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1)
}

function tally(keys: string[]): string {
  const counts = new Map<string, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, n]) => `${n}×${key}`)
    .join(', ') || '—'
}

function planGeometry(raw: unknown, purlinProfileId: string): { lengths: string; sections: string } | { error: string } {
  const plan = parsePergolaPlan(raw)
  if (!plan) return { error: 'no-plan' }
  const contour: Point2D[] = plan.polygon.map((p) => [p.x, p.y])
  const params = { ...plan.params, purlinProfileId } as PlanConstructionParams
  const input = { contour, wallEdgeIndices: plan.wallIndices, params }
  try {
    const built = buildPiecesFromPlan(input, PERGOLA_CONSTRUCTION_PROFILES)
    const lengths = tally(
      built.pieces
        .filter((piece) => piece.role === 'purlin' && piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
        .map((piece) => round1(piece.lengthAxisMm)),
    )
    const spec = specFromPlan(input)
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    return {
      lengths,
      sections: tally(sections.map((section) => `${round1(section.widthMm)}×${round1(section.heightMm)}`)),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'build-failed' }
  }
}

function planSources(row: OfferRow): unknown[] {
  const sources: unknown[] = []
  if (Array.isArray(row.pergolas_data)) {
    for (const pergola of row.pergolas_data) {
      const plan = pergola && typeof pergola === 'object' ? (pergola as { plan?: unknown }).plan : null
      if (plan) sources.push(plan)
    }
  }
  const meta = row.configurator_meta
  if (meta && typeof meta === 'object' && 'planParams' in meta) {
    const params = (meta as { planParams?: unknown }).planParams
    if (params && countId(params) > 0 && sources.length === 0) sources.push({ polygon: [], params })
  }
  return sources
}

async function loadOffers(sb: SupabaseClient): Promise<OfferRow[]> {
  const pageSize = 200
  const rows: OfferRow[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from('offers')
      .select('id, offer_number, customer_name, approved, pdf_url, pergolas_data, configurator_meta')
      .range(from, from + pageSize - 1)
    if (error) throw error
    const batch = (data ?? []) as OfferRow[]
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows.filter((row) => countId(row.pergolas_data) + countId(row.configurator_meta) > 0)
}

function printReport(rows: OfferRow[]) {
  const led = PERGOLA_CONSTRUCTION_PROFILES.get(FROM)
  const next = PERGOLA_CONSTRUCTION_PROFILES.get(TO)
  const ledWidth = led ? resolveBeamPlanWidth(led.labelHe, FROM, led.widthMm, led.heightMm).planWidthMm : null
  const nextWidth = next ? resolveBeamPlanWidth(next.labelHe, TO, next.widthMm, next.heightMm).planWidthMm : null
  console.log(`profiles ${FROM} planWidth=${ledWidth} section=${led?.widthMm}×${led?.heightMm}`)
  console.log(`profiles ${TO} planWidth=${nextWidth} section=${next?.widthMm}×${next?.heightMm}`)
  console.log(`offers ${rows.length}`)
  console.log('num\tcustomer\tstatus\tcustomerPdf\tproductionPdf\torderPdf\thits\tlengths\tsections\tplanWidthChanges')

  let lengthsSame = 0
  let sectionsSame = 0
  let unbuilt = 0
  for (const row of rows) {
    const hits = countId(row.pergolas_data) + countId(row.configurator_meta)
    const plans = planSources(row).filter((plan) => parsePergolaPlan(plan))
    const compared = plans.map((plan) => ({
      before: planGeometry(plan, FROM),
      after: planGeometry(plan, TO),
    }))
    const lengthBits: string[] = []
    const sectionBits: string[] = []
    let rowLengthsSame = true
    let rowSectionsSame = true
    if (compared.length === 0) {
      unbuilt++
      rowLengthsSame = false
      rowSectionsSame = false
      lengthBits.push('no-buildable-plan')
      sectionBits.push('no-buildable-plan')
    }
    for (const pair of compared) {
      if ('error' in pair.before || 'error' in pair.after) {
        unbuilt++
        rowLengthsSame = false
        rowSectionsSame = false
        lengthBits.push('error' in pair.before ? pair.before.error : 'error' in pair.after ? pair.after.error : 'error')
        sectionBits.push('error')
        continue
      }
      if (pair.before.lengths !== pair.after.lengths) rowLengthsSame = false
      if (pair.before.sections !== pair.after.sections) rowSectionsSame = false
      lengthBits.push(pair.before.lengths === pair.after.lengths
        ? pair.before.lengths
        : `${pair.before.lengths} → ${pair.after.lengths}`)
      sectionBits.push(pair.before.sections === pair.after.sections
        ? pair.before.sections
        : `${pair.before.sections} → ${pair.after.sections}`)
    }
    if (rowLengthsSame) lengthsSame++
    if (rowSectionsSame) sectionsSame++
    const customerPdf = row.pdf_url != null && String(row.pdf_url).trim() !== '' ? 'yes' : 'no'
    console.log([
      row.offer_number ?? '—',
      (row.customer_name ?? '').replace(/\t/g, ' '),
      statusOf(row),
      customerPdf,
      'not-stored',
      'not-stored',
      hits,
      lengthBits.join(' | '),
      sectionBits.join(' | '),
      ledWidth === nextWidth ? 'no' : 'yes',
    ].join('\t'))
  }
  console.log(`summary lengthsUnchanged=${lengthsSame} sectionsUnchanged=${sectionsSame} unbuiltOrNoPlan=${unbuilt} planWidthChanges=${ledWidth === nextWidth ? 'no' : 'yes'}`)
}

async function apply(sb: SupabaseClient, rows: OfferRow[]) {
  if (existsSync(ROLLBACK_PATH)) {
    console.error(`Refusing --apply: rollback snapshot already exists at ${ROLLBACK_PATH}. Run --rollback first.`)
    process.exit(1)
  }
  const snapshot: RollbackFile = {
    createdAt: new Date().toISOString(),
    from: FROM,
    to: TO,
    rows: rows.map((row) => ({
      id: row.id,
      pergolas_data: row.pergolas_data,
      configurator_meta: row.configurator_meta,
    })),
  }
  writeFileSync(ROLLBACK_PATH, JSON.stringify(snapshot))
  let written = 0
  for (const row of rows) {
    const { error } = await sb
      .from('offers')
      .update({
        pergolas_data: replaceId(row.pergolas_data),
        configurator_meta: replaceId(row.configurator_meta),
      })
      .eq('id', row.id)
    if (error) {
      console.error(`Stopped after ${written} updates. ${row.id}: ${error.message}. Run --rollback.`)
      process.exit(1)
    }
    written++
  }
  console.log(`applied ${written}. snapshot ${ROLLBACK_PATH}`)
}

async function rollback(sb: SupabaseClient) {
  if (!existsSync(ROLLBACK_PATH)) {
    console.error(`No snapshot at ${ROLLBACK_PATH}`)
    process.exit(1)
  }
  const snapshot = JSON.parse(readFileSync(ROLLBACK_PATH, 'utf8')) as RollbackFile
  let restored = 0
  for (const row of snapshot.rows) {
    const { error } = await sb
      .from('offers')
      .update({
        pergolas_data: row.pergolas_data,
        configurator_meta: row.configurator_meta,
      })
      .eq('id', row.id)
    if (error) {
      console.error(`Stopped after ${restored} restores. ${row.id}: ${error.message}. Snapshot kept.`)
      process.exit(1)
    }
    restored++
  }
  console.log(`restored ${restored} from ${snapshot.createdAt}. Snapshot kept at ${ROLLBACK_PATH}.`)
}

async function main() {
  const applyFlag = process.argv.includes('--apply')
  const rollbackFlag = process.argv.includes('--rollback')
  if (applyFlag && rollbackFlag) {
    console.error('Pass only one of --apply or --rollback.')
    process.exit(1)
  }
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
  const sb = createClient(url, key)
  if (rollbackFlag) {
    await rollback(sb)
    return
  }
  const rows = await loadOffers(sb)
  printReport(rows)
  if (!applyFlag) {
    console.log('dry-run: no rows written. Pass --apply to replace the profile id, then --rollback to restore the snapshot.')
    return
  }
  await apply(sb, rows)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
