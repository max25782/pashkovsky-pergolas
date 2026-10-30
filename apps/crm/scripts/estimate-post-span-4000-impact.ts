/**
 * Read-only: how many saved plans would gain posts if postMaxSpanMm became 4000.
 * Does NOT write. Does not migrate.
 *
 * usage (from apps/crm):
 *   npx tsx scripts/estimate-post-span-4000-impact.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  computeFrame,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { PlanConstructionParams, Point2D } from '@pashkovsky/pergola-core'
import { parsePergolaPlan } from '../lib/pergolas/normalize-pergola'

config({ path: resolve(__dirname, '../.env.local') })

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const NEW_SPAN = 4000

function postCount(contour: Point2D[], wallEdgeIndices: number[], params: PlanConstructionParams, postMaxSpanMm?: number) {
  const spec = specFromPlan({ contour, wallEdgeIndices, params })
  if (postMaxSpanMm != null) spec.postMaxSpanMm = postMaxSpanMm
  else delete spec.postMaxSpanMm
  return computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES).posts.length
}

async function main() {
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot query saved offers.')
    process.exit(1)
  }

  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('offers')
    .select('id, offer_number, pergolas_data')
    .not('pergolas_data', 'is', null)
    .limit(5000)

  if (error) throw error

  let scannedPlans = 0
  let skipped = 0
  let wouldGain = 0
  let maxGain = 0
  const samples: Array<{ id: string; offerNumber: string | null; gain: number; oldPosts: number; newPosts: number }> = []

  for (const row of data ?? []) {
    const pergolas = Array.isArray(row.pergolas_data) ? row.pergolas_data : []
    for (const raw of pergolas) {
      const plan = parsePergolaPlan((raw as { plan?: unknown })?.plan)
      if (!plan || plan.polygon.length < 3) {
        skipped++
        continue
      }
      scannedPlans++
      const contour: Point2D[] = plan.polygon.map((p) => [p.x, p.y])
      try {
        const oldN = postCount(contour, plan.wallIndices, plan.params)
        const newN = postCount(contour, plan.wallIndices, plan.params, NEW_SPAN)
        const gain = newN - oldN
        if (gain > 0) {
          wouldGain++
          if (gain > maxGain) maxGain = gain
          if (samples.length < 12) {
            samples.push({
              id: row.id,
              offerNumber: row.offer_number,
              gain,
              oldPosts: oldN,
              newPosts: newN,
            })
          }
        }
      } catch {
        skipped++
      }
    }
  }

  console.log(JSON.stringify({
    scannedOffers: data?.length ?? 0,
    scannedPlans,
    skipped,
    plansThatWouldGainPosts: wouldGain,
    maxExtraPostsOnOnePlan: maxGain,
    sampleGains: samples,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
