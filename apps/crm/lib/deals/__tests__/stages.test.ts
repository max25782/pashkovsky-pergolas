import {
  ALUMINUM_TEMPLATE,
  DEFAULT_STAGES,
  STAGE_TEMPLATES,
  displayStageKey,
  generateStageKey,
  keysWithRole,
  legacyRoleOfKey,
  resolverFor,
  roleOfStage,
  stageLabel,
  stagesForNewFirm,
  stagesFromTemplate,
  templateIdForIndustry,
  validateStageDrafts,
  type DealStageDef,
  type StageDraft,
} from '../stages'

function draftsFrom(stages: readonly DealStageDef[], overrides: Partial<Record<string, Partial<StageDraft>>> = {}): StageDraft[] {
  return stages.map((s) => ({
    key: s.key,
    role: s.role,
    color: s.color,
    label: s.label,
    labels: s.labels,
    isActive: s.isActive,
    ...overrides[s.key],
    // names: the aluminium template relies on translated defaults, give drafts a name
  })).map((d) => ({ ...d, label: d.label ?? d.key }))
}

describe('aluminium template (Pashkovsky is unchanged)', () => {
  it('keeps the nine keys, in the old order', () => {
    expect(ALUMINUM_TEMPLATE.map((t) => t.key)).toEqual([
      'new', 'measure', 'offer', 'offer_approved', 'material_ordered', 'approved', 'production', 'install', 'done',
    ])
  })

  it('keeps the old colors', () => {
    expect(ALUMINUM_TEMPLATE.map((t) => t.color)).toEqual([
      'bg-gray-500', 'bg-purple-500', 'bg-yellow-500', 'bg-yellow-600', 'bg-blue-500',
      'bg-green-500', 'bg-orange-500', 'bg-indigo-500', 'bg-emerald-600',
    ])
  })

  it('maps the logic stages to roles; the first three have none', () => {
    expect(legacyRoleOfKey('offer_approved')).toBe('signed')
    expect(legacyRoleOfKey('approved')).toBe('material_arrived')
    expect(legacyRoleOfKey('install')).toBe('installation')
    expect(legacyRoleOfKey('done')).toBe('completed')
    expect(['new', 'measure', 'offer'].map(legacyRoleOfKey)).toEqual([null, null, null])
  })

  it('uses the translated default names (no label stored)', () => {
    const done = DEFAULT_STAGES.find((s) => s.key === 'done')!
    expect(stageLabel(done, 'ru', (k) => `t:${k}`)).toBe('t:done')
  })
})

describe('templates', () => {
  it('every template has at least one column and a completed stage', () => {
    for (const id of Object.keys(STAGE_TEMPLATES) as Array<keyof typeof STAGE_TEMPLATES>) {
      const stages = stagesFromTemplate(id)
      expect(stages.length).toBeGreaterThan(0)
      expect(stages.some((s) => s.role === 'completed')).toBe(true)
      expect(new Set(stages.map((s) => s.key)).size).toBe(stages.length)
    }
  })

  it('a construction firm gets exactly three columns, labelled in all four languages', () => {
    const stages = stagesFromTemplate('construction')
    expect(stages.map((s) => s.key)).toEqual(['signed', 'in_progress', 'completed'])
    for (const s of stages) expect(Object.keys(s.labels ?? {}).sort()).toEqual(['en', 'he', 'ru', 'sr'])
    expect(stages.map((s) => stageLabel(s, 'ru'))).toEqual(['Сделка подписана', 'Сделка в работе', 'Сделка закончена'])
  })

  it('does not contain any aluminium column', () => {
    const keys = stagesFromTemplate('repair').map((s) => s.key)
    expect(keys).not.toContain('material_ordered')
    expect(keys).not.toContain('offer_approved')
  })

  it('a new aluminium firm gets every column named in all four languages (no reliance on messages)', () => {
    for (const stage of stagesForNewFirm('aluminum')) {
      expect(Object.keys(stage.labels ?? {}).sort()).toEqual(['en', 'he', 'ru', 'sr'])
    }
    // Pashkovsky's own template stays name-less so it keeps reading the translations.
    expect(stagesFromTemplate('aluminum').every((s) => s.labels === null)).toBe(true)
  })

  it('picks the template by industry; unknown industries keep the aluminium set', () => {
    expect(templateIdForIndustry('renovation')).toBe('repair')
    expect(templateIdForIndustry('construction')).toBe('construction')
    expect(templateIdForIndustry('pergola')).toBe('aluminum')
    expect(templateIdForIndustry(null)).toBe('aluminum')
    expect(templateIdForIndustry('general')).toBe('aluminum')
  })
})

describe('labels', () => {
  it('prefers the language label, then the single label, then the default, then the key', () => {
    const stage = { key: 'k', label: 'Mine', labels: { ru: 'Моя' } }
    expect(stageLabel(stage, 'ru')).toBe('Моя')
    expect(stageLabel(stage, 'en')).toBe('Mine')
    expect(stageLabel({ key: 'k' }, 'en', () => 'Default')).toBe('Default')
    expect(stageLabel({ key: 'k' }, 'en')).toBe('k')
  })
})

describe('roles and display', () => {
  const stages = stagesFromTemplate('construction')

  it('reads the role from the firm columns, not from the key name', () => {
    expect(roleOfStage('in_progress', stages)).toBe('in_production')
    expect(resolverFor(stages)('completed')).toBe('completed')
    expect(resolverFor(stages)('done')).toBeNull()
  })

  it('falls back to the aluminium meaning when no columns are given', () => {
    expect(resolverFor(null)('done')).toBe('completed')
  })

  it('finds the keys of given roles', () => {
    expect(keysWithRole(stages, ['completed'])).toEqual(['completed'])
  })

  it('shows a deal without a stage, or with an unknown one, in the first column', () => {
    expect(displayStageKey(null, stages)).toBe('signed')
    expect(displayStageKey('new', stages)).toBe('signed')
    expect(displayStageKey('in_progress', stages)).toBe('in_progress')
  })
})

describe('validateStageDrafts', () => {
  const existing = stagesFromTemplate('construction')
  const noDeals = {}

  it('accepts the unchanged list', () => {
    const result = validateStageDrafts({ drafts: draftsFrom(existing), existing, dealCounts: noDeals })
    expect(result.errors).toEqual([])
    expect(result.blocked).toEqual([])
    expect(result.noCompletedStage).toBe(false)
  })

  it('requires at least one active column', () => {
    const drafts = draftsFrom(existing).map((d) => ({ ...d, isActive: false }))
    expect(validateStageDrafts({ drafts, existing, dealCounts: noDeals }).errors).toContain('at_least_one_active_stage')
  })

  it('does not ask a built-in aluminium column for a stored name (it has a translated default)', () => {
    const al = stagesFromTemplate('aluminum')
    const drafts: StageDraft[] = al.map((s) => ({ key: s.key, role: s.role, color: s.color, isActive: true }))
    expect(validateStageDrafts({ drafts, existing: al, dealCounts: {} }).errors).toEqual([])
  })

  it('requires a name and a valid color', () => {
    const drafts: StageDraft[] = [{ color: 'bg-nope', isActive: true }]
    const errors = validateStageDrafts({ drafts, existing, dealCounts: noDeals }).errors
    expect(errors).toContain('stage_name_required')
    expect(errors).toContain('stage_color_invalid')
  })

  it('rejects keys that do not exist (keys cannot be invented by the client)', () => {
    const drafts: StageDraft[] = [{ key: 'made_up', color: 'bg-gray-500', label: 'x', isActive: true }]
    expect(validateStageDrafts({ drafts, existing, dealCounts: noDeals }).errors).toContain('stage_key_unknown')
  })

  it('lets a column be renamed without touching its key', () => {
    const drafts = draftsFrom(existing, { in_progress: { label: 'Executing' } })
    const result = validateStageDrafts({ drafts, existing, dealCounts: noDeals })
    expect(result.errors).toEqual([])
    expect(drafts.find((d) => d.key === 'in_progress')?.key).toBe('in_progress')
  })

  it('does not let the meaning of a built-in aluminium column change', () => {
    const al = stagesFromTemplate('aluminum')
    const drafts = draftsFrom(al, { done: { role: null } })
    expect(validateStageDrafts({ drafts, existing: al, dealCounts: noDeals }).errors).toContain('stage_role_locked')
  })

  it('blocks removing a column that holds deals until they have a target', () => {
    const drafts = draftsFrom(existing).filter((d) => d.key !== 'in_progress')
    const blocked = validateStageDrafts({ drafts, existing, dealCounts: { in_progress: 4 } })
    expect(blocked.blocked).toEqual([{ key: 'in_progress', dealCount: 4 }])

    const moved = validateStageDrafts({
      drafts,
      existing,
      dealCounts: { in_progress: 4 },
      moves: { in_progress: 'signed' },
    })
    expect(moved.blocked).toEqual([])
  })

  it('does not accept a move into a hidden or the same column', () => {
    const drafts = draftsFrom(existing, { in_progress: { isActive: false }, signed: { isActive: false } })
    const result = validateStageDrafts({
      drafts,
      existing,
      dealCounts: { in_progress: 2 },
      moves: { in_progress: 'signed' },
    })
    expect(result.blocked).toHaveLength(1)
    const self = validateStageDrafts({
      drafts: draftsFrom(existing, { in_progress: { isActive: false } }),
      existing,
      dealCounts: { in_progress: 2 },
      moves: { in_progress: 'in_progress' },
    })
    expect(self.blocked).toHaveLength(1)
  })

  it('warns when a column with logic is removed, and when no completed column is left', () => {
    const drafts = draftsFrom(existing).filter((d) => d.key !== 'completed')
    const result = validateStageDrafts({ drafts, existing, dealCounts: noDeals })
    expect(result.warnings).toEqual([{ key: 'completed', role: 'completed' }])
    expect(result.noCompletedStage).toBe(true)
  })

  it('a column without logic can be removed silently', () => {
    const al = stagesFromTemplate('aluminum')
    const drafts = draftsFrom(al).filter((d) => d.key !== 'measure')
    const result = validateStageDrafts({ drafts, existing: al, dealCounts: noDeals })
    expect(result.warnings).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('allows adding custom columns with a role', () => {
    const drafts = [
      ...draftsFrom(existing),
      { color: 'bg-teal-600', label: 'Inspection', role: 'installation' as const, isActive: true },
    ]
    expect(validateStageDrafts({ drafts, existing, dealCounts: noDeals }).errors).toEqual([])
  })
})

describe('generateStageKey', () => {
  it('makes a unique custom key', () => {
    const taken = new Set(['custom_aaaaaa'])
    const draws = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    let i = 0
    const key = generateStageKey(taken, () => draws[i++ % draws.length])
    expect(key).toMatch(/^custom_[a-z0-9]{6}$/)
    expect(taken.has(key)).toBe(false)
  })
})
