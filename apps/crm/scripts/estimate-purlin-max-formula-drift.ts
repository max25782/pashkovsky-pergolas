/**
 * Read-only: compare current auto purlin divider positions vs Max equal-clear formula.
 * Does NOT write to the database.
 *
 * usage (from apps/crm):
 *   npx tsx scripts/estimate-purlin-max-formula-drift.ts
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildTopPlanDimensionModel,
  computeFrame,
  contourRangeAlongLamellaDir,
  dividerPositionsForMaxEqualClears,
  profilePlanWidthMm,
  resolvePlanPurlinLines,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { PlanConstructionParams, Point2D } from '@pashkovsky/pergola-core'
import { pieceAxis } from '@pashkovsky/pergola-core'

config({ path: resolve(__dirname, '../.env.local') })

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

interface PlanMeta {
  planPolygon?: Array<{ x: number; y: number }>
  planParams?: PlanConstructionParams
  planWallIndices?: number[]
}

function beamsToSides(beams: ReturnType<typeof computeFrame>['beams']) {
  return beams.map((b) => {
    const { start, end } = pieceAxis(b)
    return { id: b.id, start, end }
  })
}

function centroidOf(points: Point2D[]): Point2D {
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

async function main() {
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot query saved offers.')
    process.exit(1)
  }

  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('offers')
    .select('id, offer_number, configurator_meta')
    .not('configurator_meta', 'is', null)
    .limit(5000)

  if (error) throw error

  const profiles = PERGOLA_CONSTRUCTION_PROFILES
  let scanned = 0
  let eligible = 0
  let wouldMove = 0
  let maxDeltaMm = 0
  const samples: Array<{ id: string; offerNumber: string | null; maxDeltaMm: number; n: number }> = []

  for (const row of data ?? []) {
    scanned++
    const meta = row.configurator_meta as PlanMeta | null
    const polygon = meta?.planPolygon
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, ...meta?.planParams }
    if (!polygon || polygon.length < 3) continue
    if (params.purlinDividers?.mode === 'manual') continue

    const contour: Point2D[] = polygon.map((p) => [p.x, p.y])
    const wallEdgeIndices = meta?.planWallIndices ?? []
    const current = resolvePlanPurlinLines(contour, params, profiles)
    if (current.length === 0) continue

    eligible++
    const spec = specFromPlan({ contour, wallEdgeIndices, params })
    const frame = computeFrame(spec, profiles)
    const sides = beamsToSides(frame.beams)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles,
      beamProfileId: params.beamProfileId,
      centroid: centroidOf(contour),
      contourVertices: contour,
      lamellaDirectionDeg: params.lamellaDirectionDeg,
      dividerPositions: current,
    })
    const parallelOuter = model.purlinClearVerification?.outerLengthMm
    if (parallelOuter == null) continue

    const range = contourRangeAlongLamellaDir(contour, params.lamellaDirectionDeg)
    const beamW = profilePlanWidthMm(profiles, params.beamProfileId)
    const proposed = dividerPositionsForMaxEqualClears({
      rangeMinMm: range.minMm,
      rangeMaxMm: range.maxMm,
      outerLengthMm: parallelOuter,
      endBeamPlanWidthMm: beamW,
      dividerCount: current.length,
    })

    let rowMax = 0
    for (let i = 0; i < current.length; i++) {
      const d = Math.abs(current[i].positionMm - proposed[i].positionMm)
      rowMax = Math.max(rowMax, d)
    }
    maxDeltaMm = Math.max(maxDeltaMm, rowMax)
    if (rowMax > 1) {
      wouldMove++
      if (samples.length < 15) {
        samples.push({
          id: row.id,
          offerNumber: (row as { offer_number?: string }).offer_number ?? null,
          maxDeltaMm: Math.round(rowMax * 10) / 10,
          n: current.length,
        })
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        scannedOffers: scanned,
        eligibleAutoPlansWithDividers: eligible,
        plansWithDividerShiftOver1mm: wouldMove,
        maxDividerPositionDeltaMm: Math.round(maxDeltaMm * 10) / 10,
        sampleWorst: samples,
        proposedRollout:
          'Add planParams.purlinDividerPlacement: "legacy-auto" | "max-equal-clear" (default legacy for existing saves; new offers use max-equal-clear after Max confirms).',
        formulaNote:
          'clear = (L_outer - 2*w_end - n*40)/(n+1); positions derived from actual L_outer on lamella-parallel side.',
        equalClearAtMaxDeltaExample: eligible > 0
          ? {
              note: 'If all eligible used Max formula today, worst single-divider shift above.',
            }
          : null,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
