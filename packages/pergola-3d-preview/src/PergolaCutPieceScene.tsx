'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { ledPurlinPieces } from '@pashkovsky/pergola-core'
import { buildCutPieceMeshes, buildBatchedCutPieceMesh, buildLedStripMeshes, buildCutPieceMaterial } from './geometryBuilder'
import { SceneBackdrop, type ScenePresetId } from './SceneBackdrop'
import { MM_TO_M } from './units'

export interface DividerEditProps {
  selectedDividerId?: string | null
  warningDividerIds?: string[]
  addDividerActive?: boolean
  /** Structural purlins with dividerId — used for picking when LED rewrite dropped ids. */
  dividerHitPieces?: CutPiece[]
  onSelectDivider?: (id: string | null) => void
  onMoveDivider?: (id: string, planXMm: number, planYMm: number) => void
  onAddDividerAt?: (planXMm: number, planYMm: number) => void
  onDragChange?: (dragging: boolean) => void
}

export interface PergolaCutPieceSceneProps extends DividerEditProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  colorHex?: string
  scenePreset?: ScenePresetId
}

function isEditablePurlin(piece: CutPiece): boolean {
  return piece.role === 'purlin' && typeof piece.dividerId === 'string' && piece.dividerId.length > 0
}

function pointToPlanMm(event: ThreeEvent<PointerEvent>): { xMm: number; yMm: number } {
  return { xMm: event.point.x / MM_TO_M, yMm: event.point.z / MM_TO_M }
}

function disableRaycast(object: THREE.Object3D | null | undefined) {
  if (!object) return
  object.raycast = () => {}
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
  selectedDividerId = null,
  warningDividerIds = [],
  addDividerActive = false,
  dividerHitPieces,
  onSelectDivider,
  onMoveDivider,
  onAddDividerAt,
  onDragChange,
}: PergolaCutPieceSceneProps): ReactElement {
  const finishToken = colorHex ?? pieces[0]?.color
  const sharedMaterial = useMemo(() => buildCutPieceMaterial(finishToken), [finishToken])
  const selectedMaterial = useMemo(() => {
    const mat = sharedMaterial.clone()
    mat.color = new THREE.Color('#1d4ed8')
    mat.emissive = new THREE.Color('#3b82f6')
    mat.emissiveIntensity = 1.1
    return mat
  }, [sharedMaterial])
  const hoverMaterial = useMemo(() => {
    const mat = sharedMaterial.clone()
    mat.color = new THREE.Color('#d97706')
    mat.emissive = new THREE.Color('#f59e0b')
    mat.emissiveIntensity = 0.95
    return mat
  }, [sharedMaterial])
  const warningMaterial = useMemo(() => {
    const mat = sharedMaterial.clone()
    mat.emissive = new THREE.Color('#b45309')
    mat.emissiveIntensity = 0.45
    return mat
  }, [sharedMaterial])

  const lamellaPieces = useMemo(() => pieces.filter((p) => p.role === 'lamella'), [pieces])
  const visualPurlins = useMemo(() => pieces.filter((p) => p.role === 'purlin'), [pieces])
  const hitPurlins = useMemo(() => {
    const fromHits = (dividerHitPieces ?? []).filter(isEditablePurlin)
    if (fromHits.length > 0) return fromHits
    const fromScene = visualPurlins.filter(isEditablePurlin)
    return fromScene
  }, [dividerHitPieces, visualPurlins])
  const otherPieces = useMemo(
    () => pieces.filter((p) => p.role !== 'lamella' && p.role !== 'purlin'),
    [pieces],
  )

  const otherMeshes = useMemo(
    () => buildCutPieceMeshes(otherPieces, profiles).map((mesh) => {
      mesh.material = sharedMaterial
      disableRaycast(mesh)
      return mesh
    }),
    [otherPieces, profiles, sharedMaterial],
  )
  const purlinMeshes = useMemo(
    () => buildCutPieceMeshes(visualPurlins, profiles),
    [visualPurlins, profiles],
  )
  const lamellaBatch = useMemo(() => {
    const batch = buildBatchedCutPieceMesh(lamellaPieces, profiles, sharedMaterial)
    disableRaycast(batch)
    return batch
  }, [lamellaPieces, profiles, sharedMaterial])
  const ledMeshes = useMemo(
    () => buildLedStripMeshes(ledPurlinPieces(pieces, profiles), profiles).map((mesh) => {
      disableRaycast(mesh)
      return mesh
    }),
    [pieces, profiles],
  )

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const warned = useMemo(() => new Set(warningDividerIds), [warningDividerIds])
  const planeY = (hitPurlins[0] ?? visualPurlins[0] ?? pieces[0])?.position[1] ?? 2600
  const showEditPlane = Boolean(
    (draggingId && onMoveDivider) || (addDividerActive && onAddDividerAt),
  )
  const pickingEnabled = Boolean(onSelectDivider)

  const groundSize = useMemo(() => {
    const box = new THREE.Box3()
    for (const mesh of [...otherMeshes, ...purlinMeshes]) {
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
  }, [otherMeshes, purlinMeshes, lamellaBatch])

  function materialFor(dividerId: string | undefined) {
    if (dividerId && dividerId === selectedDividerId) return selectedMaterial
    if (dividerId && dividerId === hoveredId) return hoverMaterial
    if (dividerId && warned.has(dividerId)) return warningMaterial
    return sharedMaterial
  }

  return (
    <group>
      <SceneBackdrop preset={scenePreset} groundSize={groundSize} />

      {otherMeshes.map((mesh) => (
        <primitive key={String(mesh.userData.cutPieceId)} object={mesh} />
      ))}
      {purlinMeshes.map((mesh) => {
        const dividerId = String(mesh.userData.dividerId ?? '')
        mesh.material = materialFor(dividerId)
        return (
          <primitive
            key={String(mesh.userData.cutPieceId)}
            object={mesh}
            onPointerOver={(event: ThreeEvent<PointerEvent>) => {
              if (!pickingEnabled || !dividerId) return
              event.stopPropagation()
              document.body.style.cursor = 'pointer'
              setHoveredId(dividerId)
            }}
            onPointerOut={(event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation()
              document.body.style.cursor = 'auto'
              setHoveredId(null)
            }}
            onPointerDown={(event: ThreeEvent<PointerEvent>) => {
              if (!pickingEnabled || !dividerId) return
              event.stopPropagation()
              onSelectDivider?.(dividerId)
              if (onMoveDivider) {
                setDraggingId(dividerId)
                onDragChange?.(true)
              }
            }}
          />
        )
      })}
      {lamellaBatch && <primitive object={lamellaBatch} />}
      {ledMeshes.map((mesh) => (
        <primitive key={String(mesh.userData.cutPieceId)} object={mesh} />
      ))}

      {pickingEnabled && <DividerNativePicker onSelect={onSelectDivider} onHover={setHoveredId} />}
      {pickingEnabled &&
        hitPurlins.map((piece) => (
          <DividerHitBox
            key={`hit-${piece.id}`}
            piece={piece}
            profile={profiles.get(piece.profileId)}
            selected={piece.dividerId === selectedDividerId}
            hovered={piece.dividerId === hoveredId}
            onHover={setHoveredId}
            onSelect={(id) => {
              onSelectDivider?.(id)
              if (onMoveDivider) {
                setDraggingId(id)
                onDragChange?.(true)
              }
            }}
          />
        ))}

      {showEditPlane && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, planeY * MM_TO_M, 0]}
          onPointerMove={(event: ThreeEvent<PointerEvent>) => {
            if (!draggingId || !onMoveDivider) return
            event.stopPropagation()
            const { xMm, yMm } = pointToPlanMm(event)
            onMoveDivider(draggingId, xMm, yMm)
          }}
          onPointerUp={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation()
            setDraggingId(null)
            onDragChange?.(false)
          }}
          onPointerDown={(event: ThreeEvent<PointerEvent>) => {
            if (!addDividerActive || !onAddDividerAt || draggingId) return
            event.stopPropagation()
            const { xMm, yMm } = pointToPlanMm(event)
            onAddDividerAt(xMm, yMm)
          }}
        >
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial transparent opacity={addDividerActive ? 0.08 : 0} color="#2563eb" depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function DividerNativePicker({
  onSelect,
  onHover,
}: {
  onSelect?: (id: string | null) => void
  onHover: (id: string | null) => void
}): null {
  const { camera, gl, scene } = useThree()

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    raycaster.params.Mesh = { ...(raycaster.params.Mesh ?? {}), threshold: 0.25 }

    function ndcFromEvent(event: PointerEvent): THREE.Vector2 {
      const rect = el.getBoundingClientRect()
      return new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
    }

    function firstDivider(event: PointerEvent): string | null {
      raycaster.setFromCamera(ndcFromEvent(event), camera)
      const hits: THREE.Intersection[] = []
      scene.traverse((object) => {
        if (!object.userData?.dividerHit || !(object as THREE.Mesh).isMesh) return
        ;(object as THREE.Mesh).raycast(raycaster, hits)
      })
      hits.sort((a, b) => a.distance - b.distance)
      const id = hits[0]?.object.userData.dividerId
      return typeof id === 'string' && id.length > 0 ? id : null
    }

    function onMove(event: PointerEvent) {
      const id = firstDivider(event)
      el.style.cursor = id ? 'pointer' : 'auto'
      onHover(id)
    }

    function onDown(event: PointerEvent) {
      const id = firstDivider(event)
      if (id) {
        event.stopPropagation()
        event.stopImmediatePropagation()
        onSelect?.(id)
        return
      }
      onSelect?.(null)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown, true)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown, true)
      el.style.cursor = 'auto'
    }
  }, [camera, gl, scene, onSelect, onHover])

  return null
}

function DividerHitBox({
  piece,
  profile,
  selected,
  hovered,
  onHover,
  onSelect,
}: {
  piece: CutPiece
  profile: ProfileDimensions | undefined
  selected: boolean
  hovered: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}): ReactElement {
  const dividerId = piece.dividerId as string
  const widthMm = profile?.widthMm ?? 40
  const heightMm = profile?.heightMm ?? 60
  const hitWidth = Math.max(widthMm * 8, 360) * MM_TO_M
  const hitHeight = Math.max(heightMm * 4, 280) * MM_TO_M
  const length = piece.lengthAxisMm * MM_TO_M
  const fill = selected ? 0.38 : hovered ? 0.3 : 0.16

  return (
    <group position={piece.position.map((v) => v * MM_TO_M) as [number, number, number]} rotation={piece.rotation}>
      <mesh
        userData={{ dividerHit: true, dividerId }}
        position={[length / 2, heightMm * MM_TO_M * 0.5, 0]}
        renderOrder={20}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
          onHover(dividerId)
        }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          document.body.style.cursor = 'auto'
          onHover(null)
        }}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          event.nativeEvent?.stopImmediatePropagation?.()
          onSelect(dividerId)
        }}
      >
        <boxGeometry args={[length, hitHeight, hitWidth]} />
        <meshBasicMaterial
          color={selected ? '#2563eb' : '#f59e0b'}
          transparent
          opacity={fill}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
