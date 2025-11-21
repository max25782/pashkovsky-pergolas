'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ReactElement } from 'react'
import * as THREE from 'three'

export function Lights(): ReactElement {
  const dirRef = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    if (!dirRef.current) return
    dirRef.current.position.set(5, 8, 5)
    dirRef.current.target.position.set(0, 0, 0)
    dirRef.current.target.updateMatrixWorld()
  })
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight ref={dirRef} intensity={1.0} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
    </>
  )
}

export function Ground(): ReactElement {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <shadowMaterial opacity={0.2} />
    </mesh>
  )
}

