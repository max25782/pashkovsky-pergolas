import { PERGOLA_PLAN_SCHEMA_VERSION, type PlanConstructionParams } from '@pashkovsky/pergola-core'

export interface PlanExportInput {
  polygon: Array<{ x: number; y: number }>
  /** Edge indices of the wall sides (stored as `wallIndices` in the plan document). */
  wallIndices: number[]
  params: PlanConstructionParams
  supportBeams?: unknown
}

/**
 * Plan document as the editor would save it, made explicit for hand-off:
 * `lamellaDirectionDeg` and `lamellaZones` are always present in `params`
 * (0 / [] when unset) so a pasted plan shows them even when nothing was changed.
 * The result can be loaded back through `parsePergolaPlan` unchanged.
 */
export function buildPlanExportDocument(input: PlanExportInput): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
    polygon: input.polygon,
    wallIndices: input.wallIndices,
    params: {
      ...input.params,
      lamellaDirectionDeg: input.params.lamellaDirectionDeg ?? 0,
      lamellaZones: input.params.lamellaZones ?? [],
    },
  }
  if (input.supportBeams !== undefined && input.supportBeams !== null) {
    doc.supportBeams = input.supportBeams
  }
  return doc
}

export function buildPlanExportJson(input: PlanExportInput): string {
  return JSON.stringify(buildPlanExportDocument(input), null, 2)
}

/** Clipboard write with the legacy textarea fallback for non-secure contexts. */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  if (!ok) throw new Error('clipboard unavailable')
}
