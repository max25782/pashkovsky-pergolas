import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import {
  buildCutPieceGeometry,
  buildCutPieceMesh,
  buildCutPieceMeshes,
  buildBatchedCutPieceMesh,
  buildLedStripMesh,
  buildLedStripMeshes,
} from './geometryBuilder'
import { MM_TO_M } from './units'

// ── Helpers ───────────────────────────────────────────────────────────────────

function beamPiece(overrides: Partial<CutPiece> = {}): CutPiece {
  return {
    id: 'beam-0',
    role: 'beam',
    profileId: 'beam-100x40',
    lengthAxisMm: 1000,
    lengthLongMm: 1000,
    lengthShortMm: 1000,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 2600, 0],
    rotation: [0, 0, 0],
    color: '#9aa0a6',
    ...overrides,
  }
}

function postPiece(overrides: Partial<CutPiece> = {}): CutPiece {
  return {
    id: 'post-0',
    role: 'post',
    profileId: 'post-80',
    lengthAxisMm: 2600,
    lengthLongMm: 2600,
    lengthShortMm: 2600,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [500, 0, 300],
    rotation: [0, 0, 0],
    color: '#9aa0a6',
    ...overrides,
  }
}

const beamProfile: ProfileDimensions = { widthMm: 40, heightMm: 100 }
const postProfile: ProfileDimensions = { widthMm: 80, heightMm: 80 }

function profilesMap(): Map<string, ProfileDimensions> {
  return new Map([
    ['beam-100x40', beamProfile],
    ['post-80', postProfile],
  ])
}

function bbox(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox()
  return geometry.boundingBox!.clone()
}

// ── Straight beam (no miter) ──────────────────────────────────────────────────

describe('buildCutPieceGeometry — straight beam (miter=0 both ends)', () => {
  it('produces a plain box: X ∈ [0,lengthAxisMm], Y based on HEIGHT (vertical), Z centered on WIDTH (in-plan) — all in metres', () => {
    // Axis convention fix: Y must carry the vertical (heightMm) dimension —
    // rotation.y (azimuth) is invariant on Y, so only Y stays vertical for
    // any edge angle. Z carries the in-plan width (perpendicular to length),
    // which correctly rotates together with X (length) under rotation.y.
    const piece = beamPiece()
    const geo = buildCutPieceGeometry(piece, beamProfile)
    const box = bbox(geo)

    expect(box.min.x).toBeCloseTo(0, 6)
    expect(box.max.x).toBeCloseTo(1000 * MM_TO_M, 6)
    expect(box.min.y).toBeCloseTo(0, 6) // based mode: 0..heightMm
    expect(box.max.y).toBeCloseTo(100 * MM_TO_M, 6) // heightMm
    expect(box.min.z).toBeCloseTo(-20 * MM_TO_M, 6) // widthMm/2 = 20, centred
    expect(box.max.z).toBeCloseTo(20 * MM_TO_M, 6)
  })

  it('has 24 vertices (4 per face, flat-shaded — no smoothed corner normals) and 6 quads worth of indices', () => {
    const geo = buildCutPieceGeometry(beamPiece(), beamProfile)
    expect(geo.getAttribute('position').count).toBe(24)
    expect(geo.getIndex()!.count).toBe(36) // 6 faces * 2 triangles * 3
  })

  it('computed face normals point outward along the 3 principal axes for a straight (unmitered) box', () => {
    const geo = buildCutPieceGeometry(beamPiece(), beamProfile)
    const normalAttr = geo.getAttribute('normal')
    const seen = new Set<string>()
    for (let face = 0; face < 6; face++) {
      const nx = Math.round(normalAttr.getX(face * 4))
      const ny = Math.round(normalAttr.getY(face * 4))
      const nz = Math.round(normalAttr.getZ(face * 4))
      seen.add(`${nx},${ny},${nz}`)
    }
    // The 6 faces of a straight box must cover exactly the 6 signed axis directions.
    expect(seen).toEqual(new Set(['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1']))
  })
})

// ── Mitered beam ends ──────────────────────────────────────────────────────

describe('buildCutPieceGeometry — mitered ends', () => {
  it('a 45° hand=L end cap extends the -Z corner past lengthAxisMm and pulls the +Z corner short of it', () => {
    // Width (long/short side) now lives on Z, not Y — see axis-convention fix.
    // Sign verified against a real convex polygon corner (see fix commit):
    // for hand='L' the LONG point ends up on local Z<0, which after
    // rotation.y=-θ lands on the EXTERIOR side of the polygon — physically
    // correct (like a picture-frame corner: the outer edge is the long one).
    // 45° miter on a 40mm-wide profile → Δ = tan(45°)*20 = 20mm exactly.
    const piece = beamPiece({
      lengthAxisMm: 1000,
      cutMiterEndDeg: 45,
      cutHandEnd: 'L',
    })
    const geo = buildCutPieceGeometry(piece, beamProfile)
    const pos = geo.getAttribute('position')

    let maxXAtPositiveZ = -Infinity
    let maxXAtNegativeZ = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      if (z > 0) maxXAtPositiveZ = Math.max(maxXAtPositiveZ, x)
      else maxXAtNegativeZ = Math.max(maxXAtNegativeZ, x)
    }

    const lengthM = 1000 * MM_TO_M
    const deltaM = 20 * MM_TO_M
    expect(maxXAtNegativeZ).toBeCloseTo(lengthM + deltaM, 6) // long point, hand='L' → -Z side
    expect(maxXAtPositiveZ).toBeCloseTo(lengthM - deltaM, 6) // short point
  })

  it('hand=R reverses which Z-side is long', () => {
    const piece = beamPiece({ lengthAxisMm: 1000, cutMiterEndDeg: 45, cutHandEnd: 'R' })
    const geo = buildCutPieceGeometry(piece, beamProfile)
    const pos = geo.getAttribute('position')

    let maxXAtPositiveZ = -Infinity
    let maxXAtNegativeZ = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      if (z > 0) maxXAtPositiveZ = Math.max(maxXAtPositiveZ, x)
      else maxXAtNegativeZ = Math.max(maxXAtNegativeZ, x)
    }

    const lengthM = 1000 * MM_TO_M
    const deltaM = 20 * MM_TO_M
    expect(maxXAtPositiveZ).toBeCloseTo(lengthM + deltaM, 6) // long point now on +Z side
    expect(maxXAtNegativeZ).toBeCloseTo(lengthM - deltaM, 6)
  })

  it('start-end miter matches lengthLongMm/lengthShortMm bookkeeping on the piece (sum of both ends)', () => {
    // Δstart(30°) + Δend(20°) on a 40mm profile: tan(30)*20 + tan(20)*20 ≈ 11.547 + 7.276 = 18.823mm
    const piece = beamPiece({
      lengthAxisMm: 1000,
      cutMiterStartDeg: 30,
      cutHandStart: 'L',
      cutMiterEndDeg: 20,
      cutHandEnd: 'L',
    })
    const geo = buildCutPieceGeometry(piece, beamProfile)
    const pos = geo.getAttribute('position')

    let minXAtNegativeZ = Infinity
    let maxXAtNegativeZ = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i)
      if (z >= 0) continue
      minXAtNegativeZ = Math.min(minXAtNegativeZ, pos.getX(i))
      maxXAtNegativeZ = Math.max(maxXAtNegativeZ, pos.getX(i))
    }

    const dStart = Math.tan((30 * Math.PI) / 180) * 20
    const dEnd = Math.tan((20 * Math.PI) / 180) * 20
    const expectedLongPointToLongPointM = (1000 + dStart + dEnd) * MM_TO_M
    expect(maxXAtNegativeZ - minXAtNegativeZ).toBeCloseTo(expectedLongPointToLongPointM, 5)
  })
})

// ── Regression: azimuth rotation must never rotate HEIGHT off vertical ──────
//
// Root cause of the "beam lying on its side" bug: rotation.y (azimuth) is a
// rotation about the local Y axis, which three.js leaves invariant and only
// mixes X/Z. If the profile's vertical HEIGHT lived on Y=width/Z=height (the
// old, buggy layout), any azimuth ≠ 0 would drag the height dimension into
// the horizontal plane while the (small) width dimension stayed glued
// vertical. These tests build a full mesh (geometry + piece.rotation applied)
// and inspect the WORLD-SPACE bounding box, which is the only way to catch
// this class of bug — per-geometry (pre-rotation) tests above cannot.
describe('buildCutPieceMesh — azimuth rotation keeps profile HEIGHT vertical (standing-beam regression)', () => {
  it.each([0, Math.PI / 6, Math.PI / 2, 2.3, -Math.PI / 3])(
    'world Y-extent equals profile heightMm (100mm), never the (smaller) widthMm (40mm), at rotation.y=%d',
    (angle) => {
      const piece = beamPiece({ rotation: [0, angle, 0], position: [0, 2600, 0], lengthAxisMm: 1000 })
      const mesh = buildCutPieceMesh(piece, profilesMap())
      mesh.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(mesh)
      const size = box.getSize(new THREE.Vector3())
      expect(size.y).toBeCloseTo(100 * MM_TO_M, 5)
    },
  )

  it('azimuth 0 (edge along world +X): footprint is length×width in the XZ plane, bottom face flush at position.y', () => {
    const piece = beamPiece({ rotation: [0, 0, 0], position: [0, 2600, 0], lengthAxisMm: 1000 })
    const mesh = buildCutPieceMesh(piece, profilesMap())
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(mesh)
    expect(box.max.x - box.min.x).toBeCloseTo(1000 * MM_TO_M, 5)
    expect(box.max.z - box.min.z).toBeCloseTo(40 * MM_TO_M, 5)
    expect(box.max.y - box.min.y).toBeCloseTo(100 * MM_TO_M, 5)
    expect(box.min.y).toBeCloseTo(2600 * MM_TO_M, 5)
  })

  it('azimuth -90° (edge along world +Z, matching frame.ts convention): length/width swap into Z/X, height still purely vertical', () => {
    const piece = beamPiece({ rotation: [0, -Math.PI / 2, 0], position: [0, 2600, 0], lengthAxisMm: 1000 })
    const mesh = buildCutPieceMesh(piece, profilesMap())
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(mesh)
    expect(box.max.z - box.min.z).toBeCloseTo(1000 * MM_TO_M, 5)
    expect(box.max.x - box.min.x).toBeCloseTo(40 * MM_TO_M, 5)
    expect(box.max.y - box.min.y).toBeCloseTo(100 * MM_TO_M, 5)
  })
})

// ── Regression: post must seat flush under the beam, at any beam azimuth ────
describe('post/beam seating — post top must sit flush with beam bottom (no gap, no interpenetration)', () => {
  it.each([0, Math.PI / 5, -Math.PI / 3])(
    'beam bottom world-Y equals post top world-Y and equals spec.heightMm, at beam rotation.y=%d',
    (angle) => {
      const heightMm = 2600
      const beam = beamPiece({ position: [0, heightMm, 0], rotation: [0, angle, 0], lengthAxisMm: 1000 })
      const post = postPiece({ position: [0, 0, 0], lengthAxisMm: heightMm })
      const beamMesh = buildCutPieceMesh(beam, profilesMap())
      const postMesh = buildCutPieceMesh(post, profilesMap())
      beamMesh.updateMatrixWorld(true)
      postMesh.updateMatrixWorld(true)
      const beamBox = new THREE.Box3().setFromObject(beamMesh)
      const postBox = new THREE.Box3().setFromObject(postMesh)
      expect(beamBox.min.y).toBeCloseTo(postBox.max.y, 5)
      expect(beamBox.min.y).toBeCloseTo(heightMm * MM_TO_M, 5)
    },
  )
})

// ── Posts ──────────────────────────────────────────────────────────────────

describe('buildCutPieceGeometry — post', () => {
  it('grows along local Y from 0 to lengthAxisMm, with X/Z centred on the profile footprint', () => {
    // Posts get an extra geometry.rotateZ(90°) on top of the (fixed) X/Y/Z
    // box convention (see buildCutPieceGeometry) — that internal rotation
    // maps the post's run onto Y regardless of which axis width/height sit
    // on in the base box, so this numeric result is unaffected by the
    // beam/lamella axis-orientation fix (verified below with a non-square
    // profile, where the fix WOULD show up if the post path were affected).
    const piece = postPiece({ lengthAxisMm: 2600 })
    const geo = buildCutPieceGeometry(piece, postProfile)
    const box = bbox(geo)

    expect(box.min.y).toBeCloseTo(0, 6)
    expect(box.max.y).toBeCloseTo(2600 * MM_TO_M, 6)
    expect(box.min.x).toBeCloseTo(-40 * MM_TO_M, 6) // widthMm/2
    expect(box.max.x).toBeCloseTo(40 * MM_TO_M, 6)
    expect(box.min.z).toBeCloseTo(-40 * MM_TO_M, 6) // heightMm/2, centred (not "based")
    expect(box.max.z).toBeCloseTo(40 * MM_TO_M, 6)
  })

  it('with a non-square profile, both footprint dimensions still end up horizontal (X/Z) — post orientation is unaffected by the beam axis-fix', () => {
    const asymmetricPost: ProfileDimensions = { widthMm: 60, heightMm: 100 }
    const piece = postPiece({ lengthAxisMm: 2600 })
    const geo = buildCutPieceGeometry(piece, asymmetricPost)
    const box = bbox(geo)

    expect(box.max.y - box.min.y).toBeCloseTo(2600 * MM_TO_M, 6) // run, vertical
    const xSpan = box.max.x - box.min.x
    const zSpan = box.max.z - box.min.z
    // both footprint dims land on X/Z (order irrelevant — post never rotates
    // in plan), together they must equal {60, 100} regardless of pairing.
    expect([xSpan, zSpan].sort((a, b) => a - b).map((v) => Math.round(v / MM_TO_M))).toEqual([60, 100])
  })
})

// ── buildCutPieceMesh ──────────────────────────────────────────────────────

describe('buildCutPieceMesh', () => {
  it('applies position (mm→m) and rotation (already radians) from the piece as-is', () => {
    const piece = beamPiece({ position: [1234, 2600, 5678], rotation: [0, Math.PI / 4, 0] })
    const mesh = buildCutPieceMesh(piece, profilesMap())

    expect(mesh.position.x).toBeCloseTo(1234 * MM_TO_M, 6)
    expect(mesh.position.y).toBeCloseTo(2600 * MM_TO_M, 6)
    expect(mesh.position.z).toBeCloseTo(5678 * MM_TO_M, 6)
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 4, 6)
    expect(mesh.userData.cutPieceId).toBe(piece.id)
    expect(mesh.userData.role).toBe('beam')
  })

  it('throws a descriptive error when the piece profileId is missing from the profiles map', () => {
    const piece = beamPiece({ profileId: 'does-not-exist' })
    expect(() => buildCutPieceMesh(piece, profilesMap())).toThrow(/does-not-exist/)
  })

  it('buildCutPieceMeshes builds one mesh per piece, preserving order', () => {
    const pieces = [beamPiece({ id: 'b1' }), postPiece({ id: 'p1' }), beamPiece({ id: 'b2' })]
    const meshes = buildCutPieceMeshes(pieces, profilesMap())
    expect(meshes.map((m) => m.userData.cutPieceId)).toEqual(['b1', 'p1', 'b2'])
  })
})

// ── buildBatchedCutPieceMesh ────────────────────────────────────────────────

function lamellaPiece(overrides: Partial<CutPiece> = {}): CutPiece {
  return {
    id: 'lam-0',
    role: 'lamella',
    profileId: 'lam-70x20',
    lengthAxisMm: 3000,
    lengthLongMm: 3000,
    lengthShortMm: 3000,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 2600, 0],
    rotation: [0, 0, 0],
    color: '#9aa0a6',
    ...overrides,
  }
}

const lamellaProfile: ProfileDimensions = { widthMm: 70, heightMm: 20 }

describe('buildBatchedCutPieceMesh', () => {
  it('returns null for an empty piece list — nothing to draw, nothing to allocate', () => {
    expect(buildBatchedCutPieceMesh([], profilesMap())).toBeNull()
  })

  it('produces a single BatchedMesh holding one instance per piece', () => {
    const pieces = [
      lamellaPiece({ id: 'l0', position: [0, 2600, 0] }),
      lamellaPiece({ id: 'l1', position: [0, 2600, 90] }),
      lamellaPiece({ id: 'l2', position: [0, 2600, 180] }),
    ]
    const profiles = new Map([['lam-70x20', lamellaProfile]])
    const batched = buildBatchedCutPieceMesh(pieces, profiles)

    expect(batched).not.toBeNull()
    expect(batched!.isBatchedMesh).toBe(true)
    // instanceCount getter isn't available on the three@0.167.1 runtime we
    // pin (only on newer @types) — userData.cutPieceIds is our own
    // bookkeeping and is the more reliable count here regardless of version.
    expect(batched!.userData.cutPieceIds).toEqual(['l0', 'l1', 'l2'])
    expect(batched!.userData.role).toBe('lamella')
  })

  it('places each instance at its own piece.position (mm → m), matching individual-mesh placement', () => {
    const piece = lamellaPiece({ id: 'l0', position: [1000, 2600, 500], rotation: [0, Math.PI / 6, 0] })
    const profiles = new Map([['lam-70x20', lamellaProfile]])
    const batched = buildBatchedCutPieceMesh([piece], profiles)!

    const matrix = new THREE.Matrix4()
    batched.getMatrixAt(0, matrix)
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    matrix.decompose(position, quaternion, scale)

    expect(position.x).toBeCloseTo(1000 * MM_TO_M, 6)
    expect(position.y).toBeCloseTo(2600 * MM_TO_M, 6)
    expect(position.z).toBeCloseTo(500 * MM_TO_M, 6)

    const expectedQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 6, 0))
    expect(quaternion.angleTo(expectedQuat)).toBeCloseTo(0, 6)
  })

  it('throws a descriptive error when a piece profileId is missing from the profiles map', () => {
    const piece = lamellaPiece({ profileId: 'does-not-exist' })
    expect(() => buildBatchedCutPieceMesh([piece], profilesMap())).toThrow(/does-not-exist/)
  })
})

// ── LED strip meshes ─────────────────────────────────────────────────────────

function purlinPiece(overrides: Partial<CutPiece> = {}): CutPiece {
  return {
    id: 'purlin-0',
    role: 'purlin',
    profileId: 'purlin-led',
    lengthAxisMm: 3000,
    lengthLongMm: 3000,
    lengthShortMm: 3000,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 2600, 1500],
    rotation: [0, -Math.PI / 2, 0],
    color: '#9aa0a6',
    ...overrides,
  }
}

const purlinProfile: ProfileDimensions = { widthMm: 60, heightMm: 40, hasLedChannel: true }

describe('buildLedStripMesh / buildLedStripMeshes', () => {
  it('produces a mesh sized narrower than the purlin profile width, at the purlin length', () => {
    const piece = purlinPiece({ lengthAxisMm: 2000 })
    const mesh = buildLedStripMesh(piece, purlinProfile)
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!

    const lengthM = box.max.x - box.min.x
    const widthM = box.max.z - box.min.z // width now lives on Z (see axis-orientation fix)
    expect(lengthM).toBeCloseTo(2000 * MM_TO_M, 6)
    expect(widthM).toBeLessThan(purlinProfile.widthMm * MM_TO_M)
  })

  it('inherits position/rotation from the purlin piece as-is', () => {
    const piece = purlinPiece({ position: [111, 2600, 222], rotation: [0, 1.23, 0] })
    const mesh = buildLedStripMesh(piece, purlinProfile)

    expect(mesh.position.x).toBeCloseTo(111 * MM_TO_M, 6)
    expect(mesh.position.y).toBeCloseTo(2600 * MM_TO_M, 6)
    expect(mesh.position.z).toBeCloseTo(222 * MM_TO_M, 6)
    expect(mesh.rotation.y).toBeCloseTo(1.23, 6)
  })

  it('buildLedStripMeshes builds one strip per purlin piece passed in, skipping pieces whose profile is missing', () => {
    const profiles = new Map([['purlin-led', purlinProfile]])
    const pieces = [
      purlinPiece({ id: 'p0' }),
      purlinPiece({ id: 'p1', profileId: 'unknown' }),
      purlinPiece({ id: 'p2' }),
    ]
    const meshes = buildLedStripMeshes(pieces, profiles)
    expect(meshes.map((m) => m.userData.cutPieceId)).toEqual(['p0-led', 'p2-led'])
    expect(meshes.every((m) => m.userData.role === 'led-strip')).toBe(true)
  })
})
