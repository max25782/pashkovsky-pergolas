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
    heightMm: z.number().finite().positive(),
    lamellaAngleDeg: z.union([z.literal(0), z.literal(45)]),
    colorHex: z.string(),
    supportType: z.enum(['free-standing', 'wall-mounted', 'hanging']),
    slope: z.object({
      mode: z.enum(['deg', 'percent', 'dropCm']),
      value: z.number().finite(),
    }),
    highEdgeIndex: z.number().int().nonnegative(),
    postMaxSpanMm: z.number().finite().positive().optional(),
    postHeightOverridesMm: z.record(z.string(), z.number().finite()),
    lamellaWallThicknessMm: z.number().refine((n): n is 0.8 | 1.6 | 1 => n === 0.8 || n === 1.6 || n === 1),
    purlinDividers: z.object({
      mode: z.enum(['auto', 'manual']),
      lines: z.array(z.object({
        id: z.string().min(1),
        positionMm: z.number().finite(),
      })).optional(),
    }),
    measuredOuterLengthMmByEdgeIndex: z
      .array(z.number().finite().positive().nullable())
      .optional(),
    purlinClearLayoutVersion: z.literal(1).optional(),
    lamellaSectionLayoutVersion: z.literal(1).optional(),
    purlinMaxSpanMm: z.number().finite().positive().optional(),
    wingShelfProfileId: z.string().optional(),
    wallBeamWidthVersion: z.literal(1).optional(),
    wallProfileId: z.enum(['f10040', 'pa1162']).optional(),
    skewSectionVersion: z.literal(1).optional(),
    lamellaLengthStepMm: z.number().finite().positive().optional(),
  })
  .partial()

const supportBeamSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('straight'),
  anchorMm: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  directionDeg: z.number().finite().optional(),
  profileId: z.string().min(1),
  widthMm: z.number().finite().positive().optional(),
  start: z.object({
    purlinId: z.string().min(1),
    face: z.enum(['low', 'high']),
  }),
  end: z.object({
    kind: z.literal('outer-contour'),
  }),
})

const supportBeamsDocumentSchema = z.object({
  formatVersion: z.literal(1),
  beams: z.array(supportBeamSchema).min(1),
})

export const pergolaPlanBodySchema = z
  .object({
    schemaVersion: z.literal(PERGOLA_PLAN_SCHEMA_VERSION).optional(),
    polygon: z.array(planPointSchema).min(3).max(200),
    wallIndices: z.array(z.number().int().nonnegative()),
    params: planParamsSchema.optional(),
    confirmed: z.literal(true, {
      errorMap: () => ({ message: 'Pergola drawing must be confirmed before submit' }),
    }),
    supportBeams: supportBeamsDocumentSchema.optional(),
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
    params: (() => {
      const {
        postMaxSpanMm: _omit,
        purlinClearLayoutVersion: _omitLayout,
        lamellaSectionLayoutVersion: _omitSections,
        purlinMaxSpanMm: _omitPurlinMax,
        wingShelfProfileId: _omitShelf,
        wallBeamWidthVersion: _omitWallWidth,
        wallProfileId: _omitWallProfile,
        skewSectionVersion: _omitSkew,
        lamellaLengthStepMm: _omitStep,
        ...legacyDefaults
      } = DEFAULT_PLAN_CONSTRUCTION_PARAMS
      const incoming = parsed.data.params ?? {}
      return {
        ...legacyDefaults,
        ...incoming,
        ...('postMaxSpanMm' in incoming
          ? { postMaxSpanMm: incoming.postMaxSpanMm }
          : { postMaxSpanMm: DEFAULT_PLAN_CONSTRUCTION_PARAMS.postMaxSpanMm }),
        ...('purlinClearLayoutVersion' in incoming
          ? { purlinClearLayoutVersion: incoming.purlinClearLayoutVersion }
          : {}),
        ...('lamellaSectionLayoutVersion' in incoming
          ? { lamellaSectionLayoutVersion: incoming.lamellaSectionLayoutVersion }
          : { lamellaSectionLayoutVersion: DEFAULT_PLAN_CONSTRUCTION_PARAMS.lamellaSectionLayoutVersion }),
        ...('purlinMaxSpanMm' in incoming
          ? { purlinMaxSpanMm: incoming.purlinMaxSpanMm }
          : {}),
        ...('wingShelfProfileId' in incoming && incoming.wingShelfProfileId
          ? { wingShelfProfileId: incoming.wingShelfProfileId }
          : {}),
        ...('wallBeamWidthVersion' in incoming
          ? { wallBeamWidthVersion: incoming.wallBeamWidthVersion, wallProfileId: incoming.wallProfileId }
          : {
              wallBeamWidthVersion: DEFAULT_PLAN_CONSTRUCTION_PARAMS.wallBeamWidthVersion,
              wallProfileId: DEFAULT_PLAN_CONSTRUCTION_PARAMS.wallProfileId,
            }),
        ...('skewSectionVersion' in incoming
          ? { skewSectionVersion: incoming.skewSectionVersion }
          : {}),
        ...('lamellaLengthStepMm' in incoming
          ? { lamellaLengthStepMm: incoming.lamellaLengthStepMm }
          : {}),
      }
    })(),
  }

  const normalized = parsePergolaPlan(merged)
  if (!normalized) {
    return { ok: false, error: 'Invalid pergola plan' }
  }

  return { ok: true, plan: normalized }
}
