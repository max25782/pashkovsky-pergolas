'use client'

import { useMemo, useRef } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import type { PergolaMeshProps } from './types'
import { cm } from './utils'

export function PergolaMesh({
  params,
  postSizeCm,
  beamHeightCm,
  beamDepthCm,
  lamellaHeightCm,
  lamellaDepthCm,
}: PergolaMeshProps): ReactElement {
  const groupRef = useRef<THREE.Group>(null)

  const postSize = cm(postSizeCm)
  const frameHeight = cm(beamHeightCm)
  const frameDepth = cm(beamDepthCm)
  const lamellaHeight = cm(lamellaHeightCm)
  const lamellaDepth = cm(lamellaDepthCm)
  const lamellaGap = cm(params.lamellaGapCm)

  const width = cm(params.widthCm)
  const depth = cm(params.depthCm)
  const height = cm(params.heightCm)

  const innerWidth = Math.max(0, width - frameDepth * 2)
  const innerDepth = Math.max(0, depth - frameDepth * 2)

  const color = useMemo(() => new THREE.Color(params.color), [params.color])

  const metalMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.35 }),
    [color],
  )
  const lamellaMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 }),
    [color],
  )

  // Footprint = dimension of the lamella along its spacing axis
  // Standing → thin side (lamellaHeight); flat → wide side (lamellaDepth)
  const lamellaFootprint = params.lamellaStanding ? lamellaHeight : lamellaDepth

  // Default: spaced along X (width). lamellaAlongWidth: spaced along Z (depth).
  const lamellaSpan = params.lamellaAlongWidth ? innerDepth : innerWidth

  // Compute count so actual gap never exceeds lamellaGap.
  // n lamellas → (n+1) gaps; solve: (span - n*footprint)/(n+1) <= lamellaGap
  const lamellaCount = useMemo(() => {
    if (lamellaSpan <= 0 || lamellaFootprint <= 0) return 0
    if (lamellaGap <= 0) return Math.max(1, Math.floor(lamellaSpan / lamellaFootprint))
    const minCount = Math.ceil((lamellaSpan - lamellaGap) / (lamellaFootprint + lamellaGap))
    return Math.max(1, minCount)
  }, [lamellaSpan, lamellaFootprint, lamellaGap])

  const lamellas = useMemo(() => {
    const items: number[] = []
    for (let i = 0; i < lamellaCount; i++) items.push(i)
    return items
  }, [lamellaCount])

  // Intermediate cross-beams along width: max span 140 cm, always equal spacing.
  // e.g. 280 cm → 2 equal spans of 140 cm → 1 beam at 140 cm
  //      300 cm → ceil(300/140)=3 spans of 100 cm → 2 beams at 100, 200 cm
  const intermediateBeamPositions = useMemo(() => {
    const MAX_SPAN = 140
    if (params.widthCm <= MAX_SPAN) return []
    const segments = Math.ceil(params.widthCm / MAX_SPAN)
    const spacingCm = params.widthCm / segments
    const positions: number[] = []
    for (let i = 1; i < segments; i++) positions.push(spacingCm * i)
    return positions
  }, [params.widthCm])

  // Post positions
  function intermediatePositionsCm(spanCm: number, maxSpanCm = 500): number[] {
    if (spanCm <= maxSpanCm) return []
    const segments = Math.ceil(spanCm / maxSpanCm)
    const spacingCm = spanCm / segments
    const positions: number[] = []
    for (let i = 1; i < segments; i++) positions.push(spacingCm * i)
    return positions
  }

  const basePostPositions: [number, number, number][] = params.attachedToWall
    ? [
        [-width / 2 + postSize / 2, height / 2, depth / 2 - postSize / 2],
        [width / 2 - postSize / 2, height / 2, depth / 2 - postSize / 2],
      ]
    : [
        [-width / 2 + postSize / 2, height / 2, -depth / 2 + postSize / 2],
        [width / 2 - postSize / 2, height / 2, -depth / 2 + postSize / 2],
        [-width / 2 + postSize / 2, height / 2, depth / 2 - postSize / 2],
        [width / 2 - postSize / 2, height / 2, depth / 2 - postSize / 2],
      ]

  const additionalWidthPosts = useMemo(() => {
    const posts: [number, number, number][] = []
    for (const positionCm of intermediatePositionsCm(params.widthCm)) {
      const x = cm(positionCm - params.widthCm / 2)
      posts.push([x, height / 2, depth / 2 - postSize / 2])
      if (!params.attachedToWall) {
        posts.push([x, height / 2, -depth / 2 + postSize / 2])
      }
    }
    return posts
  }, [params.widthCm, params.attachedToWall, width, depth, height, postSize])

  const additionalDepthPosts = useMemo(() => {
    const posts: [number, number, number][] = []
    if (!params.attachedToWall) {
      for (const positionCm of intermediatePositionsCm(params.depthCm)) {
        const z = cm(positionCm - params.depthCm / 2)
        posts.push([-width / 2 + postSize / 2, height / 2, z])
        posts.push([width / 2 - postSize / 2, height / 2, z])
      }
    }
    return posts
  }, [params.depthCm, params.attachedToWall, width, depth, height, postSize])

  const postPositions = [...basePostPositions, ...additionalWidthPosts, ...additionalDepthPosts]

  return (
    <group ref={groupRef}>
      {/* Posts */}
      {postPositions.map((p, i) => (
        <mesh key={`post-${i}`} position={p} castShadow receiveShadow material={metalMat}>
          <boxGeometry args={[postSize, height, postSize]} />
        </mesh>
      ))}

      {/* Perimeter frame beams */}
      <mesh position={[0, height, -depth / 2 + frameDepth / 2]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[width, frameHeight, frameDepth]} />
      </mesh>
      <mesh position={[0, height, depth / 2 - frameDepth / 2]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[width, frameHeight, frameDepth]} />
      </mesh>
      <mesh position={[-width / 2 + frameDepth / 2, height, 0]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[frameDepth, frameHeight, Math.max(0, depth - frameDepth * 2)]} />
      </mesh>
      <mesh position={[width / 2 - frameDepth / 2, height, 0]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[frameDepth, frameHeight, Math.max(0, depth - frameDepth * 2)]} />
      </mesh>

      {/* Intermediate cross-beams along width + optional LED strip */}
      {intermediateBeamPositions.map((positionCm) => {
        const x = cm(positionCm - params.widthCm / 2)
        const beamDepthInner = Math.max(0, depth - frameDepth * 2)
        return (
          <group key={`intermediate-${positionCm}`}>
            <mesh position={[x, height, 0]} castShadow receiveShadow material={metalMat}>
              <boxGeometry args={[frameDepth, frameHeight, beamDepthInner]} />
            </mesh>
            {params.beamLed && (
              <>
                {/* LED channel — thin glowing strip on the underside of the beam */}
                <mesh position={[x, height - frameHeight / 2 - 0.005, 0]}>
                  <boxGeometry args={[frameDepth * 0.6, 0.01, beamDepthInner * 0.95]} />
                  <meshStandardMaterial
                    color="#fffbe6"
                    emissive="#ffe066"
                    emissiveIntensity={2.5}
                    roughness={0.2}
                    metalness={0}
                  />
                </mesh>
                {/* Point light to cast warm glow */}
                <pointLight
                  position={[x, height - frameHeight / 2 - 0.02, 0]}
                  color="#ffe066"
                  intensity={0.6}
                  distance={cm(120)}
                  decay={2}
                />
              </>
            )}
          </group>
        )
      })}

      {/* Lamellas — evenly spaced */}
      {lamellas.map((i) => {
        const frameBottom = height - frameHeight / 2
        // Standing: wide side is vertical height, thin side is footprint
        // Flat: thin side is vertical height, wide side is footprint
        const renderH = params.lamellaStanding ? lamellaDepth : lamellaHeight
        const renderFootprint = params.lamellaStanding ? lamellaHeight : lamellaDepth
        const y = frameBottom + renderH / 2

        if (params.lamellaAlongWidth) {
          // "לאורך הרוחב" — spaced along Z (depth), each lamella runs full width X
          const totalGapSpace = innerDepth - lamellaCount * renderFootprint
          const gap = lamellaCount > 0 ? totalGapSpace / (lamellaCount + 1) : 0
          const z = -innerDepth / 2 + gap + renderFootprint / 2 + i * (renderFootprint + gap)
          return (
            <mesh
              key={`lamella-${i}`}
              position={[0, y, z]}
              castShadow
              receiveShadow
              material={lamellaMat}
            >
              <boxGeometry args={[width, renderH, renderFootprint]} />
            </mesh>
          )
        }

        // Default: spaced along X (width), each lamella runs full depth Z
        const totalGapSpace = innerWidth - lamellaCount * renderFootprint
        const gap = lamellaCount > 0 ? totalGapSpace / (lamellaCount + 1) : 0
        const x = -innerWidth / 2 + gap + renderFootprint / 2 + i * (renderFootprint + gap)
        return (
          <mesh
            key={`lamella-${i}`}
            position={[x, y, 0]}
            castShadow
            receiveShadow
            material={lamellaMat}
          >
            <boxGeometry args={[renderFootprint, renderH, depth]} />
          </mesh>
        )
      })}
    </group>
  )
}
