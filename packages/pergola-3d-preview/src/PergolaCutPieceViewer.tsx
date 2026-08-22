'use client'

import { useMemo } from 'react'
import type { ReactElement, CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { PergolaCutPieceScene } from './PergolaCutPieceScene'
import { MM_TO_M } from './units'

export interface PergolaCutPieceViewerProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  className?: string
  style?: CSSProperties
}

/**
 * Верхний уровень 3D-подъёма: <Canvas> + OrbitControls + камера, framed под
 * фактический габарит переданных деталей (полигон произвольного размера —
 * от маленького патио до 11-метровой L-образной перголы из приёмочного
 * теста, см. промпт шага 3D). Камеру считаем из piece.position (мм) —
 * дешёвая оценка габарита без сборки геометрии дважды.
 *
 * Строго та цепочка, что описана в промпте: хост (apps/crm) сам вызывает
 * computeFrame/computeLamellas из pergola-core и передаёт готовый CutPiece[]
 * сюда — этот пакет ядро не трогает и ничего не знает о PergolaSpec/полигоне
 * редактора.
 */
export function PergolaCutPieceViewer({
  pieces,
  profiles,
  className,
  style,
}: PergolaCutPieceViewerProps): ReactElement {
  const framing = useMemo(() => computeFraming(pieces), [pieces])

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <Canvas
        shadows
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#c8dff0']} />
        <PerspectiveCamera makeDefault position={framing.cameraPosition} fov={50} near={0.1} far={500} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          target={framing.target}
          maxPolarAngle={Math.PI / 2.02}
        />
        <PergolaCutPieceScene pieces={pieces} profiles={profiles} />
      </Canvas>
    </div>
  )
}

interface Framing {
  cameraPosition: [number, number, number]
  target: [number, number, number]
}

function computeFraming(pieces: CutPiece[]): Framing {
  if (pieces.length === 0) {
    return { cameraPosition: [7, 4, 9], target: [0, 1.3, 0] }
  }

  const box = new THREE.Box3()
  for (const p of pieces) {
    box.expandByPoint(new THREE.Vector3(p.position[0] * MM_TO_M, p.position[1] * MM_TO_M, p.position[2] * MM_TO_M))
  }

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const footprint = Math.max(size.x, size.z, 3)
  const heightM = Math.max(size.y, 2)

  // Отступ камеры пропорционален габариту контура — маленькое патио и
  // 11-метровая L-перголу должны одинаково целиком влезать в кадр.
  const distance = footprint * 0.9 + 3
  return {
    cameraPosition: [center.x + distance * 0.7, heightM + distance * 0.5, center.z + distance * 0.9],
    target: [center.x, heightM * 0.5, center.z],
  }
}
