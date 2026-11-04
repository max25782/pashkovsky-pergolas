import {
  canonicalProfileId,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  isSimplePolygon,
  parseLamellaWallThicknessMm,
  parseMeasuredOuterLengthMmByEdgeIndex,
  parseSupportBeamsDocument,
  pickPergolaPlanExtras,
  pinContourReferenceOnParams,
  PERGOLA_PLAN_SCHEMA_VERSION,
  polygonAreaM2,
  type PlanConstructionParams,
  type Point2D,
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
    const {
      postMaxSpanMm: _omit,
      lamellaSectionLayoutVersion: _omitSections,
      wallBeamWidthVersion: _omitWallWidth,
      wallProfileId: _omitWallProfile,
      frameJointVersion: _omitJoints,
      skewSectionVersion: _omitSkew,
      lamellaLengthStepMm: _omitStep,
      ...legacy
    } = DEFAULT_PLAN_CONSTRUCTION_PARAMS
    return legacy
  }
  const o = raw as Record<string, unknown>
  const {
    postMaxSpanMm: _omit,
    purlinClearLayoutVersion: _omitLayout,
    lamellaSectionLayoutVersion: _omitSections,
    purlinMaxSpanMm: _omitPurlinMax,
    wingShelfProfileId: _omitShelfProfile,
    wallBeamWidthVersion: _omitWallWidth,
    wallProfileId: _omitWallProfile,
    frameJointVersion: _omitJoints,
    skewSectionVersion: _omitSkew,
    lamellaLengthStepMm: _omitStep,
    ...legacyDefaults
  } = DEFAULT_PLAN_CONSTRUCTION_PARAMS
  const base: PlanConstructionParams = { ...legacyDefaults }
  if (typeof o.lamellaPatternId === 'string') base.lamellaPatternId = o.lamellaPatternId
  if (isFiniteNumber(o.lamellaGapMm)) base.lamellaGapMm = o.lamellaGapMm as number
  if (isFiniteNumber(o.lamellaDirectionDeg)) base.lamellaDirectionDeg = o.lamellaDirectionDeg as number
  if (typeof o.lamellaOnEdge === 'boolean') base.lamellaOnEdge = o.lamellaOnEdge
  if (typeof o.beamProfileId === 'string') base.beamProfileId = canonicalProfileId(o.beamProfileId)
  if (typeof o.purlinProfileId === 'string') base.purlinProfileId = o.purlinProfileId
  if (typeof o.postProfileId === 'string') base.postProfileId = canonicalProfileId(o.postProfileId)
  if (typeof o.visturMode === 'boolean') base.visturMode = o.visturMode
  if (isFiniteNumber(o.heightMm) && (o.heightMm as number) > 0) base.heightMm = o.heightMm as number
  if (o.lamellaAngleDeg === 0 || o.lamellaAngleDeg === 45) base.lamellaAngleDeg = o.lamellaAngleDeg
  if (typeof o.colorHex === 'string' && o.colorHex.length > 0) base.colorHex = o.colorHex
  if (o.supportType === 'free-standing' || o.supportType === 'wall-mounted' || o.supportType === 'hanging') {
    base.supportType = o.supportType
  }
  if (o.slope && typeof o.slope === 'object') {
    const s = o.slope as Record<string, unknown>
    if ((s.mode === 'deg' || s.mode === 'percent' || s.mode === 'dropCm') && isFiniteNumber(s.value)) {
      base.slope = { mode: s.mode, value: s.value as number }
    }
  }
  if (typeof o.highEdgeIndex === 'number' && Number.isInteger(o.highEdgeIndex) && o.highEdgeIndex >= 0) {
    base.highEdgeIndex = o.highEdgeIndex
  }
  if (o.postHeightOverridesMm && typeof o.postHeightOverridesMm === 'object') {
    const rec: Record<string, number> = {}
    for (const [key, value] of Object.entries(o.postHeightOverridesMm as Record<string, unknown>)) {
      if (isFiniteNumber(value)) rec[key] = value as number
    }
    base.postHeightOverridesMm = rec
  }
  const wallThickness = parseLamellaWallThicknessMm(o.lamellaWallThicknessMm)
  if (wallThickness !== undefined) base.lamellaWallThicknessMm = wallThickness
  if (o.purlinDividers && typeof o.purlinDividers === 'object') {
    const d = o.purlinDividers as Record<string, unknown>
    if (d.mode === 'auto' || d.mode === 'manual') {
      const lines: Array<{ id: string; positionMm: number }> = []
      if (Array.isArray(d.lines)) {
        for (const rawLine of d.lines) {
          if (!rawLine || typeof rawLine !== 'object') continue
          const line = rawLine as Record<string, unknown>
          if (typeof line.id === 'string' && line.id.length > 0 && isFiniteNumber(line.positionMm)) {
            lines.push({ id: line.id, positionMm: line.positionMm as number })
          }
        }
      }
      base.purlinDividers = d.mode === 'manual' ? { mode: 'manual', lines } : { mode: 'auto' }
    }
  }
  if (isFiniteNumber(o.postMaxSpanMm) && (o.postMaxSpanMm as number) > 0) {
    base.postMaxSpanMm = o.postMaxSpanMm as number
  } else {
    delete base.postMaxSpanMm
  }
  const measured = parseMeasuredOuterLengthMmByEdgeIndex(o.measuredOuterLengthMmByEdgeIndex)
  if (measured) base.measuredOuterLengthMmByEdgeIndex = measured
  else delete base.measuredOuterLengthMmByEdgeIndex
  if (o.contourReference === 'outer-faces' || o.contourReference === 'centerline') {
    base.contourReference = o.contourReference
  } else {
    delete base.contourReference
  }
  if (o.purlinClearLayoutVersion === 1) base.purlinClearLayoutVersion = 1
  else delete base.purlinClearLayoutVersion
  if (o.lamellaSectionLayoutVersion === 1) base.lamellaSectionLayoutVersion = 1
  else delete base.lamellaSectionLayoutVersion
  if (isFiniteNumber(o.purlinMaxSpanMm) && (o.purlinMaxSpanMm as number) > 0) {
    base.purlinMaxSpanMm = o.purlinMaxSpanMm as number
  } else {
    delete base.purlinMaxSpanMm
  }
  if (typeof o.wingShelfProfileId === 'string' && o.wingShelfProfileId.length > 0) {
    base.wingShelfProfileId = canonicalProfileId(o.wingShelfProfileId)
  } else {
    delete base.wingShelfProfileId
  }
  if (o.wallBeamWidthVersion === 1) {
    base.wallBeamWidthVersion = 1
    // Read-time alias only (f12040 -> pa1162); the stored plan is not rewritten.
    const wallId = typeof o.wallProfileId === 'string' ? canonicalProfileId(o.wallProfileId) : o.wallProfileId
    if (wallId === 'f10040' || wallId === 'pa1162') {
      base.wallProfileId = wallId
    } else {
      base.wallProfileId = 'f10040'
    }
  } else {
    delete base.wallBeamWidthVersion
    delete base.wallProfileId
  }
  if (o.frameJointVersion === 1) base.frameJointVersion = 1
  else delete base.frameJointVersion
  if (o.skewSectionVersion === 1) base.skewSectionVersion = 1
  else delete base.skewSectionVersion
  if (isFiniteNumber(o.lamellaLengthStepMm) && (o.lamellaLengthStepMm as number) > 0) {
    base.lamellaLengthStepMm = o.lamellaLengthStepMm as number
  } else {
    delete base.lamellaLengthStepMm
  }
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

  // Keep raw supportBeams even when the document fails parse (warnings handle it).
  // Also preserve unknown top-level keys for forward-compatible round-trips.
  const extras = pickPergolaPlanExtras(o)
  const hasSupportBeamsKey = Object.prototype.hasOwnProperty.call(o, 'supportBeams')
  const parsedBeams = parseSupportBeamsDocument(o.supportBeams)
  const contour: Point2D[] = polygon.map((p) => [p.x, p.y])
  // Pin missing contourReference to the rule that currently applies (no silent flip later).
  const params = pinContourReferenceOnParams(contour, parseParams(o.params))
  const plan: PergolaPlan = {
    ...extras,
    schemaVersion,
    polygon,
    wallIndices,
    params,
    confirmed: o.confirmed === true,
    ...(hasSupportBeamsKey
      ? { supportBeams: (parsedBeams ?? o.supportBeams) as PergolaPlan['supportBeams'] }
      : {}),
  }
  return plan
}

function normalizeShape(raw: unknown): PergolaShape | null {
  if (raw && typeof raw === 'object' && 'type' in raw) {
    return raw as PergolaShape
  }
  return null
}

/**
 * Unit price when reading a pergola.
 * A missing key is the historical default (750) used only for old rows that never stored a price.
 * Explicit empty, null, or 0 means the pergola has no price line. Do not invent 750.
 */
export function normalizePergolaUnitPrice(raw: unknown): number {
  if (raw === undefined) return 750
  if (raw === null || (typeof raw === 'string' && raw.trim() === '')) return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/**
 * Single boundary when reading `pergolas_data` or API payloads into `Pergola`.
 * Missing / broken `plan` → `plan: null`.
 */
export function normalizePergola(raw: unknown): Pergola {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const pricePerSqm = normalizePergolaUnitPrice(o.pricePerSqm)

  const heightRaw = o.height != null ? Number(o.height) : undefined
  const height =
    heightRaw !== undefined && Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : undefined

  // ── Per-pergola addon fields ──────────────────────────────────────────────
  // These must be preserved — losing them causes the PDF to silently fall back
  // to offer-level defaults, giving wrong prices on saved offers.
  const santafRaw = o.santaf && typeof o.santaf === 'object' ? (o.santaf as Record<string, unknown>) : null
  const santaf = santafRaw != null ? {
    enabled: Boolean(santafRaw.enabled),
    pricePerSqm: Number(santafRaw.pricePerSqm) || 200,
  } : undefined

  const drainageRaw = o.drainage && typeof o.drainage === 'object' ? (o.drainage as Record<string, unknown>) : null
  const drainage = drainageRaw != null ? {
    enabled: Boolean(drainageRaw.enabled),
    pricePerMeter: Number(drainageRaw.pricePerMeter) || 500,
    runningMeters: drainageRaw.runningMeters != null ? Number(drainageRaw.runningMeters) : undefined,
  } : undefined

  const lightingRaw = o.lighting && typeof o.lighting === 'object' ? (o.lighting as Record<string, unknown>) : null
  const lighting = lightingRaw != null ? {
    enabled: Boolean(lightingRaw.enabled),
    pricePerMeter: Number(lightingRaw.pricePerMeter) || 200,
    runningMeters: lightingRaw.runningMeters != null ? Number(lightingRaw.runningMeters) : undefined,
  } : undefined

  return {
    plan: parsePergolaPlan(o.plan),
    shape: normalizeShape(o.shape),
    pergolaType: o.pergolaType as PergolaProductType | undefined,
    height,
    location: typeof o.location === 'string' && o.location.trim() !== '' ? o.location : undefined,
    pricePerSqm,
    width: o.width != null && Number.isFinite(Number(o.width)) ? Number(o.width) : undefined,
    length: o.length != null && Number.isFinite(Number(o.length)) ? Number(o.length) : undefined,
    santaf,
    drainage,
    lighting,
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
