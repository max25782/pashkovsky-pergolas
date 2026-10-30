import type { PlanConstructionParams } from '@pashkovsky/pergola-core'

export const DEBUG_PLAN_STORAGE_KEY = 'alumincrm.debug-plan-editor.v1'

export interface DebugPlanDocument {
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
}

export function readDebugPlanDocument(): DebugPlanDocument | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(DEBUG_PLAN_STORAGE_KEY)
  if (!raw) return null
  const parsed = JSON.parse(raw) as DebugPlanDocument
  if (!parsed || !Array.isArray(parsed.polygon) || parsed.polygon.length < 3 || !parsed.params) return null
  return parsed
}

export function writeDebugPlanDocument(document: DebugPlanDocument): void {
  window.localStorage.setItem(DEBUG_PLAN_STORAGE_KEY, JSON.stringify(document))
}
