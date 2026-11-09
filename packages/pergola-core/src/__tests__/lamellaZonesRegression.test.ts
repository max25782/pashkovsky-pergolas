/**
 * Plans without `lamellaZones` must come out exactly as before zones existed.
 * Golden numbers were captured from the code before the zone change
 * (piece counts, summed axis lengths, factory sections); the weight column was
 * taken on the unchanged no-zone path. An empty `lamellaZones` array must equal
 * an absent one, piece for piece.
 */
import { describe, expect, it } from 'vitest'
import { houseSpecInput } from '../acceptance/houseContour'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildLamellaSections,
  buildPieces,
  specFromPlan,
} from '../index'
import { piecesWeightKg } from '../frameParts'
import type { Point2D } from '../types'

type Spec = ReturnType<typeof specFromPlan>
type Key = `${string}:${string}`

interface Golden {
  pieces: number
  weightKg: number
  byKey: Record<Key, { n: number; axis: number }>
  sections: Array<[number, number, number]>
}

const rect = (w: number, h: number): Point2D[] => [[0, 0], [w, 0], [w, h], [0, h]]
const round1 = (v: number) => Math.round(v * 10) / 10

function rectSpec(w: number, h: number, dir: number, zones?: []): Spec {
  return specFromPlan({
    contour: rect(w, h),
    wallEdgeIndices: [],
    params: {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: dir,
      contourReference: 'outer-faces',
      ...(zones ? { lamellaZones: zones } : {}),
    },
  })
}

function summarize(spec: Spec): Golden {
  const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const byKey: Golden['byKey'] = {}
  for (const piece of built.pieces) {
    const key: Key = `${piece.role}:${piece.profileId}`
    const entry = (byKey[key] ??= { n: 0, axis: 0 })
    entry.n += 1
    entry.axis += round1(piece.lengthAxisMm)
  }
  for (const entry of Object.values(byKey)) entry.axis = round1(entry.axis)
  return {
    pieces: built.pieces.length,
    weightKg: Math.round(piecesWeightKg(built.pieces, PERGOLA_CONSTRUCTION_PROFILES) * 1000) / 1000,
    byKey,
    sections: buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES).map((s) => [
      round1(s.widthMm),
      round1(s.heightMm),
      s.lamellaCount,
    ]),
  }
}

const GOLDEN: Record<string, Golden> = {
  house: {
    pieces: 537,
    weightKg: 433.476,
    byKey: {
      'beam:f10040': { n: 12, axis: 39686 },
      'post:f8080': { n: 9, axis: 23400 },
      'lamella:f7020': { n: 505, axis: 629773.4 },
      'purlin:PA3022': { n: 9, axis: 35678.1 },
      'purlin:f10040': { n: 2, axis: 5870 },
    },
    sections: [
      [1295.7, 2772.6, 31], [1295.7, 2772.6, 31], [1295.7, 2783.8, 31], [1295.7, 2783.8, 31],
      [503.6, 2783.8, 31], [1295.7, 4516.2, 50], [1295.7, 4516.2, 50], [1295.7, 4516.2, 50],
      [1295.7, 4522, 50], [1295.7, 4522, 50], [1295.7, 4527.4, 50], [1295.7, 4527.4, 50],
    ],
  },
  'rect-6000x4000-dir0': {
    pieces: 229,
    weightKg: 187.624,
    byKey: {
      'beam:f10040': { n: 4, axis: 20000 },
      'post:f8080': { n: 6, axis: 15600 },
      'lamella:f7020': { n: 215, axis: 244455 },
      'purlin:PA3022': { n: 4, axis: 15680 },
    },
    sections: [[1125, 3890, 43], [1145, 3890, 43], [1145, 3890, 43], [1145, 3890, 43], [1125, 3890, 43]],
  },
  'rect-9000x4000-dir0': {
    pieces: 321,
    weightKg: 271.707,
    byKey: {
      'beam:f10040': { n: 6, axis: 26000 },
      'post:f8080': { n: 8, axis: 20800 },
      'lamella:f7020': { n: 301, axis: 368720.7 },
      'purlin:PA3022': { n: 6, axis: 23520 },
    },
    sections: [
      [1210.7, 3890, 43], [1230.7, 3890, 43], [1230.7, 3890, 43], [1230.7, 3890, 43],
      [1230.7, 3890, 43], [1230.7, 3890, 43], [1210.7, 3890, 43],
    ],
  },
  'rect-6000x4000-dir90': {
    pieces: 207,
    weightKg: 181.271,
    byKey: {
      'beam:f10040': { n: 4, axis: 20000 },
      'post:f8080': { n: 6, axis: 15600 },
      'lamella:f7020': { n: 195, axis: 246668.5 },
      'purlin:PA3022': { n: 2, axis: 11840 },
    },
    sections: [[1258.3, 5890, 65], [1278.3, 5890, 65], [1258.3, 5890, 65]],
  },
  'rect-9000x4000-dir90': {
    pieces: 317,
    weightKg: 273.772,
    byKey: {
      'beam:f10040': { n: 6, axis: 26000 },
      'post:f8080': { n: 10, axis: 26000 },
      'lamella:f7020': { n: 297, axis: 375695.1 },
      'purlin:PA3022': { n: 4, axis: 17840 },
    },
    sections: [[1258.3, 8890, 99], [1278.3, 8890, 99], [1258.3, 8890, 99]],
  },
}

const CASES: Array<{ name: string; spec: (zones?: []) => Spec }> = [
  { name: 'house', spec: (zones) => {
    const input = houseSpecInput()
    return specFromPlan(zones ? { ...input, params: { ...input.params, lamellaZones: zones } } : input)
  } },
  ...[0, 90].flatMap((dir) =>
    [[6000, 4000], [9000, 4000]].map(([w, h]) => ({
      name: `rect-${w}x${h}-dir${dir}`,
      spec: (zones?: []) => rectSpec(w, h, dir, zones),
    })),
  ),
]

describe('plans without lamella zones are unchanged', () => {
  for (const { name, spec } of CASES) {
    it(`${name}: pieces, weight and sections match the pre-zone golden`, () => {
      expect(summarize(spec())).toEqual(GOLDEN[name])
    })

    it(`${name}: an empty lamellaZones list builds the same pieces`, () => {
      const plain = buildPieces(spec(), PERGOLA_CONSTRUCTION_PROFILES)
      const empty = buildPieces(spec([]), PERGOLA_CONSTRUCTION_PROFILES)
      expect(empty.pieces).toEqual(plain.pieces)
      expect(empty.warnings).toEqual(plain.warnings)
      expect(buildLamellaSections(spec([]), PERGOLA_CONSTRUCTION_PROFILES)).toEqual(
        buildLamellaSections(spec(), PERGOLA_CONSTRUCTION_PROFILES),
      )
    })
  }
})
