'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ReactElement } from 'react'
import * as THREE from 'three'

export function Lights(): ReactElement {
  const dirRef = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    if (!dirRef.current) return
    dirRef.current.position.set(8, 12, 8)
    dirRef.current.target.position.set(0, 0, 0)
    dirRef.current.target.updateMatrixWorld()
  })
  return (
    <>
      <ambientLight intensity={0.6} color="#e8f0ff" />
      <directionalLight
        ref={dirRef}
        intensity={1.4}
        color="#fff8ee"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.001}
      />
      {/* fill light from front-left */}
      <directionalLight position={[-6, 4, 6]} intensity={0.3} color="#c8d8ff" />
    </>
  )
}

/** Tiled stone floor */
export function Ground(): ReactElement {
  const texture = useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // base concrete color
    ctx.fillStyle = '#c8c0b4'
    ctx.fillRect(0, 0, size, size)

    // tile grid
    const tileSize = 128
    ctx.strokeStyle = '#a8a098'
    ctx.lineWidth = 3
    for (let x = 0; x <= size; x += tileSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
    }
    for (let y = 0; y <= size; y += tileSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke()
    }

    // subtle noise per tile
    for (let tx = 0; tx < size / tileSize; tx++) {
      for (let ty = 0; ty < size / tileSize; ty++) {
        const v = Math.random() * 20 - 10
        ctx.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`
        ctx.fillRect(tx * tileSize + 4, ty * tileSize + 4, tileSize - 8, tileSize - 8)
      }
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(6, 6)
    return tex
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
    </mesh>
  )
}

/** Building wall behind the pergola — wallZ is the Z center of the wall */
export function BuildingWall({ wallZ = -3 }: { wallZ?: number }): ReactElement {
  const wallTexture = useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // plaster base
    ctx.fillStyle = '#e8e0d4'
    ctx.fillRect(0, 0, size, size)

    // subtle plaster texture noise
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const v = Math.floor(Math.random() * 30 - 15)
      const r = Math.floor(232 + v)
      const g = Math.floor(224 + v)
      const b = Math.floor(212 + v)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 2, 2)
    }

    // subtle horizontal lines (render lines)
    ctx.strokeStyle = 'rgba(160,150,140,0.25)'
    ctx.lineWidth = 1
    for (let y = 0; y < size; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(3, 2)
    return tex
  }, [])

  const wf = wallZ + 0.17  // front face of wall (wallZ is center, thickness 0.3)
  const sideLen = 12       // side wall depth (how far forward they extend)
  const sideMid = wallZ + 0.15 + sideLen / 2

  return (
    <group>
      {/* main back wall */}
      <mesh position={[0, 5, wallZ]} receiveShadow castShadow>
        <boxGeometry args={[20, 10, 0.3]} />
        <meshStandardMaterial map={wallTexture} roughness={0.9} metalness={0.0} />
      </mesh>

      {/* left side wall */}
      <mesh position={[-10, 5, sideMid]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 10, sideLen]} />
        <meshStandardMaterial map={wallTexture} roughness={0.9} metalness={0.0} />
      </mesh>

      {/* right side wall */}
      <mesh position={[10, 5, sideMid]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 10, sideLen]} />
        <meshStandardMaterial map={wallTexture} roughness={0.9} metalness={0.0} />
      </mesh>

      {/* window left */}
      <mesh position={[-3.5, 5.5, wf]} receiveShadow>
        <boxGeometry args={[1.4, 1.8, 0.05]} />
        <meshStandardMaterial color="#6a8aaa" roughness={0.1} metalness={0.3} opacity={0.7} transparent />
      </mesh>
      <mesh position={[-3.5, 5.5, wf + 0.03]}>
        <boxGeometry args={[1.55, 1.95, 0.04]} />
        <meshStandardMaterial color="#d8d0c8" roughness={0.8} />
      </mesh>

      {/* window right */}
      <mesh position={[3.5, 5.5, wf]} receiveShadow>
        <boxGeometry args={[1.4, 1.8, 0.05]} />
        <meshStandardMaterial color="#6a8aaa" roughness={0.1} metalness={0.3} opacity={0.7} transparent />
      </mesh>
      <mesh position={[3.5, 5.5, wf + 0.03]}>
        <boxGeometry args={[1.55, 1.95, 0.04]} />
        <meshStandardMaterial color="#d8d0c8" roughness={0.8} />
      </mesh>

      {/* door */}
      <mesh position={[0, 1.1, wf]} receiveShadow>
        <boxGeometry args={[1.0, 2.2, 0.05]} />
        <meshStandardMaterial color="#7a6050" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.1, wf + 0.03]}>
        <boxGeometry args={[1.15, 2.35, 0.04]} />
        <meshStandardMaterial color="#d8d0c8" roughness={0.8} />
      </mesh>
    </group>
  )
}
