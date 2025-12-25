'use client'

import { useMemo, useRef } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import type { PergolaMeshProps } from './types'
import { cm } from './utils'

export function PergolaMesh({ params, postSizeCm, beamHeightCm, beamDepthCm, lamellaHeightCm, lamellaDepthCm }: PergolaMeshProps): ReactElement {
  const groupRef = useRef<THREE.Group>(null)

  // Derived dimensions (in scene units)
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

  // Materials
  const metalMat = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.35 }), [color])
  const lamellaMat = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 }), [color])

  // Lamella positions and count
  const lamellaCount = Math.max(0, Math.floor(innerDepth / (lamellaDepth + lamellaGap)))
  const lamellas = useMemo(() => {
    const items: number[] = []
    for (let i = 0; i < lamellaCount; i++) items.push(i)
    return items
  }, [lamellaCount, lamellaGap, lamellaDepth, innerDepth])

  // Intermediate beam positions (חוצצים) - every 150 cm
  const intermediateBeamPositions = useMemo(() => {
    const positions: number[] = []
    if (params.widthCm > 150) {
      const beamSpacingCm = 150
      let positionCm = beamSpacingCm
      // Add beams every 150 cm, but stop before the right edge (which has its own beam)
      while (positionCm < params.widthCm - beamDepthCm) {
        positions.push(positionCm)
        positionCm += beamSpacingCm
      }
    }
    return positions
  }, [params.widthCm, beamDepthCm])

  // Post positions: base corners
  const basePostPositions: [number, number, number][] = params.attachedToWall
    ? [
        [-width / 2 + postSize / 2, height / 2, -depth / 2 + postSize / 2], // Front left
        [width / 2 - postSize / 2, height / 2, -depth / 2 + postSize / 2],  // Front right
      ]
    : [
        [-width / 2 + postSize / 2, height / 2, -depth / 2 + postSize / 2], // Front left
        [width / 2 - postSize / 2, height / 2, -depth / 2 + postSize / 2],   // Front right
        [-width / 2 + postSize / 2, height / 2, depth / 2 - postSize / 2], // Back left
        [width / 2 - postSize / 2, height / 2, depth / 2 - postSize / 2],    // Back right
      ]

  // Additional posts if width > 5m (500cm): add posts every ~250cm along width
  const additionalWidthPosts = useMemo(() => {
    const posts: [number, number, number][] = []
    if (params.widthCm > 500) {
      const spacingCm = 250 // Add post every 2.5m
      let positionCm = spacingCm
      // Add posts between left and right edges
      while (positionCm < params.widthCm - postSizeCm) {
        const x = cm(positionCm - params.widthCm / 2)
        // Front posts
        posts.push([x, height / 2, -depth / 2 + postSize / 2])
        // Back posts (only if not attached to wall)
        if (!params.attachedToWall) {
          posts.push([x, height / 2, depth / 2 - postSize / 2])
        }
        positionCm += spacingCm
      }
    }
    return posts
  }, [params.widthCm, params.attachedToWall, width, depth, height, postSize])

  // Additional posts if depth > 5m (500cm): add posts every ~250cm along depth
  const additionalDepthPosts = useMemo(() => {
    const posts: [number, number, number][] = []
    if (params.depthCm > 500 && !params.attachedToWall) {
      const spacingCm = 250 // Add post every 2.5m
      let positionCm = spacingCm
      // Add posts between front and back edges
      while (positionCm < params.depthCm - postSizeCm) {
        const z = cm(positionCm - params.depthCm / 2)
        // Left side posts
        posts.push([-width / 2 + postSize / 2, height / 2, z])
        // Right side posts
        posts.push([width / 2 - postSize / 2, height / 2, z])
        positionCm += spacingCm
      }
    }
    return posts
  }, [params.depthCm, params.attachedToWall, width, depth, height, postSize])

  // Combine all post positions
  const postPositions = [...basePostPositions, ...additionalWidthPosts, ...additionalDepthPosts]

  return (
    <group ref={groupRef}>
      {/* Posts */}
      {postPositions.map((p, i) => (
        <mesh key={`post-${i}`} position={p} castShadow receiveShadow material={metalMat}>
          <boxGeometry args={[postSize, height, postSize]} />
        </mesh>
      ))}

      {/* Top perimeter frame at height */}
      {/* Front beam: always present */}
      <mesh position={[0, height, -depth / 2 + frameDepth / 2]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[width, frameHeight, frameDepth]} />
      </mesh>
      {/* Back beam: always present (attached to wall if attachedToWall is true) */}
      <mesh position={[0, height, depth / 2 - frameDepth / 2]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[width, frameHeight, frameDepth]} />
      </mesh>
      {/* Left / right beams: length along Z, thickness X = frameDepth */}
      <mesh position={[-width / 2 + frameDepth / 2, height, 0]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[frameDepth, frameHeight, Math.max(0, depth - frameDepth * 2)]} />
      </mesh>
      <mesh position={[width / 2 - frameDepth / 2, height, 0]} castShadow receiveShadow material={metalMat}>
        <boxGeometry args={[frameDepth, frameHeight, Math.max(0, depth - frameDepth * 2)]} />
      </mesh>

      {/* Intermediate beams (חוצצים) - every 150 cm */}
      {intermediateBeamPositions.map((positionCm) => {
        // Convert to scene units: position from center = positionCm - widthCm/2
        const x = cm(positionCm - params.widthCm / 2)
        return (
          <mesh key={`intermediate-${positionCm}`} position={[x, height, 0]} castShadow receiveShadow material={metalMat}>
            <boxGeometry args={[frameDepth, frameHeight, Math.max(0, depth - frameDepth * 2)]} />
          </mesh>
        )
      })}

      {/* Lamellas: aligned with bottom edge of frame, parallel (rotation = 0) */}
      {lamellas.map((i) => {
        const z = -innerDepth / 2 + lamellaDepth / 2 + i * (lamellaDepth + lamellaGap)
        // Frame center is at 'height', frame height is 'frameHeight'
        // Bottom edge of frame = height - frameHeight / 2
        // Position lamella so its bottom edge aligns with frame bottom edge
        const frameBottom = height - frameHeight / 2
        const y = frameBottom + lamellaHeight / 2
        return (
          <mesh key={`lamella-${i}`} position={[0, y, z]} rotation={[0, 0, 0]} castShadow receiveShadow material={lamellaMat}>
            <boxGeometry args={[innerWidth, lamellaHeight, lamellaDepth]} />
          </mesh>
        )
      })}
    </group>
  )
}

