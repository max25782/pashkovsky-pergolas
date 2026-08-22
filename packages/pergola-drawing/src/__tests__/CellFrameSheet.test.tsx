// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { computeLamellas } from '@pashkovsky/pergola-core'
import type { PergolaSpec, ProfileDimensions, Point2D } from '@pashkovsky/pergola-core'
import { CellFrameSheet } from '../CellFrameSheet'

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
const PROFILES = new Map<string, ProfileDimensions>([['lam-1', LAMELLA]])
const RECT: Point2D[] = [[0, 0], [3000, 0], [3000, 2000], [0, 2000]]

describe('CellFrameSheet', () => {
  it('renders without throwing and shows the deduction callout when visturTolerances were applied by the core', () => {
    const spec = baseSpec({
      contour: RECT,
      visturTolerances: { beamSegmentReductionMm: 15, lamellaLengthReductionMm: 30 },
    })
    const lamellas = computeLamellas(spec, PROFILES)
    const { container } = render(
      <CellFrameSheet pieces={lamellas} profiles={PROFILES} lengthReductionTotalMm={30} />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    // 2 deduction callouts (one per end) + outer + inner dimension chains all render <line> with markers.
    const dimensionLines = container.querySelectorAll('line[marker-start]')
    expect(dimensionLines.length).toBeGreaterThan(0)
    expect(container.textContent).toContain('lam-1')
  })

  it('renders without throwing when no vistur reduction was applied (lengthReductionTotalMm=0) — no deduction callouts', () => {
    const spec = baseSpec({ contour: RECT })
    const lamellas = computeLamellas(spec, PROFILES)
    const { container } = render(<CellFrameSheet pieces={lamellas} profiles={PROFILES} />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.textContent).not.toContain('−')
  })

  it('renders without crashing when there are no lamellas at all', () => {
    const { container } = render(<CellFrameSheet pieces={[]} profiles={PROFILES} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
