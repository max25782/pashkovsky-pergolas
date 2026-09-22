import { z } from 'zod'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  isSimplePolygon,
  PERGOLA_PLAN_SCHEMA_VERSION,
  polygonAreaM2,
} from '@pashkovsky/pergola-core'
import type { PergolaPlan } from '@/types/offer'
import { parsePergolaPlan } from '@/lib/pergolas/normalize-pergola'

const COORD_MAX_MM = 100_000

const planPointSchema = z.object({
  x: z.number().finite().min(-COORD_MAX_MM).max(COORD_MAX_MM),
  y: z.number().finite().min(-COORD_MAX_MM).max(COORD_MAX_MM),
})

const planParamsSchema = z
  .object({
    lamellaPatternId: z.string(),
    lamellaGapMm: z.number().finite(),
    lamellaDirectionDeg: z.number().finite(),
    lamellaOnEdge: z.boolean(),
    beamProfileId: z.string(),
    purlinProfileId: z.string(),
    postProfileId: z.string(),
    visturMode: z.boolean(),
  })
  .partial()

export const pergolaPlanBodySchema = z
  .object({
    schemaVersion: z.literal(PERGOLA_PLAN_SCHEMA_VERSION).optional(),
    polygon: z.array(planPointSchema).min(3).max(200),
    wallIndices: z.array(z.number().int().nonnegative()),
    params: planParamsSchema.optional(),
    confirmed: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const area = polygonAreaM2(data.polygon)
    if (area <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plan polygon area must be greater than zero',
        path: ['polygon'],
      })
    }
    if (!isSimplePolygon(data.polygon)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plan polygon must not self-intersect',
        path: ['polygon'],
      })
    }
  })

export type PergolaPlanValidationResult =
  | { ok: true; plan: PergolaPlan }
  | { ok: false; error: string }

export function validatePergolaPlanForApi(plan: unknown): PergolaPlanValidationResult {
  const parsed = pergolaPlanBodySchema.safeParse(plan)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Invalid pergola plan' }
  }

  const merged = {
    ...parsed.data,
    schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
    params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, ...parsed.data.params },
  }

  const normalized = parsePergolaPlan(merged)
  if (!normalized) {
    return { ok: false, error: 'Invalid pergola plan' }
  }

  return { ok: true, plan: normalized }
}
