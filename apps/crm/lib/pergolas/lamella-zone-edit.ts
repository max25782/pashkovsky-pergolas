import type { LamellaZone } from '@pashkovsky/pergola-core'

export type LamellaZoneEdgeField = 'cutEdgeIndex' | 'lamellaEdgeIndex' | 'dividerEdgeIndex'

/** `undefined` when the list is empty, so the field disappears from the plan instead of staying `[]`. */
function orUndefined(zones: LamellaZone[]): LamellaZone[] | undefined {
  return zones.length > 0 ? zones : undefined
}

function nextZoneId(zones: readonly LamellaZone[]): string {
  const taken = new Set(zones.map((zone) => zone.id))
  let n = zones.length + 1
  while (taken.has(`zone-${n}`)) n += 1
  return `zone-${n}`
}

/** New zone on edges 1, 2 and 3 of the contour; the editor shows whether the choice can be built. */
export function addLamellaZone(zones: readonly LamellaZone[] | undefined): LamellaZone[] {
  const list = zones ?? []
  return [...list, { id: nextZoneId(list), cutEdgeIndex: 0, lamellaEdgeIndex: 1, dividerEdgeIndex: 2 }]
}

export function setLamellaZoneEdge(
  zones: readonly LamellaZone[],
  zoneId: string,
  field: LamellaZoneEdgeField,
  edgeIndex: number,
): LamellaZone[] {
  return zones.map((zone) => (zone.id === zoneId ? { ...zone, [field]: edgeIndex } : zone))
}

export function removeLamellaZone(zones: readonly LamellaZone[], zoneId: string): LamellaZone[] | undefined {
  return orUndefined(zones.filter((zone) => zone.id !== zoneId))
}
