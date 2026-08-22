// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { computeFrame, computeLamellas, computePurlins } from '@pashkovsky/pergola-core'
import type { PergolaSpec, ProfileDimensions, Point2D, CutPiece } from '@pashkovsky/pergola-core'
import { TopPlanSheet } from '../TopPlanSheet'

/**
 * Smoke test only — geometry itself is covered without pixels in
 * geometry/__tests__ (see footprints.test.ts / dimensionLayout.test.ts).
 * This just confirms the component renders a real computeFrame/
 * computeLamellas/computePurlins output end-to-end without throwing, and
 * produces the expected SVG element counts (one footprint per piece, one
 * dimension line per axial segment) — a real regression class (a typo in a
 * prop path, an undefined profile lookup) would throw during render, not
 * fail a pure-geometry assertion.
 */

// jsdom has no ResizeObserver — stub it (mirrors plan-editor's own test setup pattern).
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

const BEAM: ProfileDimensions = { widthMm: 40, heightMm: 100, maxSpanMm: 2500 }
const POST: ProfileDimensions = { widthMm: 80, heightMm: 80 }
const LAMELLA: ProfileDimensions = { widthMm: 40, heightMm: 20, maxLamellaSpanMm: 1500 }
const PURLIN: ProfileDimensions = { widthMm: 40, heightMm: 60, interruptsLamella: true }
const PROFILES = new Map<string, ProfileDimensions>([
  ['beam-1', BEAM],
  ['post-1', POST],
  ['lam-1', LAMELLA],
  ['purlin-1', PURLIN],
])

const RECT: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]

describe('TopPlanSheet', () => {
  it('renders a real computeFrame/computeLamellas/computePurlins result without throwing', () => {
    const spec = baseSpec({ contour: RECT, purlinProfileId: 'purlin-1' })
    const frame = computeFrame(spec, PROFILES)
    const lamellas = computeLamellas(spec, PROFILES)
    const purlins = computePurlins(spec, PROFILES)
    const pieces = [...frame.beams, ...frame.posts, ...lamellas, ...purlins]

    const { container } = render(<TopPlanSheet pieces={pieces} profiles={PROFILES} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()

    // One footprint polygon per beam + per post + per purlin (lamellas are NOT drawn on this sheet).
    const polygons = container.querySelectorAll('polygon')
    // +1 for the reference contour outline itself.
    expect(polygons.length).toBe(frame.beams.length + frame.posts.length + purlins.length + 1)
  })

  it('renders one dimension segment <line> (with markers) per chain segment across all edges', () => {
    const spec = baseSpec({ contour: RECT })
    const frame = computeFrame(spec, PROFILES)
    const pieces = [...frame.beams, ...frame.posts]

    const { container } = render(<TopPlanSheet pieces={pieces} profiles={PROFILES} />)
    const dimensionLines = container.querySelectorAll('line[marker-start]')
    // 6000mm sides (×2) get 2 intermediate posts (3 segments each); 3000mm sides (×2) get 1 (2 segments each).
    expect(dimensionLines.length).toBe(3 + 3 + 2 + 2)
  })

  it('renders without crashing when there are no pieces at all', () => {
    const { container } = render(<TopPlanSheet pieces={[]} profiles={PROFILES} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  /**
   * Regression for the "sliver" report — see chat "верхняя балка снова
   * режется с обрезком: 4655 + 423 + 4232". That report turned out to be
   * TWO bugs, fixed at two different layers:
   *   1. (this sheet, fixed previously) segmented pieces of the SAME
   *      geometric side must render as ONE continuous dimension chain, not
   *      several independent corner→corner chains sitting end to end.
   *   2. (pergola-core, see beamSegmentation.ts snapBoundaryToExistingPost
   *      / prompt "стык балки притягивается к существующей стойке" — THE
   *      REAL BUG) segmentBeamsForStock must never plant a fresh splice
   *      post a few dozen cm from an existing one: the two `post-seg-0`
   *      (−72.671) / `post-6` (−495.548) posts from the original report
   *      were themselves a construction defect, not something this sheet
   *      should ever be asked to draw honestly. Asserting `['4232', '423',
   *      '4655']` here would enshrine that defect as the expected input —
   *      see prompt "фиксирует уродство как правильный ответ" — so this
   *      case is replaced by the corrected upstream shape: ONE mid-span
   *      post (the surviving `post-6`, snapped onto by segmentation),
   *      giving two full-length pieces and one clean chain.
   */
  it('a side segmented into 2 stock pieces at ONE shared mid-span post renders as ONE 2-segment chain', () => {
    function post(id: string, x: number, z: number): CutPiece {
      return {
        id,
        role: 'post',
        profileId: 'post-1',
        lengthAxisMm: 2600,
        lengthLongMm: 2600,
        lengthShortMm: 2600,
        cutMiterStartDeg: 0,
        cutBevelStartDeg: 0,
        cutHandStart: 'straight',
        cutMiterEndDeg: 0,
        cutBevelEndDeg: 0,
        cutHandEnd: 'straight',
        position: [x, 0, z],
        rotation: [0, 0, 0],
        color: '#fff',
      }
    }
    function beamSeg(id: string, x: number, z: number, lengthAxisMm: number): CutPiece {
      return {
        id,
        role: 'beam',
        profileId: 'beam-1',
        lengthAxisMm,
        lengthLongMm: lengthAxisMm,
        lengthShortMm: lengthAxisMm,
        cutMiterStartDeg: 0,
        cutBevelStartDeg: 0,
        cutHandStart: 'straight',
        cutMiterEndDeg: 0,
        cutBevelEndDeg: 0,
        cutHandEnd: 'straight',
        position: [x, 2600, z],
        rotation: [0, Math.PI, 0], // running in -X
        color: '#fff',
      }
    }

    const Z = 2696.488
    const CORNER_LEFT_X = 4159.699
    const MID_POST_X = CORNER_LEFT_X - 4655
    const CORNER_RIGHT_X = CORNER_LEFT_X - 9310
    const pieces: CutPiece[] = [
      beamSeg('top-seg0', CORNER_LEFT_X, Z, 4655),
      beamSeg('top-seg1', MID_POST_X, Z, 4655),
      post('corner-left', CORNER_LEFT_X, Z),
      post('post-6', MID_POST_X, Z), // the ONE surviving mid-span post, snapped onto by segmentation
      post('corner-right', CORNER_RIGHT_X, Z),
    ]

    const { container } = render(<TopPlanSheet pieces={pieces} profiles={PROFILES} />)

    // One chain (one <DimensionChainSvg>'s <g> wrapper) for this one geometric side — not two.
    const dimensionLines = container.querySelectorAll('line[marker-start]')
    expect(dimensionLines.length).toBe(2)

    const labels = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(labels).toEqual(['4655', '4655'])
  })

  /**
   * "Честная плашка для неортогональных форм" — see FrameResult.isOrthogonal's
   * own docstring in pergola-core/src/frame.ts. TopPlanSheet stays
   * host-agnostic (no i18n import of its own): it only renders the banner
   * when the CALLER passes both `isOrthogonal={false}` AND non-empty warning
   * text — never invents its own copy.
   */
  // NB: queries scoped to each render's own `container`, NOT `getByRole`/
  // `queryByRole` (which default to `document.body`) — this test file's
  // vitest.config has no `globals`/setup-file-driven RTL auto-cleanup
  // between tests, so unscoped body-wide queries would see banners left
  // behind by earlier tests in this same file.
  it('shows the non-orthogonal warning banner when isOrthogonal=false and text is supplied', () => {
    const spec = baseSpec({ contour: RECT })
    const frame = computeFrame(spec, PROFILES)
    const pieces = [...frame.beams, ...frame.posts]

    const { container } = render(
      <TopPlanSheet
        pieces={pieces}
        profiles={PROFILES}
        isOrthogonal={false}
        nonOrthogonalWarningText="Форма неортогональная. Проверьте вручную."
      />,
    )
    const banner = container.querySelector('[role="alert"]')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toContain('Форма неортогональная. Проверьте вручную.')
    // Banner is plain HTML, not SVG — must not perturb the polygon/text/line counts other tests rely on.
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders no banner when isOrthogonal is true', () => {
    const spec = baseSpec({ contour: RECT })
    const frame = computeFrame(spec, PROFILES)
    const pieces = [...frame.beams, ...frame.posts]

    const { container } = render(
      <TopPlanSheet
        pieces={pieces}
        profiles={PROFILES}
        isOrthogonal={true}
        nonOrthogonalWarningText="Форма неортогональная. Проверьте вручную."
      />,
    )
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('renders no banner when isOrthogonal is omitted (default, matches pre-flag behaviour)', () => {
    const spec = baseSpec({ contour: RECT })
    const frame = computeFrame(spec, PROFILES)
    const pieces = [...frame.beams, ...frame.posts]

    const { container } = render(<TopPlanSheet pieces={pieces} profiles={PROFILES} />)
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('renders no banner when isOrthogonal=false but no warning text is supplied', () => {
    const spec = baseSpec({ contour: RECT })
    const frame = computeFrame(spec, PROFILES)
    const pieces = [...frame.beams, ...frame.posts]

    const { container } = render(
      <TopPlanSheet pieces={pieces} profiles={PROFILES} isOrthogonal={false} />,
    )
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
