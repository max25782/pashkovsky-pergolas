'use client'

import { useLayoutEffect } from 'react'
import type { ReactElement } from 'react'
import { ContactShadows, Environment } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export type ScenePresetId = 'classic' | 'courtyard'

export interface ScenePreset {
  id: ScenePresetId
  environment: 'city' | 'park'
  background: string
  ground: string
  sunPosition: [number, number, number]
  sunIntensity: number
  sunColor: string
}

export const SCENE_PRESETS: Record<ScenePresetId, ScenePreset> = {
  classic: {
    id: 'classic',
    environment: 'city',
    background: '#c5d4e2',
    ground: '#c8c2b6',
    sunPosition: [12, 18, 8],
    sunIntensity: 1.35,
    sunColor: '#fff4e5',
  },
  courtyard: {
    id: 'courtyard',
    environment: 'park',
    background: '#b7c9b4',
    ground: '#7d8b62',
    sunPosition: [8, 16, 12],
    sunIntensity: 1.15,
    sunColor: '#fff8ee',
  },
}

export interface SceneBackdropProps {
  preset?: ScenePresetId
  groundSize: number
}

/**
 * Lighting and environment only. The pergola geometry stays one mesh set;
 * this component swaps IBL + ground, never the structure.
 */
export function SceneBackdrop({ preset = 'classic', groundSize }: SceneBackdropProps): ReactElement {
  const scene = SCENE_PRESETS[preset] ?? SCENE_PRESETS.classic
  const threeScene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)

  useLayoutEffect(() => {
    const bg = new THREE.Color(scene.background)
    threeScene.background = bg
    gl.setClearColor(bg, 1)
  }, [gl, scene.background, threeScene])

  return (
    <group>
      <Environment preset={scene.environment} background={false} />
      <ambientLight intensity={0.18} color="#f4f1ea" />
      <directionalLight
        position={scene.sunPosition}
        intensity={scene.sunIntensity}
        color={scene.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow raycast={() => {}}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={scene.ground} roughness={0.92} metalness={0} />
      </mesh>
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.42}
        scale={groundSize}
        blur={2.2}
        far={8}
        frames={1}
      />
    </group>
  )
}
