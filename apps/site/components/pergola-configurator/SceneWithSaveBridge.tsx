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
}

export function SceneWithSaveBridge({
  locale,
  params,
  postSizeCm,
  beamHeightCm,
  beamDepthCm,
  lamellaHeightCm,
  lamellaDepthCm,
}: SceneWithSaveBridgeProps): ReactElement {
  const save = useSaver(() => params, locale)
  // Expose save on window for the outer button to call
  ;(globalThis as any).__savePergola = save
  
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

