/**
 * Old deals that have an offer but no amount: propose (and optionally write) the amount.
 *
 * Default is a read-only report. Nothing is written unless --apply is passed.
 * --apply saves the previous price/project_config of every touched deal to a snapshot
 * file first, then updates only deals whose price is still empty.
 * --rollback restores that snapshot. A second --apply is refused while the snapshot file
 * exists, so the backup cannot be overwritten.
 *
 * The amount follows the same rule as the app: the signed offer if there is one, otherwise
 * the latest offer; offers.final_price (client total with VAT, after discount).
 *
 *   npx tsx scripts/backfill-deal-prices.ts
 *   npx tsx scripts/backfill-deal-prices.ts --apply
 *   npx tsx scripts/backfill-deal-prices.ts --rollback
 */
import { config } from 'dotenv'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  buildBackfillPatch,
  buildBackfillPlan,
  type BackfillDealRow,
  type BackfillOfferRow,
} from '../lib/deals/deal-price-backfill'

config({ path: resolve(__dirname, '../.env.local') })

const SNAPSHOT_PATH = resolve(__dirname, '.backfill-deal-prices-rollback.json')
const PAGE_SIZE = 500
const OFFER_CHUNK = 100

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

interface SnapshotFile {
  createdAt: string
  rows: Array<{ id: string; price: number | string | null; project_config: unknown }>
}

async function loadDealsWithoutAmount(sb: SupabaseClient): Promise<BackfillDealRow[]> {
  const rows: BackfillDealRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('deals')
      .select('id, company_id, customer_name, stage, source, price, project_config')
      .or('price.is.null,price.eq.0')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const batch = (data ?? []) as BackfillDealRow[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return rows
}

async function loadOffers(sb: SupabaseClient, dealIds: string[]): Promise<BackfillOfferRow[]> {
  const rows: BackfillOfferRow[] = []
  for (let i = 0; i < dealIds.length; i += OFFER_CHUNK) {
    const { data, error } = await sb
      .from('offers')
      .select('id, deal_id, offer_number, final_price, approved, approved_at, created_at')
      .in('deal_id', dealIds.slice(i, i + OFFER_CHUNK))
    if (error) throw error
    rows.push(...((data ?? []) as BackfillOfferRow[]))
  }
  return rows
}

function fmt(n: number): string {
  return n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

async function rollback(sb: SupabaseClient) {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(`No snapshot at ${SNAPSHOT_PATH}; nothing to roll back.`)
    process.exitCode = 1
    return
  }
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as SnapshotFile
  let restored = 0
  for (const row of snapshot.rows) {
    const { error } = await sb
      .from('deals')
      .update({ price: row.price, project_config: row.project_config })
      .eq('id', row.id)
    if (error) throw new Error(`restore failed for deal ${row.id}: ${error.message}`)
    restored += 1
  }
  console.log(`Restored ${restored} deals from ${SNAPSHOT_PATH} (snapshot of ${snapshot.createdAt}).`)
  console.log('The snapshot file was kept; delete it by hand before another --apply.')
}

async function main() {
  const apply = process.argv.includes('--apply')
  const doRollback = process.argv.includes('--rollback')
  if (apply && doRollback) throw new Error('Use either --apply or --rollback, not both.')
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (apps/crm/.env.local).')
  const sb = createClient(url, key, { db: { schema: 'public' } })

  if (doRollback) {
    await rollback(sb)
    return
  }

  const deals = await loadDealsWithoutAmount(sb)
  const offers = await loadOffers(
    sb,
    deals.map((d) => d.id),
  )
  const plan = buildBackfillPlan(deals, offers)

  console.log(`deals without amount: ${deals.length}`)
  console.log(`  with an offer (proposed below): ${plan.rows.length}`)
  console.log(`  without any priced offer: ${plan.dealsWithoutOffer}`)
  console.log(`  hidden quick-offer deals (left out): ${plan.skippedHidden}`)
  console.log('deal\tcustomer\tstage\toffers\toffer\tsigned\tproposed amount')
  for (const row of plan.rows) {
    console.log(
      [
        row.dealId,
        (row.customerName ?? '').replace(/\t/g, ' '),
        row.stage ?? '—',
        row.offerCount,
        row.offerNumber ?? row.offerId.slice(0, 8),
        row.approved ? 'yes' : 'no',
        fmt(row.proposedAmount),
      ].join('\t'),
    )
  }

  if (!apply) {
    console.log('\nDry run: nothing was written. Re-run with --apply to write (a rollback snapshot is saved first).')
    return
  }

  if (existsSync(SNAPSHOT_PATH)) {
    throw new Error(`Snapshot ${SNAPSHOT_PATH} already exists; refusing to overwrite it. Roll back or delete it first.`)
  }
  if (plan.rows.length === 0) {
    console.log('Nothing to write.')
    return
  }

  const byId = new Map(deals.map((d) => [d.id, d]))
  const snapshot: SnapshotFile = {
    createdAt: new Date().toISOString(),
    rows: plan.rows.map((row) => {
      const d = byId.get(row.dealId) as BackfillDealRow
      return { id: d.id, price: d.price, project_config: d.project_config }
    }),
  }
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2))
  console.log(`Snapshot saved: ${SNAPSHOT_PATH}`)

  const nowIso = new Date().toISOString()
  let written = 0
  for (const row of plan.rows) {
    const d = byId.get(row.dealId) as BackfillDealRow
    const patch = buildBackfillPatch(row, d.project_config, nowIso)
    // Only a deal whose price is still empty is touched, even if it changed since the report.
    const { data, error } = await sb
      .from('deals')
      .update(patch)
      .eq('id', row.dealId)
      .or('price.is.null,price.eq.0')
      .select('id')
    if (error) throw new Error(`update failed for deal ${row.dealId}: ${error.message}`)
    if (data && data.length > 0) written += 1
    else console.warn(`skipped deal ${row.dealId}: price is no longer empty`)
  }
  console.log(`Wrote ${written} of ${plan.rows.length} deals.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
