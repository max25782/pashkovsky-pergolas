import { draftsFromRows, isNameMissing, moveTargets, newRow, reorderRows, rowsFromStages } from '../stage-editor'
import { stagesFromTemplate, validateStageDrafts } from '../stages'

describe('stage editor state', () => {
  const stages = stagesFromTemplate('construction')

  it('round-trips an unchanged list into drafts the validator accepts', () => {
    const rows = rowsFromStages(stages)
    const result = validateStageDrafts({ drafts: draftsFromRows(rows), existing: stages, dealCounts: {} })
    expect(result.errors).toEqual([])
    expect(draftsFromRows(rows).map((d) => d.key)).toEqual(['signed', 'in_progress', 'completed'])
  })

  it('keeps built-in names empty so the translated default still applies', () => {
    const rows = rowsFromStages(stagesFromTemplate('aluminum'))
    expect(draftsFromRows(rows).every((d) => d.label === null && d.labels === null)).toBe(true)
  })

  it('stores only the language names that were filled in', () => {
    const rows = rowsFromStages(stages)
    rows[0].labels.sr = '  Potpisano '
    expect(draftsFromRows(rows)[0].labels).toMatchObject({ sr: 'Potpisano' })
  })

  it('reorders and ignores impossible moves', () => {
    expect(reorderRows([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(reorderRows([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
    expect(reorderRows([1, 2, 3], 5, 0)).toEqual([1, 2, 3])
  })

  it('a new column has no key and no role until chosen', () => {
    const row = newRow('tmp-1')
    expect(draftsFromRows([row])[0]).toMatchObject({ key: null, role: null, isActive: true })
  })

  it('offers only saved, visible columns as a move target', () => {
    const rows = rowsFromStages(stages)
    rows[1].isActive = false
    rows.push(newRow('tmp'))
    expect(moveTargets(rows, 'signed').map((r) => r.key)).toEqual(['completed'])
  })

  it('flags an unnamed column unless it has a built-in default', () => {
    expect(isNameMissing(newRow('x'), false)).toBe(true)
    expect(isNameMissing(newRow('x'), true)).toBe(false)
    const named = newRow('y')
    named.labels.he = 'חדש'
    expect(isNameMissing(named, false)).toBe(false)
  })
})
