import { describe, it, expect } from 'vitest'
import { computeLamellas } from '../lamellas'
import { validateLamellaSpans } from '../validation'
import type { PergolaSpec, ProfileDimensions, Point2D } from '../types'

/**
 * See prompt "дефолт NO_PURLIN... выдаёт неисполнимую конструкцию молча":
 * with maxLamellaSpanMm=1500 and a 6000mm span, leaving purlinProfileId unset
 * (the UI's NO_PURLIN default) or picking a non-interrupting purlin must NOT
 * silently produce a priced, rendered spec — validateLamellaSpans is the
 * caller-facing check that turns this into an explicit, blocking issue.
 */

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [[0, 0], [6000, 0], [6000, 3000], [0, 3000]],
    lamellaDirectionDeg: 0,
    lamellaGapMm: 30,
    lamellaAngleDeg: 0,
    heightMm: 2600,
    color: '#FFFFFF',
    postProfileId: 'post-unused',
    beamProfileId: 'beam-unused',
    lamellaProfileId: 'lam-70',
    ...overrides,
  }
}

const LAMELLA: ProfileDimensions = { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500 }
const PURLIN_INTERRUPTING: ProfileDimensions = { widthMm: 60, heightMm: 100, interruptsLamella: true }
const PURLIN_NON_INTERRUPTING: ProfileDimensions = { widthMm: 60, heightMm: 100, interruptsLamella: false }

const PROFILES_NO_PURLIN: Map<string, ProfileDimensions> = new Map([['lam-70', LAMELLA]])

describe('validateLamellaSpans', () => {
  it('purlinProfileId unset (NO_PURLIN default) + span > maxLamellaSpanMm → reports an issue per unsupported piece', () => {
    const spec = baseSpec() // no purlinProfileId at all
    const pieces = computeLamellas(spec, PROFILES_NO_PURLIN)
    expect(pieces.length).toBeGreaterThan(0)
    pieces.forEach(p => expect(p.lengthAxisMm).toBeCloseTo(6000, 0))

    const issues = validateLamellaSpans(pieces, PROFILES_NO_PURLIN)
    expect(issues.length).toBe(pieces.length)
    issues.forEach(issue => {
      expect(issue.code).toBe('lamella-span-exceeds-max')
      expect(issue.maxSpanMm).toBe(1500)
      expect(issue.spanMm).toBeCloseTo(6000, 0)
      expect(issue.message).toMatch(/exceeding/i)
    })
  })

  it('purlin selected but interruptsLamella=false → still reports an issue (a non-interrupting purlin does not shorten the unsupported span)', () => {
    const profiles = new Map([['lam-70', LAMELLA], ['purlin-1', PURLIN_NON_INTERRUPTING]])
    const spec = baseSpec({ purlinProfileId: 'purlin-1' })
    const pieces = computeLamellas(spec, profiles)
    pieces.forEach(p => expect(p.lengthAxisMm).toBeCloseTo(6000, 0))

    const issues = validateLamellaSpans(pieces, profiles)
    expect(issues.length).toBe(pieces.length)
  })

  it('purlin selected with interruptsLamella=true → no issues (lamella is segmented within maxLamellaSpanMm)', () => {
    const profiles = new Map([['lam-70', LAMELLA], ['purlin-1', PURLIN_INTERRUPTING]])
    const spec = baseSpec({ purlinProfileId: 'purlin-1' })
    const pieces = computeLamellas(spec, profiles)
    expect(pieces.length).toBeGreaterThan(0)
    pieces.forEach(p => expect(p.lengthAxisMm).toBeLessThanOrEqual(1500 + 0.5))

    const issues = validateLamellaSpans(pieces, profiles)
    expect(issues).toHaveLength(0)
  })

  it('span already within maxLamellaSpanMm (no purlin needed) → no issues', () => {
    const shortRect: Point2D[] = [[0, 0], [1000, 0], [1000, 3000], [0, 3000]]
    const spec = baseSpec({ contour: shortRect })
    const pieces = computeLamellas(spec, PROFILES_NO_PURLIN)
    const issues = validateLamellaSpans(pieces, PROFILES_NO_PURLIN)
    expect(issues).toHaveLength(0)
  })

  it('lamella profile has no maxLamellaSpanMm at all → no issues (rule opts out per-profile, same contract as computePurlins)', () => {
    const noLimitLamella: ProfileDimensions = { widthMm: 70, heightMm: 20 }
    const profiles = new Map([['lam-70', noLimitLamella]])
    const spec = baseSpec()
    const pieces = computeLamellas(spec, profiles)
    expect(validateLamellaSpans(pieces, profiles)).toHaveLength(0)
  })

  it('ignores non-lamella pieces (e.g. beams/posts) even if present in the array', () => {
    const pieces = computeLamellas(baseSpec(), PROFILES_NO_PURLIN)
    const withDecoy = [
      ...pieces,
      { ...pieces[0], id: 'beam-decoy', role: 'beam' as const, profileId: 'lam-70' },
    ]
    const issues = validateLamellaSpans(withDecoy, PROFILES_NO_PURLIN)
    expect(issues.every(i => i.pieceId !== 'beam-decoy')).toBe(true)
  })

  it('mixed pattern: a piece built from a profile with a tighter maxLamellaSpanMm is flagged even if other pattern profiles would be fine', () => {
    const tightLamella: ProfileDimensions = { widthMm: 20, heightMm: 20, maxLamellaSpanMm: 500 }
    const looseLamella: ProfileDimensions = { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 8000 }
    const profiles = new Map([['tight', tightLamella], ['loose', looseLamella]])
    const spec = baseSpec({ lamellaPattern: ['tight', 'loose'] })
    const pieces = computeLamellas(spec, profiles)
    // No purlin at all → every row spans the full 6000mm, regardless of profile.
    pieces.forEach(p => expect(p.lengthAxisMm).toBeCloseTo(6000, 0))

    const issues = validateLamellaSpans(pieces, profiles)
    const tightIssues = issues.filter(i => i.profileId === 'tight')
    const looseIssues = issues.filter(i => i.profileId === 'loose')
    expect(tightIssues.length).toBeGreaterThan(0)
    expect(looseIssues).toHaveLength(0) // 6000 < 8000 for this profile — not a violation
  })
})
