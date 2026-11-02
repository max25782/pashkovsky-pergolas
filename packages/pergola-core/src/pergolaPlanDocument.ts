/**
 * Round-trip helpers for `Pergola.plan` jsonb documents.
 * Typed fields are validated; every other top-level key is preserved as-is
 * so a newer editor writing `supportBeams` (or future fields) is not stripped
 * by an older save path that only knew polygon/params.
 */

import type { PlanConstructionParams } from './planDefaults'
import type { SupportBeamsDocument } from './supportBeams'
import { PERGOLA_PLAN_SCHEMA_VERSION } from './planDefaults'

export const PERGOLA_PLAN_KNOWN_KEYS = [
  'schemaVersion',
  'polygon',
  'wallIndices',
  'params',
  'confirmed',
  'supportBeams',
] as const

export type PergolaPlanKnownKey = (typeof PERGOLA_PLAN_KNOWN_KEYS)[number]

/** Opaque top-level keys not in the typed plan schema. */
export type PergolaPlanExtras = Record<string, unknown>

export interface PergolaPlanCoreFields {
  schemaVersion: typeof PERGOLA_PLAN_SCHEMA_VERSION
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
  confirmed: boolean
  supportBeams?: SupportBeamsDocument | unknown
}

function isKnownKey(key: string): key is PergolaPlanKnownKey {
  return (PERGOLA_PLAN_KNOWN_KEYS as readonly string[]).includes(key)
}

/** Copy unknown top-level keys from a previous plan object. */
export function pickPergolaPlanExtras(
  prev: Record<string, unknown> | null | undefined,
): PergolaPlanExtras {
  if (!prev || typeof prev !== 'object') return {}
  const extras: PergolaPlanExtras = {}
  for (const [key, value] of Object.entries(prev)) {
    if (!isKnownKey(key)) extras[key] = value
  }
  return extras
}

/**
 * Build a plan document for storage / API round-trip.
 * Always spreads `extras` first, then typed fields (typed wins on collision).
 * `supportBeams: null` clears the field; `undefined` keeps `prevSupportBeams`.
 */
export function mergePergolaPlanDocument(input: {
  extras?: PergolaPlanExtras
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
  confirmed?: boolean
  supportBeams?: SupportBeamsDocument | unknown | null
  prevSupportBeams?: SupportBeamsDocument | unknown
}): Record<string, unknown> {
  const {
    extras = {},
    polygon,
    wallIndices,
    params,
    confirmed = false,
    supportBeams,
    prevSupportBeams,
  } = input
  const nextBeams =
    supportBeams === null
      ? undefined
      : supportBeams !== undefined
        ? supportBeams
        : prevSupportBeams
  const doc: Record<string, unknown> = {
    ...extras,
    schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
    polygon,
    wallIndices,
    params,
    confirmed,
  }
  if (nextBeams !== undefined) doc.supportBeams = nextBeams
  return doc
}

/** Flatten a typed plan (+ optional extras) into a plain jsonb object. */
export function serializePergolaPlan(
  plan: PergolaPlanCoreFields,
  extras?: PergolaPlanExtras,
): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    ...(extras ?? {}),
    schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
    polygon: plan.polygon,
    wallIndices: plan.wallIndices,
    params: plan.params,
    confirmed: plan.confirmed,
  }
  if (plan.supportBeams !== undefined) doc.supportBeams = plan.supportBeams
  return doc
}
