'use client'

import { useMemo } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { ledPurlinPieces } from '@pashkovsky/pergola-core'
import { buildCutPieceMeshes, buildBatchedCutPieceMesh, buildLedStripMeshes } from './geometryBuilder'

export interface PergolaCutPieceSceneProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
}

/**
 * Содержимое сцены (без <Canvas>) — балки/стойки/прогоны отдельными Mesh
 * (их обычно десятки, не сотни), ламели — одним THREE.BatchedMesh (см.
 * промпт «производительность становится обязательной»: на узком профиле
 * ламели даже без сегментации счёт на сотни-тысячи деталей, отдельные Mesh
 * там реально проседают по FPS). Плюс земля-плоскость для масштаба.
 *
 * Никакого собственного состояния: meshes пересобираются из pieces/profiles
 * на каждый рендер (см. промпт шага 3D — «3D не хранит своё состояние»),
 * заново вызывать computeFrame/computeLamellas при каждом нажатии кнопки —
 * обязанность хоста (apps/crm), не этого компонента.
 */
export function PergolaCutPieceScene({ pieces, profiles }: PergolaCutPieceSceneProps): ReactElement {
  const lamellaPieces = useMemo(() => pieces.filter((p) => p.role === 'lamella'), [pieces])
  const otherPieces = useMemo(() => pieces.filter((p) => p.role !== 'lamella'), [pieces])

  const otherMeshes = useMemo(() => buildCutPieceMeshes(otherPieces, profiles), [otherPieces, profiles])
  const lamellaBatch = useMemo(
    () => buildBatchedCutPieceMesh(lamellaPieces, profiles),
    [lamellaPieces, profiles],
  )
  // Полосы света точно по геометрии прогонов с hasLedChannel (см. промпт
  // «подсветка встроена в профиль прогона») — ядро уже решило, какие
  // прогоны это несут (ledPurlinPieces), рендер только рисует то, что вернул ядро.
  const ledMeshes = useMemo(() => buildLedStripMeshes(ledPurlinPieces(pieces, profiles), profiles), [
    pieces,
    profiles,
  ])

  const groundSize = useMemo(() => {
    const box = new THREE.Box3()
    for (const mesh of otherMeshes) {
      mesh.updateMatrixWorld(true)
      box.expandByObject(mesh)
    }
    if (lamellaBatch) {
      lamellaBatch.computeBoundingBox()
      lamellaBatch.updateMatrixWorld(true)
      if (lamellaBatch.boundingBox) box.union(lamellaBatch.boundingBox)
    }
    if (box.isEmpty()) return 20
    const size = box.getSize(new THREE.Vector3())
    const footprint = Math.max(size.x, size.z)
    // Запас по краям — контур не должен упираться в границу земли-плоскости.
    return Math.max(20, footprint * 2.2)
  }, [otherMeshes, lamellaBatch])

  return (
    <group>
      <ambientLight intensity={0.7} color="#f0f4ff" />
      <directionalLight
        position={[10, 16, 10]}
        intensity={1.3}
        color="#fff8ee"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.35} color="#c8d8ff" />

      {otherMeshes.map((mesh) => (
        <primitive key={String(mesh.userData.cutPieceId)} object={mesh} />
      ))}
      {lamellaBatch && <primitive object={lamellaBatch} />}
      {ledMeshes.map((mesh) => (
        <primitive key={String(mesh.userData.cutPieceId)} object={mesh} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.9} metalness={0} />
      </mesh>
      <gridHelper args={[groundSize, Math.round(groundSize)]} position={[0, 0, 0]} />
    </group>
  )
}
