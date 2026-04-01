'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import type { ConfiguratorLocale } from './locale'
import type { PergolaParams } from './types'
import { cm } from './utils'
import { useSaver } from './useSaver'
import { PergolaMesh } from './PergolaMesh'
import { Lights, Ground, BuildingWall } from './SceneElements'

interface SceneWithSaveBridgeProps {
  locale: ConfiguratorLocale
  linkToken?: string
  readOnly?: boolean
  params: PergolaParams
  postSizeCm: number
  beamHeightCm: number
  beamDepthCm: number
  lamellaHeightCm: number
  lamellaDepthCm: number
  onSaveSuccess?: (message: string) => void
  onSaveError?: (message: string) => void
}

export function SceneWithSaveBridge({
  locale,
  linkToken,
  readOnly = false,
  params,
  postSizeCm,
  beamHeightCm,
  beamDepthCm,
  lamellaHeightCm,
  lamellaDepthCm,
  onSaveSuccess,
  onSaveError,
}: SceneWithSaveBridgeProps): ReactElement {
  const save = useSaver(() => params, locale, {
    onSuccess: onSaveSuccess,
    onError: onSaveError,
    linkToken: readOnly ? undefined : linkToken,
  })
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (readOnly) {
      delete (globalThis as Record<string, unknown>).__savePergola
      return
    }
    const fn = () => saveRef.current()
    ;(globalThis as Record<string, unknown>).__savePergola = fn
    return () => {
      delete (globalThis as Record<string, unknown>).__savePergola
    }
  }, [readOnly])

  // Place the pergola so its back edge is at Z=0 (touching the wall).
  // Pergola back edge in local space = -depth/2, so shift group by +depth/2.
  const pergolaDepth = cm(params.depthCm)
  const pergolaZ = pergolaDepth / 2

  // Wall sits just behind Z=0 (back edge of pergola).
  const wallThickness = 0.3
  const wallZ = -(wallThickness / 2)  // wall center so front face is exactly at Z=0

  return (
    <>
      <Lights />
      <BuildingWall wallZ={wallZ} />
      <group position={[0, 0, pergolaZ]}>
        <PergolaMesh
          params={params}
          postSizeCm={postSizeCm}
          beamHeightCm={beamHeightCm}
          beamDepthCm={beamDepthCm}
          lamellaHeightCm={lamellaHeightCm}
          lamellaDepthCm={lamellaDepthCm}
        />
      </group>
      <Ground />
    </>
  )
}
