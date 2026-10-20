import { describe, expect, it } from 'vitest'
import { buildParts } from '../buildParts'
import { ACCEPTANCE_MODEL } from './fixture'

describe('buildParts', () => {
  it('uses builtin_kant → no angle parts', () => {
    const parts = buildParts(ACCEPTANCE_MODEL, { frameMethod: 'builtin_kant' })
    expect(parts.filter((p) => p.kind === 'angle')).toHaveLength(0)
  })

  it('uses plain_plus_angle → four angle parts matching frame sides', () => {
    const parts = buildParts(ACCEPTANCE_MODEL, { frameMethod: 'plain_plus_angle' })
    const angles = parts.filter((p) => p.kind === 'angle')
    expect(angles).toHaveLength(4)
    expect(angles.map((a) => a.lengthCm).sort((a, b) => b - a)).toEqual([600, 600, 400, 400])
    expect(angles.every((a) => a.profileId === '3x2')).toBe(true)
  })

  it('emits posts as hardware when requested', () => {
    const parts = buildParts({
      ...ACCEPTANCE_MODEL,
      posts: { count: 4, profileId: '12x4', lengthCm: 250 },
    })
    const posts = parts.filter((p) => p.kind === 'hardware')
    expect(posts).toHaveLength(4)
    expect(posts.every((p) => p.lengthCm === 250)).toBe(true)
  })

  it('skips non-positive members', () => {
    const parts = buildParts({
      lengthCm: 0,
      widthCm: 0,
      color: 'x',
      frame: { profileId: '12x4' },
      divisions: { count: 2 },
      shade: { count: 3, profileId: '2x7' },
    })
    expect(parts.filter((p) => p.kind === 'frame' || p.kind === 'division' || p.kind === 'shade')).toHaveLength(0)
  })

  it('throws when a profile is missing from the catalog', () => {
    expect(() =>
      buildParts({
        ...ACCEPTANCE_MODEL,
        frame: { profileId: 'nope' },
      }),
    ).toThrow(/no profile/)
  })
})
