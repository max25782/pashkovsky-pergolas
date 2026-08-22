// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { computeLamellas } from '@pashkovsky/pergola-core'
import type { PergolaSpec, ProfileDimensions, Point2D } from '@pashkovsky/pergola-core'
import { LamellaLayoutSheet } from '../LamellaLayoutSheet'

/**
 * Smoke test only — see TopPlanSheet.test.tsx for the same rationale: pure
 * geometry is covered pixel-free in geometry/__tests__/lamellaRhythm.test.ts,
 * this just confirms the component renders a real computeLamellas output
 * end-to-end (uniform AND mixed pattern, flat AND onEdge) without throwing.
 */

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function baseSpec(overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour: [],
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    color: '#fff',
    ...overrides,
  }
}

const LAMELLA: ProfileDimensions = { widthMm: 40, heightMm: 20 }
const WIDE: ProfileDimensions = { widthMm: 70, heightMm: 20 }
const THIN: ProfileDimensions = { widthMm: 20, heightMm: 20 }
const PROFILES = new Map<string, ProfileDimensions>([
  ['lam-1', LAMELLA],
  ['wide', WIDE],
  ['thin', THIN],
])

const RECT: Point2D[] = [[0, 0], [3000, 0], [3000, 2000], [0, 2000]]

describe('LamellaLayoutSheet', () => {
  it('renders a uniform-pattern computeLamellas result without throwing, one footprint per lamella', () => {
    const spec = baseSpec({ contour: RECT })
    const lamellas = computeLamellas(spec, PROFILES)
    const { container } = render(<LamellaLayoutSheet pieces={lamellas} profiles={PROFILES} />)
    expect(container.querySelector('svg')).not.toBeNull()
    const polygons = container.querySelectorAll('polygon')
    expect(polygons.length).toBe(lamellas.length)
  })

  it('renders a mixed-pattern (70/40/20) result and shows one gap marker + pitch segment per row-to-row step', () => {
    const spec = baseSpec({ contour: RECT, lamellaPattern: ['wide', 'lam-1', 'thin'] })
    const lamellas = computeLamellas(spec, PROFILES)
    const { container } = render(<LamellaLayoutSheet pieces={lamellas} profiles={PROFILES} />)
    const rowCount = new Set(lamellas.map((p) => Math.round(p.position[2]))).size
    const dimensionLines = container.querySelectorAll('line[marker-start]')
    // 1 gap marker line + 1 pitch segment line per row-to-row step.
    expect(dimensionLines.length).toBe((rowCount - 1) * 2)
  })

  it('lamellaOnEdge=true renders without throwing and still draws one footprint per lamella', () => {
    const spec = baseSpec({ contour: RECT, lamellaOnEdge: true })
    const lamellas = computeLamellas(spec, PROFILES)
    const { container } = render(<LamellaLayoutSheet pieces={lamellas} profiles={PROFILES} lamellaOnEdge />)
    const polygons = container.querySelectorAll('polygon')
    expect(polygons.length).toBe(lamellas.length)
  })

  it('renders without crashing when there are no lamellas at all', () => {
    const { container } = render(<LamellaLayoutSheet pieces={[]} profiles={PROFILES} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
