'use client'

import { useMemo } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { ledPurlinPieces } from '@pashkovsky/pergola-core'
import { buildCutPieceMeshes, buildBatchedCutPieceMesh, buildLedStripMeshes, buildCutPieceMaterial } from './geometryBuilder'
import { SceneBackdrop, type ScenePresetId } from './SceneBackdrop'

export interface PergolaCutPieceSceneProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  colorHex?: string
  scenePreset?: ScenePresetId
}

/**
 * Содержимое сцены (без <Canvas>) — балки/стойки/прогоны отдельными Mesh,
 * ламели — одним THREE.BatchedMesh. Свет, земля и IBL живут в SceneBackdrop.
 */
export function PergolaCutPieceScene({
  pieces,
  profiles,
  colorHex,
  scenePreset = 'classic',
}: PergolaCutPieceSceneProps): ReactElement {
  const finishToken = colorHex ?? pieces[0]?.color
  const sharedMaterial = useMemo(() => buildCutPieceMaterial(finishToken), [finishToken])

  const lamellaPieces = useMemo(() => pieces.filter((p) => p.role === 'lamella'), [pieces])
  const otherPieces = useMemo(() => pieces.filter((p) => p.role !== 'lamella'), [pieces])

  const otherMeshes = useMemo(
    () => buildCutPieceMeshes(otherPieces, profiles).map((mesh) => {
      mesh.material = sharedMaterial
      return mesh
    }),
    [otherPieces, profiles, sharedMaterial],
  )
  const lamellaBatch = useMemo(
    () => buildBatchedCutPieceMesh(lamellaPieces, profiles, sharedMaterial),
    [lamellaPieces, profiles, sharedMaterial],
  )
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
    return Math.max(20, footprint * 2.2)
  }, [otherMeshes, lamellaBatch])

  return (
    <group>
      <SceneBackdrop preset={scenePreset} groundSize={groundSize} />

      {otherMeshes.map((mesh) => (
        <primitive key={String(mesh.userData.cutPieceId)} object={mesh} />
      ))}
      {lamellaBatch && <primitive object={lamellaBatch} />}
      {ledMeshes.map((mesh) => (
        <primitive key={String(mesh.userData.cutPieceId)} object={mesh} />
      ))}
    </group>
  )
}
