'use client'

import type { ReactElement } from 'react'
import type { Locale } from '@/lib/locales'
import type { PergolaParams } from './types'
import { useSaver } from './useSaver'
import { PergolaMesh } from './PergolaMesh'
import { Lights, Ground } from './SceneElements'

interface SceneWithSaveBridgeProps {
  locale: Locale
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
  params,
  postSizeCm,
  beamHeightCm,
  beamDepthCm,
  lamellaHeightCm,
  lamellaDepthCm,
  onSaveSuccess,
  onSaveError,
}: SceneWithSaveBridgeProps): ReactElement {
  const save = useSaver(() => params, locale, { onSuccess: onSaveSuccess, onError: onSaveError })
  ;(globalThis as Record<string, unknown>).__savePergola = save

  return (
    <>
      <Lights />
      <PergolaMesh
        params={params}
        postSizeCm={postSizeCm}
        beamHeightCm={beamHeightCm}
        beamDepthCm={beamDepthCm}
        lamellaHeightCm={lamellaHeightCm}
        lamellaDepthCm={lamellaDepthCm}
      />
      <Ground />
    </>
  )
}
