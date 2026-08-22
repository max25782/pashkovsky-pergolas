import { describe, it, expect } from 'vitest'
import { computeFrame } from '../frame'
import type { FrameResult } from '../frame'
import { computePurlins } from '../purlins'
import {
  findRectangleWingBoundaries,
  segmentBeamsForStock,
  snapBoundaryToExistingPost,
  DEFAULT_SNAP_TOLERANCE_MM,
  type JointCandidate,
} from '../beamSegmentation'
import { decomposeIntoRectangles, type Rectangle } from '../rectangleDecomposition'
import { packProfile, effectiveKerfMm, DEFAULT_KERF_MM } from '../packProfile'
import type { PergolaSpec, ProfileDimensions, Point2D, CutPiece } from '../types'

function baseSpec(contour: Point2D[], overrides: Partial<PergolaSpec> = {}): PergolaSpec {
  return {
    contour,
    heightMm: 2600,
    lamellaGapMm: 20,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: 0,
    postProfileId: 'post-1',
    beamProfileId: 'beam-1',
    lamellaProfileId: 'lam-1',
    color: '#FFFFFF',
    ...overrides,
  }
}

describe('segmentBeamsForStock — Rule A (существующий узел > существующая стойка > новая стойка)', () => {
  it('L-form: splits the opposite perimeter beam at the concave-corner wing line even when both wings fit stock', () => {
    const contour: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [7000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find(
      (beam) => Math.abs(beam.position[0]) < 1 && Math.abs(beam.position[2]) < 1,
    )!

    expect(findRectangleWingBoundaries(bottomBeam, decomposeIntoRectangles(contour))).toEqual([3000])

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    const bottomWings = result.beams
      .filter((beam) => beam.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(result.issues).toEqual([])
    expect(bottomWings).toHaveLength(2)
    expect(bottomWings.map((beam) => beam.lengthAxisMm)).toEqual([3000, 3000])
    expect(bottomWings[0].cutHandEnd).toBe('straight')
    expect(bottomWings[1].cutHandStart).toBe('straight')
    expect(result.posts.filter(
      (post) => Math.abs(post.position[0] - 3000) < 1 && Math.abs(post.position[2]) < 1,
    )).toHaveLength(1)
  })

  it('ignores a grid line from decomposeIntoRectangles that is NOT a real wall for this beam (same reach depth on both sides)', () => {
    // Same L-shape as above (corner=[0,3000]x[0,3000], wing1=[3000,6000]x[0,3000],
    // wing2=[0,3000]x[3000,6000]) — but the corner rectangle has been split in
    // two by an UNRELATED coordinate at x=2000 (exactly what a redundant/
    // collinear vertex elsewhere in a hand-drawn contour would do to the
    // GLOBAL grid — see decomposeIntoRectangles' own docstring: grid lines
    // are built from every vertex across the whole contour, not just the
    // ones locally relevant to one beam). x=2000 must NOT produce a split:
    // both sides still reach all the way to y=6000 through wing2, so there is
    // no real wall there — see prompt "выступ создаёт X-координату, не
    // являющуюся стеной для верхней балки". x=3000 still must split (reach
    // genuinely drops from 6000 to 3000 there — the real notch wall).
    const rectanglesWithSpuriousLine: Rectangle[] = [
      { minX: 0, maxX: 2000, minY: 0, maxY: 3000 },
      { minX: 2000, maxX: 3000, minY: 0, maxY: 3000 },
      { minX: 3000, maxX: 6000, minY: 0, maxY: 3000 },
      { minX: 0, maxX: 3000, minY: 3000, maxY: 6000 },
    ]
    const contour: Point2D[] = [
      [0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [7000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find(
      (beam) => Math.abs(beam.position[0]) < 1 && Math.abs(beam.position[2]) < 1,
    )!

    expect(findRectangleWingBoundaries(bottomBeam, rectanglesWithSpuriousLine)).toEqual([3000])

    // Sanity: the REAL decomposition of this exact contour (no spurious
    // extra line) agrees — same single split at 3000.
    expect(findRectangleWingBoundaries(bottomBeam, decomposeIntoRectangles(contour))).toEqual([3000])
  })

  it('regression: computeFrame places maxSpanMm posts PER WING, not on the whole raw edge — no 3639 post, no 455 sliver downstream', () => {
    // Same contour that used to reproduce the "3639 + 455 + 3184" sliver:
    // computeFrame used to run maxSpanMm=4000 against the FULL 7278mm raw
    // edge, planting a naive post at its midpoint (3639) — only 455mm away
    // from the real shape wing boundary at 4094, which segmentBeamsForStock
    // adds independently downstream. Fixed at the source (see prompt
    // "maxSpanMm-стойки ставятся ПОСЛЕ деления на прямоугольники, не до"):
    // computeFrame now applies maxSpanMm to each wing SEPARATELY — wing 1
    // is [0, 4094] (4094mm, one intermediate post at its own midpoint,
    // 2047), wing 2 is [4094, 7278] (3184mm, shorter than maxSpanMm=4000,
    // no intermediate post at all). The naive 3639 post never exists, so
    // there is nothing for segmentBeamsForStock's snap-to-existing-post
    // logic to even need to clean up.
    const contour: Point2D[] = [
      [0, 0], [7278, 0], [7278, 3000], [4094, 3000], [4094, 6000], [0, 6000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      [
        'beam-1',
        {
          widthMm: 40,
          heightMm: 100,
          maxSpanMm: 4000,
          availableStockLengthsMm: [5000],
        },
      ],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find((beam) => beam.lengthAxisMm === 7278)!

    expect(frame.posts.some(
      (post) => Math.abs(post.position[0] - 3639) < 1 && Math.abs(post.position[2]) < 1,
    )).toBe(false)
    expect(frame.posts.some(
      (post) => Math.abs(post.position[0] - 2047) < 1 && Math.abs(post.position[2]) < 1,
    )).toBe(true)

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    const bottomWings = result.beams
      .filter((beam) => beam.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(result.issues).toEqual([])
    expect(bottomWings).toHaveLength(2)
    expect(bottomWings.map((beam) => beam.lengthAxisMm)).toEqual([4094, 3184])
    expect(bottomWings.some((beam) => Math.abs(beam.lengthAxisMm - 455) < 1)).toBe(false)
  })

  it('regression (exact bug numbers): L-shape gives chain 3677 | 4245, no post at 3961, no 284 sliver', () => {
    // The exact contour/maxSpanMm that produced the originally-reported
    // "3677 | 284 | 3961" sliver: reflex vertex at x=3677 on a 7922mm
    // bottom edge, maxSpanMm=4500 — old (buggy) computeFrame ran maxSpanMm
    // against the WHOLE raw 7922mm edge and planted a naive post at its
    // midpoint, 3961, only 284mm from the real wing boundary. Both wings
    // (3677 and 4245) are individually SHORTER than maxSpanMm=4500, so the
    // fix means neither wing gets an intermediate post at all — the only
    // split is the one real wall, giving exactly two pieces: 3677 | 4245.
    const contour: Point2D[] = [
      [0, 0], [7922, 0], [7922, 3000], [3677, 3000], [3677, 6000], [0, 6000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      [
        'beam-1',
        { widthMm: 40, heightMm: 100, maxSpanMm: 4500, availableStockLengthsMm: [8000] },
      ],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find((beam) => beam.lengthAxisMm === 7922)!

    expect(frame.posts.some(
      (post) => Math.abs(post.position[0] - 3961) < 1 && Math.abs(post.position[2]) < 1,
    )).toBe(false)

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    const bottomWings = result.beams
      .filter((beam) => beam.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(result.issues).toEqual([])
    expect(bottomWings).toHaveLength(2)
    expect(bottomWings.map((beam) => beam.lengthAxisMm)).toEqual([3677, 4245])
    expect(bottomWings.some((beam) => Math.abs(beam.lengthAxisMm - 284) < 1)).toBe(false)
  })

  it('L-form: isolates a long wing first, then stock-segments only inside that wing', () => {
    const contour: Point2D[] = [
      [0, 0], [12000, 0], [12000, 3000], [7000, 3000], [7000, 6000], [0, 6000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find((beam) => beam.lengthAxisMm === 12000)!

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    const bottomSegments = result.beams
      .filter((beam) => beam.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(result.issues).toEqual([])
    expect(bottomSegments).toHaveLength(3)
    expect(bottomSegments.map((beam) => beam.lengthAxisMm)).toEqual([3500, 3500, 5000])
    expect(bottomSegments[2].position[0]).toBeCloseTo(7000, 3)
  })

  it('L-form: stock-segments two long wings independently without crossing their shape boundary', () => {
    const contour: Point2D[] = [
      [0, 0], [16000, 0], [16000, 3000], [8000, 3000], [8000, 6000], [0, 6000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find((beam) => beam.lengthAxisMm === 16000)!

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    const bottomSegments = result.beams
      .filter((beam) => beam.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(result.issues).toEqual([])
    expect(bottomSegments).toHaveLength(4)
    expect(bottomSegments.map((beam) => beam.lengthAxisMm)).toEqual([4000, 4000, 4000, 4000])
    expect(bottomSegments[2].position[0]).toBeCloseTo(8000, 3)
  })

  it('rectangle: has no shape-level wing boundaries and keeps the previous stock-only behavior', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [8000, 3000], [0, 3000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find((beam) => beam.lengthAxisMm === 8000)!

    expect(findRectangleWingBoundaries(bottomBeam, decomposeIntoRectangles(contour))).toEqual([])

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    const bottomSegments = result.beams.filter((beam) => beam.id.startsWith(bottomBeam.id))
    expect(bottomSegments).toHaveLength(2)
    expect(bottomSegments.map((beam) => beam.lengthAxisMm)).toEqual([4000, 4000])
  })

  it('U-form: two concave corners establish three independent wings on the opposite perimeter beam', () => {
    const contour: Point2D[] = [
      [0, 0], [9000, 0], [9000, 6000], [6000, 6000],
      [6000, 2000], [3000, 2000], [3000, 6000], [0, 6000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [10000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    const bottomBeam = frame.beams.find((beam) => beam.lengthAxisMm === 9000)!

    expect(findRectangleWingBoundaries(bottomBeam, decomposeIntoRectangles(contour))).toEqual([3000, 6000])

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    const bottomWings = result.beams
      .filter((beam) => beam.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])
    expect(bottomWings).toHaveLength(3)
    expect(bottomWings.map((beam) => beam.lengthAxisMm)).toEqual([3000, 3000, 3000])
  })

  it('tier 1: an existing crossing purlin endpoint at x=5000 on an 8000mm beam wins over the naive symmetric 4000/4000 split', () => {
    // L-shape: bottom edge (0,0)-(8000,0) is length 8000, a SINGLE straight
    // polygon edge (no internal vertex) — nothing to split it "for free".
    // The overall contour's dir-extent is 0..10000 (widens further right
    // above y=3000), so a lamella maxLamellaSpanMm=5000 places exactly ONE
    // purlin division point at x=5000 (nSpans=ceil(10000/5000)=2,
    // step=5000) — its purlin, scanning along y, hits the bottom edge at
    // x=5000, y=0: a real existing crossing piece touching the 8000mm beam,
    // NOT at its center.
    const contour: Point2D[] = [
      [0, 0], [8000, 0], [8000, 3000], [10000, 3000], [10000, 7000], [0, 7000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 5000 }],
      ['purlin-1', { widthMm: 40, heightMm: 60, interruptsLamella: false }],
    ])
    const spec = baseSpec(contour, { purlinProfileId: 'purlin-1' })

    const frame = computeFrame(spec, profiles)
    const purlins = computePurlins(spec, profiles)
    expect(purlins.length).toBeGreaterThan(0)

    const bottomBeam = frame.beams.find(
      (b) => Math.abs(b.position[0]) < 1 && Math.abs(b.position[2]) < 1 && b.lengthAxisMm === 8000,
    )
    expect(bottomBeam).toBeDefined()

    const result = segmentBeamsForStock(spec, frame, purlins, profiles)
    expect(result.issues).toEqual([])

    const segments = result.beams
      .filter((b) => b.id.startsWith(bottomBeam!.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(segments).toHaveLength(2)
    expect(segments[0].lengthAxisMm).toBeCloseTo(5000, 1)
    expect(segments[1].lengthAxisMm).toBeCloseTo(3000, 1)
    // NOT the naive symmetric split.
    expect(segments[0].lengthAxisMm).not.toBeCloseTo(4000, 1)

    // A new post was planted at the splice (x=5000) — nothing there before.
    const newPost = result.posts.find((p) => Math.abs(p.position[0] - 5000) < 1 && Math.abs(p.position[2]) < 1)
    expect(newPost).toBeDefined()
  })

  it('tier 3: a straight 8000mm beam with NO internal joint and NO maxSpanMm post splits at the center, adding exactly one new post', () => {
    // Trapezoid, not a rectangle: only the BOTTOM edge is 8000mm — top
    // (4000mm) and both slanted legs (~3606mm) stay under the 6000mm stock
    // untouched, so exactly one beam needs segmenting, isolating the
    // assertion below from a second "opposite side is also 8000mm" case.
    const contour: Point2D[] = [[0, 0], [8000, 0], [6000, 3000], [2000, 3000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)

    const frame = computeFrame(spec, profiles)
    expect(frame.posts).toHaveLength(4) // corners only, no maxSpanMm ⇒ no intermediate posts

    const result = segmentBeamsForStock(spec, frame, [], profiles)
    expect(result.issues).toEqual([])

    const bottomBeam = frame.beams.find((b) => b.lengthAxisMm === 8000)!
    const segments = result.beams
      .filter((b) => b.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(segments).toHaveLength(2)
    expect(segments[0].lengthAxisMm).toBeCloseTo(4000, 1)
    expect(segments[1].lengthAxisMm).toBeCloseTo(4000, 1)

    expect(result.posts).toHaveLength(5) // 4 corners + exactly 1 new
    const newPost = result.posts.find((p) => Math.abs(p.position[0] - 4000) < 1 && Math.abs(p.position[2]) < 1)
    expect(newPost).toBeDefined()
  })

  it('tier 2: a straight 8000mm beam where maxSpanMm ALREADY placed an intermediate post at the center reuses it — no new post added', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [6000, 3000], [2000, 3000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      // maxSpanMm=4500 ⇒ ceil(8000/4500)-1=1 intermediate post at t=0.5 ⇒ x=4000.
      ['beam-1', { widthMm: 40, heightMm: 100, maxSpanMm: 4500, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)

    const frame = computeFrame(spec, profiles)
    expect(frame.posts).toHaveLength(5) // 4 corners + 1 intermediate (already placed by computeFrame)

    const result = segmentBeamsForStock(spec, frame, [], profiles)
    expect(result.issues).toEqual([])

    const bottomBeam = frame.beams.find((b) => b.lengthAxisMm === 8000)!
    const segments = result.beams
      .filter((b) => b.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    expect(segments).toHaveLength(2)
    expect(segments[0].lengthAxisMm).toBeCloseTo(4000, 1)
    expect(segments[1].lengthAxisMm).toBeCloseTo(4000, 1)

    // No growth — the existing intermediate post was reused, not duplicated.
    expect(result.posts).toHaveLength(5)
  })

  it('leaves a beam untouched when its profile has no availableStockLengthsMm — honest gap, not a guess', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [8000, 3000], [0, 3000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100 }], // no availableStockLengthsMm
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)

    const result = segmentBeamsForStock(spec, frame, [], profiles)
    expect(result.issues).toEqual([])
    expect(result.beams).toHaveLength(frame.beams.length)
    expect(result.beams.find((b) => b.lengthAxisMm === 8000)).toBeDefined()
  })

  it('leaves a beam already within stock untouched — no spurious splice', () => {
    const contour: Point2D[] = [[0, 0], [5000, 0], [5000, 3000], [0, 3000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)

    const result = segmentBeamsForStock(spec, frame, [], profiles)
    expect(result.beams).toHaveLength(frame.beams.length)
    expect(result.posts).toHaveLength(frame.posts.length)
  })

  it('керф на стыке: a segment sized right up against maxStockMm still fits packProfile WITH the real kerf, not just lengthLongMm alone', () => {
    // Same trapezoid as the tier-3 case, but this time segmenting WITH the
    // real order-sheet kerf (DEFAULT_KERF_MM=5) — see prompt "Прогон встал
    // из-за 7000 + 5 > 7000... та же арифметика ударит по кускам балки".
    // A segmentation that only checked lengthLongMm <= maxStockMm (ignoring
    // that EVERY cut, including the new internal straight ones, costs kerf)
    // would happily produce a segment that then throws straight out of
    // packProfile — this test packs the ACTUAL segmentation output through
    // the real packProfile with the real kerf and asserts it does not.
    const contour: Point2D[] = [[0, 0], [8000, 0], [6000, 3000], [2000, 3000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)

    const result = segmentBeamsForStock(spec, frame, [], profiles, DEFAULT_KERF_MM)
    expect(result.issues).toEqual([])

    const bottomBeam = frame.beams.find((b) => b.lengthAxisMm === 8000)!
    const segments = result.beams.filter((b) => b.id.startsWith(bottomBeam.id))
    expect(segments).toHaveLength(2)

    // The property that actually matters (not a specific mm number): every
    // produced segment's real pack-time slot (lengthLongMm + its own
    // angle-adjusted kerf, same formula packProfile itself uses) fits the
    // stock, with a hair of room, not sitting exactly ON the limit.
    for (const seg of segments) {
      const kerf = Math.max(
        effectiveKerfMm(DEFAULT_KERF_MM, seg.cutMiterStartDeg, seg.cutBevelStartDeg),
        effectiveKerfMm(DEFAULT_KERF_MM, seg.cutMiterEndDeg, seg.cutBevelEndDeg),
      )
      expect(seg.lengthLongMm + kerf).toBeLessThanOrEqual(6000)
    }

    // End-to-end: packProfile (the real downstream consumer, same one the
    // order sheet calls) must accept these segments without throwing —
    // this is the exact failure mode the LED purlin hit ("не влезает").
    expect(() => packProfile(segments, 6000, DEFAULT_KERF_MM)).not.toThrow()
  })

  it('дальний-первый (furthest-first), не первый попавшийся: with TWO reachable candidates in the same window, picking the furthest one gives 2 pieces, not 3', () => {
    // L-shape (same construction as the tier-1 test) whose lamella pattern
    // now yields TWO purlin division points within the bottom beam's first
    // window (2700mm and 5400mm — both well inside the ~6980mm capacity for
    // a 7000mm-stock, 40mm-wide profile's 45°-mitred corners). A greedy that
    // picked the FIRST reachable candidate (2700) instead of the FURTHEST
    // (5400) would still complete the beam (2700 + 4680mm second window
    // easily reaches 5400, then the 2700mm remainder) — feasible either
    // way, this specific candidate layout can't be pushed into outright
    // infeasibility (see planBoundaries' docstring: furthest-reachable is
    // PROVABLY optimal for reachability by a standard exchange argument —
    // no ordering ever does strictly better than furthest-first at
    // reaching the end) — but it needs a THIRD, unnecessary piece: 2700 +
    // 2700 + 2700 vs furthest-first's 6000 + 2100. This is the concrete,
    // checkable signature of "furthest, not first" in the implementation.
    const contour: Point2D[] = [
      [0, 0], [8100, 0], [8100, 3000], [9000, 3000], [9000, 7000], [0, 7000],
    ]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [7000] }],
      ['lam-1', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 3001 }], // dir-extent 9000 ⇒ points at 3000, 6000... see below
      ['purlin-1', { widthMm: 40, heightMm: 60, interruptsLamella: false }],
    ])
    const spec = baseSpec(contour, { purlinProfileId: 'purlin-1' })

    const frame = computeFrame(spec, profiles)
    const purlins = computePurlins(spec, profiles)

    const bottomBeam = frame.beams.find(
      (b) => Math.abs(b.position[0]) < 1 && Math.abs(b.position[2]) < 1 && b.lengthAxisMm === 8100,
    )!

    const result = segmentBeamsForStock(spec, frame, purlins, profiles)
    expect(result.issues).toEqual([])

    const segments = result.beams
      .filter((b) => b.id.startsWith(bottomBeam.id))
      .sort((a, b) => a.position[0] - b.position[0])

    // Furthest-first: 2 pieces (splice at whichever candidate is closest to
    // — but still under — the capacity limit), not 3 (which a first-found
    // /closest-first strategy would produce from the same candidate set).
    expect(segments).toHaveLength(2)
  })

  it('две балки, встречающиеся в вершине: adjacent edges sharing a corner, BOTH longer than stock, segment independently WITHOUT disturbing the shared corner', () => {
    // Rectangle where every edge exceeds the 6000mm stock (9000 and 7000) —
    // every pair of adjacent beams shares a corner. Verifies the concrete
    // worry "на реальной большой пергале углы поедут": does each beam's
    // OWN segmentation ever touch/duplicate the corner it shares with its
    // neighbour, or add a new post so close to it that the corner joint
    // effectively shifts?
    //
    // It structurally cannot, by construction, and this test is the proof:
    // findJointCandidates only ever returns points STRICTLY inside
    // (0, totalLenMm) of a beam's OWN axis (see its `add` guard) — a
    // shared corner sits at distMm≈0 or ≈totalLenMm for BOTH adjacent
    // beams, so it is never treated as a splice candidate by either side;
    // it stays exactly what computeFrame made it (the real corner post,
    // real 45°-family end miter). Each beam's own new post can only land
    // strictly between its two corners, never at/near a corner it doesn't
    // own.
    const contour: Point2D[] = [[0, 0], [9000, 0], [9000, 7000], [0, 7000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour)
    const frame = computeFrame(spec, profiles)
    expect(frame.beams).toHaveLength(4) // all 4 edges exceed 6000mm
    expect(frame.posts).toHaveLength(4) // 4 corners, no maxSpanMm intermediates

    const result = segmentBeamsForStock(spec, frame, [], profiles)
    expect(result.issues).toEqual([])

    // Exactly 4 corner posts (untouched, still there, still exactly 4 — no
    // duplicate corner post was created by either of the two beams that
    // share it) + exactly one NEW post per edge (4 edges ⇒ 4 new posts).
    const corners: Point2D[] = [[0, 0], [9000, 0], [9000, 7000], [0, 7000]]
    for (const [cx, cz] of corners) {
      const atCorner = result.posts.filter(
        (p) => Math.abs(p.position[0] - cx) < 1 && Math.abs(p.position[2] - cz) < 1,
      )
      expect(atCorner).toHaveLength(1) // still exactly one, not duplicated by either neighbour
    }
    expect(result.posts).toHaveLength(4 + 4)

    // Every NEW (non-corner) post sits comfortably inside its own edge —
    // at least 1000mm from BOTH corners it's between (a real mid-span
    // splice, not a near-corner one masquerading as "the corner shifted").
    const newPosts = result.posts.filter(
      (p) => !corners.some((c) => Math.abs(p.position[0] - c[0]) < 1 && Math.abs(p.position[2] - c[1]) < 1),
    )
    expect(newPosts).toHaveLength(4)
    for (const p of newPosts) {
      const distToNearestCorner = Math.min(
        ...corners.map((c) => Math.hypot(p.position[0] - c[0], p.position[2] - c[1])),
      )
      expect(distToNearestCorner).toBeGreaterThan(1000)
    }

    // And each beam's own two end segments still carry the SAME end-miter
    // angles computeFrame originally assigned that corner — segmentation
    // of one beam never mutates its neighbour's (or its own) corner angle.
    for (const beam of frame.beams) {
      const segs = result.beams.filter((b) => b.id.startsWith(beam.id)).sort((a, b) =>
        Math.hypot(a.position[0] - beam.position[0], a.position[2] - beam.position[2]) -
        Math.hypot(b.position[0] - beam.position[0], b.position[2] - beam.position[2]),
      )
      expect(segs[0].cutMiterStartDeg).toBeCloseTo(beam.cutMiterStartDeg, 3)
      expect(segs[segs.length - 1].cutMiterEndDeg).toBeCloseTo(beam.cutMiterEndDeg, 3)
    }
  })

  // TODO (не блокер для Правила Б, но не терять — см. прошлый ответ
  // пользователя): computeFrame currently emits ONE beam per polygon edge
  // ONLY (see frame.ts FrameResult doc) — there are no internal cross-beams
  // yet, so no two DIFFERENT beams can ever claim the exact same splice
  // point today (proven by the test above for the one case that DOES
  // exist — shared corners). The genuinely open question — "if a future
  // cross-beam creates a real T-junction where TWO long beams must splice
  // at the SAME physical point, do they share ONE post or does each plant
  // its own?" — has no reproducible scenario to test against yet. Revisit
  // once cross-beams (or any structure where two DIFFERENT beams' own
  // findJointCandidates could return a coincident point) exist, and add a
  // test asserting segmentBeamsForStock reuses (not duplicates) that post
  // for the SECOND beam processed, the same way it already reuses another
  // beam's post today (see `crossingPool`/`already` guard).
  it.todo('cross-beam T-junction: two long beams sharing a genuine mid-span joint splice against ONE shared post')

  it('reports a construction issue (does not silently pack) when a hanging pergola has a too-long beam and no fallback post is possible', () => {
    const contour: Point2D[] = [[0, 0], [8000, 0], [6000, 3000], [2000, 3000]]
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['post-1', { widthMm: 80, heightMm: 80 }],
      ['beam-1', { widthMm: 40, heightMm: 100, availableStockLengthsMm: [6000] }],
      ['lam-1', { widthMm: 70, heightMm: 20 }],
    ])
    const spec = baseSpec(contour, { supportType: 'hanging' })
    const frame = computeFrame(spec, profiles)
    expect(frame.posts).toHaveLength(0)

    const result = segmentBeamsForStock(spec, frame, [], profiles)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].code).toBe('beam-exceeds-stock-no-joint')
    expect(result.issues[0].pieceId).toBe(frame.beams.find((b) => b.lengthAxisMm === 8000)!.id)
    // The original (too-long) piece is still returned, not dropped — the
    // order sheet's existing per-option error handling surfaces it honestly.
    expect(result.beams.find((b) => b.lengthAxisMm === 8000)).toBeDefined()
  })
})

describe('snapBoundaryToExistingPost — re-target a fresh splice onto a nearby existing post when safe', () => {
  // Same asymmetric-ends beam for every case below: start end is a cheap
  // straight cut (reserve ≈ kerf only), end end is a real 45°/200mm-wide
  // corner miter (reserve ≈ 107mm) — see prompt "притягивается к
  // существующей стойке": planBoundaries' own shared `capacityMm` is the MAX
  // reserve across the whole wing, so it under-states how far a window whose
  // OWN two real segments are cheaper can actually stretch. This function
  // must recover that slack with the EXACT per-segment reserve, not the
  // coarse one.
  const WIDTH_MM = 200
  const KERF_MM = DEFAULT_KERF_MM
  const MAX_STOCK_MM = 6000

  function asymmetricBeam(): CutPiece {
    return {
      id: 'beam-asym',
      role: 'beam',
      profileId: 'beam-1',
      lengthAxisMm: 9000,
      lengthLongMm: 9100,
      lengthShortMm: 8900,
      cutMiterStartDeg: 0,
      cutBevelStartDeg: 0,
      cutHandStart: 'straight',
      cutMiterEndDeg: 45,
      cutBevelEndDeg: 0,
      cutHandEnd: 'L',
      position: [0, 2600, 0],
      rotation: [0, 0, 0],
      color: '#fff',
    }
  }

  it('snaps onto an existing post just beyond the coarse window when the exact reserve still fits stock', () => {
    const beam = asymmetricBeam()
    // capacityMm (coarse) = 6000 - max(reserveFirst≈5, reserveInternal≈5, reserveLast≈107.07) ≈ 5892.93 —
    // an existing post at 5940 is just beyond it, a crossing piece at 5850 (no post) is just inside it.
    const candidates: JointCandidate[] = [
      { distMm: 5850, hasPost: false },
      { distMm: 5940, hasPost: true },
    ]

    const snapped = snapBoundaryToExistingPost(
      5850, // planBoundaries' own greedy choice within the coarse window
      0, 9000, // wing's true start/end — this IS the wing's only internal boundary
      true, true, // both adjacent segments touch a real wing end
      candidates,
      beam,
      WIDTH_MM,
      KERF_MM,
      MAX_STOCK_MM,
      DEFAULT_SNAP_TOLERANCE_MM,
    )

    expect(snapped).toBe(5940)
  })

  it('does NOT snap when no existing post lies within the tolerance', () => {
    const beam = asymmetricBeam()
    const candidates: JointCandidate[] = [
      { distMm: 5850, hasPost: false },
      { distMm: 5850 + DEFAULT_SNAP_TOLERANCE_MM + 1, hasPost: true }, // just outside tolerance
    ]

    const snapped = snapBoundaryToExistingPost(
      5850, 0, 9000, true, true, candidates, beam, WIDTH_MM, KERF_MM, MAX_STOCK_MM, DEFAULT_SNAP_TOLERANCE_MM,
    )

    expect(snapped).toBe(5850)
  })

  it('does NOT snap when landing on the existing post would make a piece longer than stock (with kerf)', () => {
    const beam = asymmetricBeam()
    // 6010 is within tolerance of 5850, but 6010 + reserveFirst(≈5) > 6000 —
    // an unsafe snap: the resulting first piece would not fit the stock.
    const candidates: JointCandidate[] = [
      { distMm: 5850, hasPost: false },
      { distMm: 6010, hasPost: true },
    ]

    const snapped = snapBoundaryToExistingPost(
      5850, 0, 9000, true, true, candidates, beam, WIDTH_MM, KERF_MM, MAX_STOCK_MM, DEFAULT_SNAP_TOLERANCE_MM,
    )

    expect(snapped).toBe(5850)
  })

  it('does NOT snap onto a candidate outside the (prevBoundaryMm, nextBoundaryMm) window, even if numerically within tolerance', () => {
    const beam = asymmetricBeam()
    const candidates: JointCandidate[] = [
      { distMm: 5850, hasPost: false },
      { distMm: 9200, hasPost: true }, // beyond nextBoundaryMm=9000 — not a candidate for THIS splice
    ]

    const snapped = snapBoundaryToExistingPost(
      5850, 0, 9000, true, true, candidates, beam, WIDTH_MM, KERF_MM, MAX_STOCK_MM, DEFAULT_SNAP_TOLERANCE_MM,
    )

    expect(snapped).toBe(5850)
  })

  it('регресс: segmentBeamsForStock reuses the existing mid-span post instead of planting a second one ~90mm away', () => {
    // A hand-built FrameResult (not computeFrame's own uniform maxSpanMm
    // placement — that always centers a single intermediate post, which
    // can't reproduce "existing post just past the coarse window" on its
    // own): one asymmetric-ends beam, an existing post at 5940 (e.g. from
    // maxSpanMm placement upstream), and a crossing piece endpoint at 5850
    // (e.g. a purlin) that the OLD (pre-snap) behaviour would have turned
    // into its own brand-new post, ~90mm from the real one.
    const beam = asymmetricBeam()
    const profiles: Map<string, ProfileDimensions> = new Map([
      ['beam-1', { widthMm: WIDTH_MM, heightMm: 100, availableStockLengthsMm: [MAX_STOCK_MM] }],
      ['post-1', { widthMm: 80, heightMm: 80 }],
    ])
    const cornerStart: CutPiece = {
      id: 'corner-start', role: 'post', profileId: 'post-1',
      lengthAxisMm: 2600, lengthLongMm: 2600, lengthShortMm: 2600,
      cutMiterStartDeg: 0, cutBevelStartDeg: 0, cutHandStart: 'straight',
      cutMiterEndDeg: 0, cutBevelEndDeg: 0, cutHandEnd: 'straight',
      position: [0, 0, 0], rotation: [0, 0, 0], color: '#fff',
    }
    const cornerEnd: CutPiece = { ...cornerStart, id: 'corner-end', position: [9000, 0, 0] }
    const existingMidPost: CutPiece = { ...cornerStart, id: 'existing-mid-post', position: [5940, 0, 0] }
    const frame: FrameResult = { beams: [beam], posts: [cornerStart, cornerEnd, existingMidPost], isOrthogonal: true }

    const crossingPurlinEnd: CutPiece = {
      id: 'purlin-crossing', role: 'purlin', profileId: 'post-1',
      lengthAxisMm: 1000, lengthLongMm: 1000, lengthShortMm: 1000,
      cutMiterStartDeg: 0, cutBevelStartDeg: 0, cutHandStart: 'straight',
      cutMiterEndDeg: 0, cutBevelEndDeg: 0, cutHandEnd: 'straight',
      position: [5850, 2600, 0], rotation: [0, 0, 0], color: '#fff',
    }

    const spec = baseSpec([[0, 0], [9000, 0], [9000, 2000], [0, 2000]], {
      beamProfileId: 'beam-1',
      postProfileId: 'post-1',
    })

    const result = segmentBeamsForStock(spec, frame, [crossingPurlinEnd], profiles, KERF_MM)

    expect(result.issues).toEqual([])
    // No new post ~90mm from the existing one — the existing post is reused.
    expect(result.posts).toHaveLength(3)
    expect(result.posts.some((p) => Math.abs(p.position[0] - 5940) < 1)).toBe(true)
    expect(result.posts.some((p) => Math.abs(p.position[0] - 5850) < 1)).toBe(false)

    const segments = result.beams
      .filter((b) => b.id.startsWith(beam.id))
      .sort((a, b) => a.position[0] - b.position[0])
    expect(segments).toHaveLength(2)
    expect(segments[0].lengthAxisMm).toBeCloseTo(5940, 1)
    expect(segments[1].lengthAxisMm).toBeCloseTo(3060, 1)
  })
})
