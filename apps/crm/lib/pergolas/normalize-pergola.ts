import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  isSimplePolygon,
  PERGOLA_PLAN_SCHEMA_VERSION,
  polygonAreaM2,
  type PlanConstructionParams,
} from '@pashkovsky/pergola-core'
import type {
  Pergola,
  PergolaPlan,
  PergolaPlanPointMm,
  PergolaProductType,
  PergolaShape,
} from '@/types/offer'

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseParams(raw: unknown): PlanConstructionParams {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS }
  }
  const o = raw as Record<string, unknown>
  const base = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS }
  if (typeof o.lamellaPatternId === 'string') base.lamellaPatternId = o.lamellaPatternId
  if (isFiniteNumber(o.lamellaGapMm)) base.lamellaGapMm = o.lamellaGapMm as number
  if (isFiniteNumber(o.lamellaDirectionDeg)) base.lamellaDirectionDeg = o.lamellaDirectionDeg as number
  if (typeof o.lamellaOnEdge === 'boolean') base.lamellaOnEdge = o.lamellaOnEdge
  if (typeof o.beamProfileId === 'string') base.beamProfileId = o.beamProfileId
  if (typeof o.purlinProfileId === 'string') base.purlinProfileId = o.purlinProfileId
  if (typeof o.postProfileId === 'string') base.postProfileId = o.postProfileId
  if (typeof o.visturMode === 'boolean') base.visturMode = o.visturMode
  return base
}

function parsePolygon(raw: unknown): PergolaPlanPointMm[] | null {
  if (!Array.isArray(raw) || raw.length < 3) return null
  const polygon: PergolaPlanPointMm[] = []
  for (const pt of raw) {
    if (!pt || typeof pt !== 'object') return null
    const p = pt as Record<string, unknown>
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return null
    polygon.push({ x: p.x as number, y: p.y as number })
  }
  return polygon
}

/** Validate stored / incoming plan JSON; invalid → null (not thrown). */
export function parsePergolaPlan(raw: unknown): PergolaPlan | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') return null

  const o = raw as Record<string, unknown>
  const polygon = parsePolygon(o.polygon)
  if (!polygon || polygon.length < 3) return null
  if (polygonAreaM2(polygon) <= 0) return null
  if (!isSimplePolygon(polygon)) return null

  const wallIndices: number[] = []
  if (Array.isArray(o.wallIndices)) {
    for (const wi of o.wallIndices) {
      if (typeof wi === 'number' && Number.isInteger(wi) && wi >= 0) {
        wallIndices.push(wi)
      }
    }
  }

  const schemaVersion =
    o.schemaVersion === PERGOLA_PLAN_SCHEMA_VERSION ? PERGOLA_PLAN_SCHEMA_VERSION : PERGOLA_PLAN_SCHEMA_VERSION

  return {
    schemaVersion,
    polygon,
    wallIndices,
    params: parseParams(o.params),
    confirmed: o.confirmed === true,
  }
}

function normalizeShape(raw: unknown): PergolaShape | null {
  if (raw && typeof raw === 'object' && 'type' in raw) {
    return raw as PergolaShape
  }
  return null
}

/**
 * Single boundary when reading `pergolas_data` or API payloads into `Pergola`.
 * Missing / broken `plan` → `plan: null`.
 */
export function normalizePergola(raw: unknown): Pergola {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const priceRaw = Number(o.pricePerSqm)
  const pricePerSqm = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : 750

  const heightRaw = o.height != null ? Number(o.height) : undefined
  const height =
    heightRaw !== undefined && Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : undefined

  return {
    plan: parsePergolaPlan(o.plan),
    shape: normalizeShape(o.shape),
    pergolaType: o.pergolaType as PergolaProductType | undefined,
    height,
    location: typeof o.location === 'string' && o.location.trim() !== '' ? o.location : undefined,
    pricePerSqm,
    width: o.width != null && Number.isFinite(Number(o.width)) ? Number(o.width) : undefined,
    length: o.length != null && Number.isFinite(Number(o.length)) ? Number(o.length) : undefined,
  }
}

export function normalizePergolas(raw: unknown): Pergola[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  return raw.map((item) => normalizePergola(item))
}

export function legacyPergolaFromOfferColumns(row: {
  pergola_shape_data?: unknown
  pergola_width?: number | null
  pergola_length?: number | null
  pergola_height?: number | null
  pergola_location?: string | null
  pergola_price_per_sqm?: number | null
}): Pergola {
  return normalizePergola({
    plan: undefined,
    shape: row.pergola_shape_data
      ? row.pergola_shape_data
      : {
          type: 'rectangle',
          width: row.pergola_width || 0,
          length: row.pergola_length || 0,
        },
    height: row.pergola_height ?? undefined,
    location: row.pergola_location ?? undefined,
    pricePerSqm: row.pergola_price_per_sqm ?? 750,
    width: row.pergola_width ?? undefined,
    length: row.pergola_length ?? undefined,
  })
}
