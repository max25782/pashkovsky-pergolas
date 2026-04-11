'use client'

import { useMemo } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import type { PergolaMeshProps } from './types'
import { cm } from './utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A rectangular section of the pergola — main body or an arm */
interface Section {
  /** Center X of this section in world space */
  cx: number
  /** Center Z of this section in world space */
  cz: number
  widthM: number
  depthM: number
}

/**
 * Build the list of sections for the chosen shape.
 * All coordinates are in metres (Three.js units).
 *
 * Layout (top-down view, X = right, Z = forward):
 *
 *  Rectangle:  single section centred at origin
 *
 *  L-shape:    pergola wraps an OUTER corner of the building.
 *              Main body runs along the back wall (X direction).
 *              Arm runs along the right side wall (Z direction).
 *              Both share the same corner post at top-right of main body.
 *
 *              Wall corner is at X = width/2, Z = 0
 *
 *              ════════╗   ← back wall (Z=0)
 *              ┌──────┐║
 *              │ main │║  ← right side wall (X = width/2 + arm1Width)
 *              │      │╠══════╗
 *              └──────┘║      ║
 *                      ║ arm  ║
 *                      ║      ║
 *                      ╚══════╝
 *
 *  U-shape:    main body across the back, two arms extending forward
 *              ┌──────────────┐
 *              │     main     │
 *              ├──┐        ┌──┤
 *              │L │        │R │
 *              └──┘        └──┘
 */
function buildSections(
  width: number,
  depth: number,
  arm1Width: number,
  arm1Depth: number,
  shape: 'rectangle' | 'L' | 'U',
): Section[] {
  if (shape === 'rectangle') {
    return [{ cx: 0, cz: 0, widthM: width, depthM: depth }]
  }

  if (shape === 'L') {
    // Main body centred at origin, back edge at Z = -depth/2 (touching back wall).
    // Arm attached at right side of main body, back edge flush with main body.
    //
    // Top-down view (X = right, Z = forward):
    //
    //  ════════════════════════╗  ← back wall (Z = -depth/2)
    //  │    main body          ║
    //  │   (width × depth)     ║
    //  └───────────────────────┘
    //                      ┌───┐
    //                      │arm│ arm1Width × arm1Depth
    //                      └───┘
    //  arm back edge = main body back edge = Z = -depth/2
    const mainCx = 0
    const mainCz = 0
    const armCx = width / 2 + arm1Width / 2
    const armCz = -depth / 2 + arm1Depth / 2
    return [
      { cx: mainCx, cz: mainCz, widthM: width, depthM: depth },
      { cx: armCx, cz: armCz, widthM: arm1Width, depthM: arm1Depth },
    ]
  }

  // U-shape: main body at back, left arm + right arm extending forward
  // Main body spans full width, arm1Depth deep, at back (negative Z)
  const mainCz = -(depth - arm1Depth) / 2
  const armCz = arm1Depth / 2 + mainCz + (depth - arm1Depth) / 2 - arm1Depth / 2
  // Simpler: main body centred at back, arms centred at front sides
  const mainCzU = -(arm1Depth) / 2
  const armCzU = depth / 2 - arm1Depth / 2
  const leftArmCx = -(width / 2 - arm1Width / 2)
  const rightArmCx = width / 2 - arm1Width / 2
  return [
    { cx: 0, cz: mainCzU, widthM: width, depthM: depth - arm1Depth },
    { cx: leftArmCx, cz: armCzU, widthM: arm1Width, depthM: arm1Depth },
    { cx: rightArmCx, cz: armCzU, widthM: arm1Width, depthM: arm1Depth },
  ]
}

// ---------------------------------------------------------------------------
// Sub-component: one rectangular pergola section
// ---------------------------------------------------------------------------

interface SectionMeshProps {
  section: Section
  height: number
  postSize: number
  frameHeight: number
  frameDepth: number
  lamellaHeight: number
  lamellaDepth: number
  lamellaGap: number
  lamellaCount: number
  lamellaStanding: boolean
  lamellaAlongWidth: boolean
  beamLed: boolean
  metalMat: THREE.MeshStandardMaterial
  lamellaMat: THREE.MeshStandardMaterial
  /** Post corners to SKIP because they are shared with an adjacent section */
  skipPostCorners?: Set<string>
  /** Intermediate beam positions along width (cm from left edge of section) */
  intermediateBeamPositionsCm: number[]
  widthCm: number
  /** Intermediate post positions along width beams (cm from left edge) */
  widthPostPositionsCm: number[]
  /** Intermediate post positions along depth beams (cm from front edge) */
  depthPostPositionsCm: number[]
  attachedToWall: boolean
}

function SectionMesh({
  section,
  height,
  postSize,
  frameHeight,
  frameDepth,
  lamellaHeight,
  lamellaDepth,
  lamellaGap,
  lamellaCount,
  lamellaStanding,
  lamellaAlongWidth,
  beamLed,
  metalMat,
  lamellaMat,
  skipPostCorners = new Set(),
  intermediateBeamPositionsCm,
  widthCm,
  widthPostPositionsCm,
  depthPostPositionsCm,
  attachedToWall,
}: SectionMeshProps): ReactElement {
  const { cx, cz, widthM, depthM } = section
  const innerWidth = Math.max(0, widthM - frameDepth * 2)
  const innerDepth = Math.max(0, depthM - frameDepth * 2)

  // Lamella rendering
  const renderH = lamellaStanding ? lamellaDepth : lamellaHeight
  const renderFootprint = lamellaStanding ? lamellaHeight : lamellaDepth
  const lamellaSpan = lamellaAlongWidth ? innerDepth : innerWidth
  const frameBottom = height - frameHeight / 2

  const lamellaEls = useMemo(() => {
    const els: ReactElement[] = []
    for (let i = 0; i < lamellaCount; i++) {
      const totalGapSpace = lamellaSpan - lamellaCount * renderFootprint
      const gap = lamellaCount > 0 ? totalGapSpace / (lamellaCount + 1) : 0
      const y = frameBottom + renderH / 2
      if (lamellaAlongWidth) {
        const z = cz - innerDepth / 2 + gap + renderFootprint / 2 + i * (renderFootprint + gap)
        els.push(
          <mesh key={`lam-${i}`} position={[cx, y, z]} castShadow receiveShadow material={lamellaMat}>
            <boxGeometry args={[widthM, renderH, renderFootprint]} />
          </mesh>,
        )
      } else {
        const x = cx - innerWidth / 2 + gap + renderFootprint / 2 + i * (renderFootprint + gap)
        els.push(
          <mesh key={`lam-${i}`} position={[x, y, cz]} castShadow receiveShadow material={lamellaMat}>
            <boxGeometry args={[renderFootprint, renderH, depthM]} />
          </mesh>,
        )
      }
    }
    return els
  }, [lamellaCount, lamellaSpan, renderFootprint, renderH, lamellaAlongWidth, cx, cz, innerWidth, innerDepth, widthM, depthM, frameBottom, lamellaMat])

  // Corner post positions for this section
  const corners: Array<{ key: string; x: number; z: number }> = [
    { key: 'tl', x: cx - widthM / 2 + postSize / 2, z: cz - depthM / 2 + postSize / 2 },
    { key: 'tr', x: cx + widthM / 2 - postSize / 2, z: cz - depthM / 2 + postSize / 2 },
    { key: 'bl', x: cx - widthM / 2 + postSize / 2, z: cz + depthM / 2 - postSize / 2 },
    { key: 'br', x: cx + widthM / 2 - postSize / 2, z: cz + depthM / 2 - postSize / 2 },
  ]

  const beamDepthInner = Math.max(0, depthM - frameDepth * 2)

  // Intermediate posts along width beams (front and back)
  const widthPostEls = useMemo(() => {
    const els: ReactElement[] = []
    const frontZ = cz - depthM / 2 + postSize / 2
    const backZ  = cz + depthM / 2 - postSize / 2
    for (const posCm of widthPostPositionsCm) {
      const x = cx - widthM / 2 + cm(posCm)
      // Back beam post always
      els.push(
        <mesh key={`wp-back-${posCm}`} position={[x, height / 2, backZ]} castShadow receiveShadow material={metalMat}>
          <boxGeometry args={[postSize, height, postSize]} />
        </mesh>,
      )
      // Front beam post only if free-standing
      if (!attachedToWall) {
        els.push(
          <mesh key={`wp-front-${posCm}`} position={[x, height / 2, frontZ]} castShadow receiveShadow material={metalMat}>
            <boxGeometry args={[postSize, height, postSize]} />
          </mesh>,
        )
      }
    }
    return els
  }, [widthPostPositionsCm, cx, cz, widthM, depthM, postSize, height, metalMat, attachedToWall])

  // Intermediate posts along depth beams (left and right sides) — free-standing only
  const depthPostEls = useMemo(() => {
    if (attachedToWall) return []
    const els: ReactElement[] = []
    const leftX  = cx - widthM / 2 + postSize / 2
    const rightX = cx + widthM / 2 - postSize / 2
    for (const posCm of depthPostPositionsCm) {
      const z = cz - depthM / 2 + cm(posCm)
      els.push(
        <mesh key={`dp-left-${posCm}`} position={[leftX, height / 2, z]} castShadow receiveShadow material={metalMat}>
          <boxGeometry args={[postSize, height, postSize]} />
        </mesh>,
        <mesh key={`dp-right-${posCm}`} position={[rightX, height / 2, z]} castShadow receiveShadow material={metalMat}>
          <boxGeometry args={[postSize, height, postSize]} />
        </mesh>,
      )
    }
    return els
  }, [depthPostPositionsCm, cx, cz, widthM, depthM, postSize, height, metalMat, attachedToWall])

  return (
    <group>
      {/* Corner posts — skip back corners when attached to wall */}
      {corners
        .filter((c) => !skipPostCorners.has(c.key))
        .filter((c) => !(attachedToWall && (c.key === 'tl' || c.key === 'tr')))
        .map((c) => (
          <mesh key={`post-${c.key}`} position={[c.x, height / 2, c.z]} castShadow receiveShadow material={metalMat}>
            <boxGeometry args={[postSize, height, postSize]} />
          </mesh>
        ))}

      {/* Intermediate posts along outer beams */}
      {widthPostEls}
      {depthPostEls}

      {/* Perimeter frame beams */}
      <mesh position={[cx, height, cz - depthM / 2 + frameDepth / 2]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[widthM, frameHeight, frameDepth]} />
      </mesh>
      <mesh position={[cx, height, cz + depthM / 2 - frameDepth / 2]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[widthM, frameHeight, frameDepth]} />
      </mesh>
      <mesh position={[cx - widthM / 2 + frameDepth / 2, height, cz]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[frameDepth, frameHeight, Math.max(0, depthM - frameDepth * 2)]} />
      </mesh>
      <mesh position={[cx + widthM / 2 - frameDepth / 2, height, cz]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[frameDepth, frameHeight, Math.max(0, depthM - frameDepth * 2)]} />
      </mesh>

      {/* Intermediate cross-beams + optional LED */}
      {intermediateBeamPositionsCm.map((posCm) => {
        const x = cx - widthM / 2 + cm(posCm)
        return (
          <group key={`ib-${posCm}`}>
            <mesh position={[x, height, cz]} castShadow receiveShadow material={metalMat}>
              <boxGeometry args={[frameDepth, frameHeight, beamDepthInner]} />
            </mesh>
            {beamLed && (
              <>
                <mesh position={[x, height - frameHeight / 2 - 0.005, cz]}>
                  <boxGeometry args={[frameDepth * 0.6, 0.01, beamDepthInner * 0.95]} />
                  <meshStandardMaterial color="#fffbe6" emissive="#ffe066" emissiveIntensity={2.5} roughness={0.2} metalness={0} />
                </mesh>
                <pointLight position={[x, height - frameHeight / 2 - 0.02, cz]} color="#ffe066" intensity={0.6} distance={cm(120)} decay={2} />
              </>
            )}
          </group>
        )
      })}

      {/* Lamellas */}
      {lamellaEls}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PergolaMesh({
  params,
  postSizeCm,
  beamHeightCm,
  beamDepthCm,
  lamellaHeightCm,
  lamellaDepthCm,
}: PergolaMeshProps): ReactElement {
  const postSize = cm(postSizeCm)
  const frameHeight = cm(beamHeightCm)
  const frameDepth = cm(beamDepthCm)
  const lamellaHeight = cm(lamellaHeightCm)
  const lamellaDepth = cm(lamellaDepthCm)
  const lamellaGap = cm(params.lamellaGapCm)
  const height = cm(params.heightCm)

  const width = cm(params.widthCm)
  const depth = cm(params.depthCm)
  const arm1Width = cm(params.arm1WidthCm)
  const arm1Depth = cm(params.arm1DepthCm)
  const shape = params.shapeType ?? 'rectangle'

  const color = useMemo(() => new THREE.Color(params.color), [params.color])
  const metalMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.35 }),
    [color],
  )
  const lamellaMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 }),
    [color],
  )

  const sections = useMemo(
    () => buildSections(width, depth, arm1Width, arm1Depth, shape),
    [width, depth, arm1Width, arm1Depth, shape],
  )

  // Lamella count — computed per section based on its own span
  function lamellaCountForSection(sec: Section): number {
    const innerW = Math.max(0, sec.widthM - frameDepth * 2)
    const innerD = Math.max(0, sec.depthM - frameDepth * 2)
    const lamellaFootprint = params.lamellaStanding ? lamellaHeight : lamellaDepth
    const span = params.lamellaAlongWidth ? innerD : innerW
    if (span <= 0 || lamellaFootprint <= 0) return 0
    if (lamellaGap <= 0) return Math.max(1, Math.floor(span / lamellaFootprint))
    return Math.max(1, Math.ceil((span - lamellaGap) / (lamellaFootprint + lamellaGap)))
  }

  // Intermediate beam positions for a section (cm from left edge).
  // 200/50 profile (beamHeightCm >= 18) is strong enough — no intermediate beams needed.
  function intermediateBeamPositionsCm(secWidthCm: number): number[] {
    if (beamHeightCm >= 18) return []
    const MAX_SPAN = 140
    if (secWidthCm <= MAX_SPAN) return []
    const segments = Math.ceil(secWidthCm / MAX_SPAN)
    const spacingCm = secWidthCm / segments
    const positions: number[] = []
    for (let i = 1; i < segments; i++) positions.push(spacingCm * i)
    return positions
  }

  // Intermediate post positions along an outer beam (cm from edge), max 400 cm span
  function intermediatePostPositionsCm(spanCm: number): number[] {
    const MAX_SPAN = 400
    if (spanCm <= MAX_SPAN) return []
    const segments = Math.ceil(spanCm / MAX_SPAN)
    const spacingCm = spanCm / segments
    const positions: number[] = []
    for (let i = 1; i < segments; i++) positions.push(spacingCm * i)
    return positions
  }

  /**
   * For L and U shapes, adjacent sections share a corner post.
   * We compute which world-space post positions are duplicated and skip them
   * in the second (and third) section so we don't double-render.
   */
  const sharedPostPositions = useMemo(() => {
    if (sections.length < 2) return new Map<number, Set<string>>()
    const eps = 0.01
    // Collect all corner world positions from section 0
    const sec0 = sections[0]
    const corners0 = [
      [sec0.cx - sec0.widthM / 2 + postSize / 2, sec0.cz - sec0.depthM / 2 + postSize / 2],
      [sec0.cx + sec0.widthM / 2 - postSize / 2, sec0.cz - sec0.depthM / 2 + postSize / 2],
      [sec0.cx - sec0.widthM / 2 + postSize / 2, sec0.cz + sec0.depthM / 2 - postSize / 2],
      [sec0.cx + sec0.widthM / 2 - postSize / 2, sec0.cz + sec0.depthM / 2 - postSize / 2],
    ]
    const result = new Map<number, Set<string>>()
    for (let si = 1; si < sections.length; si++) {
      const sec = sections[si]
      const skip = new Set<string>()
      const cornerKeys = ['tl', 'tr', 'bl', 'br']
      const corners = [
        [sec.cx - sec.widthM / 2 + postSize / 2, sec.cz - sec.depthM / 2 + postSize / 2],
        [sec.cx + sec.widthM / 2 - postSize / 2, sec.cz - sec.depthM / 2 + postSize / 2],
        [sec.cx - sec.widthM / 2 + postSize / 2, sec.cz + sec.depthM / 2 - postSize / 2],
        [sec.cx + sec.widthM / 2 - postSize / 2, sec.cz + sec.depthM / 2 - postSize / 2],
      ]
      for (let ci = 0; ci < corners.length; ci++) {
        const [x, z] = corners[ci]
        for (const [ox, oz] of corners0) {
          if (Math.abs(x - ox) < eps && Math.abs(z - oz) < eps) {
            skip.add(cornerKeys[ci])
            break
          }
        }
      }
      result.set(si, skip)
    }
    return result
  }, [sections, postSize])

  return (
    <group>
      {sections.map((sec, si) => {
        const secWidthCm = si === 0 ? params.widthCm : params.arm1WidthCm
        const secDepthCm = si === 0 ? params.depthCm : params.arm1DepthCm
        return (
          <SectionMesh
            key={`sec-${si}`}
            section={sec}
            height={height}
            postSize={postSize}
            frameHeight={frameHeight}
            frameDepth={frameDepth}
            lamellaHeight={lamellaHeight}
            lamellaDepth={lamellaDepth}
            lamellaGap={lamellaGap}
            lamellaCount={lamellaCountForSection(sec)}
            lamellaStanding={params.lamellaStanding}
            lamellaAlongWidth={params.lamellaAlongWidth}
            beamLed={params.beamLed}
            metalMat={metalMat}
            lamellaMat={lamellaMat}
            skipPostCorners={sharedPostPositions.get(si)}
            intermediateBeamPositionsCm={intermediateBeamPositionsCm(secWidthCm)}
            widthCm={secWidthCm}
            widthPostPositionsCm={intermediatePostPositionsCm(secWidthCm)}
            depthPostPositionsCm={intermediatePostPositionsCm(secDepthCm)}
            attachedToWall={params.attachedToWall ?? false}
          />
        )
      })}
    </group>
  )
}
