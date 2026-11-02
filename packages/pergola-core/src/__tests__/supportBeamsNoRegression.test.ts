/**
 * Plans without supportBeams must stay byte-identical whether the field is
 * omitted or explicitly undefined (Stage 3 regression gate).
 */
import { describe, expect, it } from 'vitest'
import { buildPieces, specFromPlan } from '../buildPieces'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import type { Point2D } from '../types'

const profiles = PERGOLA_CONSTRUCTION_PROFILES

const FIXTURES: Array<{ id: string; contour: Point2D[]; params: typeof DEFAULT_PLAN_CONSTRUCTION_PARAMS; walls?: number[] }> = [
  {
    id: 'rect-4x6',
    contour: [
      [0, 0],
      [4000, 0],
      [4000, 6000],
      [0, 6000],
    ],
    params: DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  },
  {
    id: 'live-L-partial',
    contour: [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [8000, 3000],
      [8000, 6000],
      [0, 6000],
    ],
    params: {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      purlinClearLayoutVersion: 1,
    },
    walls: [1, 2],
  },
]

describe('no supportBeams: omit vs undefined is byte-identical', () => {
  for (const fixture of FIXTURES) {
    it(fixture.id, () => {
      const base = {
        contour: fixture.contour,
        wallEdgeIndices: fixture.walls ?? [],
        params: fixture.params,
      }
      const a = JSON.stringify(buildPieces(specFromPlan(base), profiles).pieces)
      const b = JSON.stringify(
        buildPieces(specFromPlan({ ...base, supportBeams: undefined }), profiles).pieces,
      )
      expect(a).toBe(b)
    })
  }
})
