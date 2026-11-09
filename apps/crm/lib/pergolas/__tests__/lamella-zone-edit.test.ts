import { addLamellaZone, removeLamellaZone, setLamellaZoneEdge } from '../lamella-zone-edit'

describe('lamella zone list edits', () => {
  it('adds zones with distinct ids', () => {
    const one = addLamellaZone(undefined)
    const two = addLamellaZone(one)
    expect(new Set(two.map((zone) => zone.id)).size).toBe(2)
  })

  it('never gives a new zone the id of one that is still there, even after a removal', () => {
    const [a, b] = addLamellaZone(addLamellaZone(undefined))
    const next = addLamellaZone(removeLamellaZone([a, b], a.id))
    expect(next[0].id).toBe(b.id)
    expect(next[1].id).not.toBe(b.id)
  })

  it('changes one edge of one zone and leaves the others alone', () => {
    const zones = addLamellaZone(addLamellaZone(undefined))
    const changed = setLamellaZoneEdge(zones, zones[1].id, 'dividerEdgeIndex', 5)
    expect(changed[1].dividerEdgeIndex).toBe(5)
    expect(changed[0]).toEqual(zones[0])
    expect(changed[1].lamellaEdgeIndex).toBe(zones[1].lamellaEdgeIndex)
  })

  it('returns undefined when the last zone is removed, so the field leaves the plan', () => {
    const zones = addLamellaZone(undefined)
    expect(removeLamellaZone(zones, zones[0].id)).toBeUndefined()
  })
})
