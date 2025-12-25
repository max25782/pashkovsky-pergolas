'use client'

import { useState } from 'react'
import type { ReactElement } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { Locale } from '@/lib/locales'
import type { PergolaParams } from './types'
import { cm } from './utils'
import { useProfiles } from './useProfiles'
import { ControlsPanel } from './ControlsPanel'
import { SceneWithSaveBridge } from './SceneWithSaveBridge'
import { getTranslations } from './translations'

interface Pergola3DProps {
  locale: Locale
}

export function Pergola3D({ locale }: Pergola3DProps): ReactElement {
  const [params, setParams] = useState<PergolaParams>({
    widthCm: 400,
    depthCm: 350,
    heightCm: 260,
    color: '#9aa0a6',
    lamellaAngleDeg: 0,
    attachedToWall: false,
    lamellaGapCm: 2,
  })

  const { profiles, profilesLoading, candidates } = useProfiles()

  // Selections
  const [postProfileId, setPostProfileId] = useState<string | null>(null)
  const [beamProfileId, setBeamProfileId] = useState<string | null>('f10040')
  const [lamellaProfileId, setLamellaProfileId] = useState<string | null>('f10020')

  // Resolve dimensions from selected profiles
  function resolveDims(id: string | null, fallback: { a: number; b: number }): { a: number; b: number } {
    const found = candidates.find(c => c.p.id === id)
    return found?.dims || fallback
  }

  const postDims = resolveDims(postProfileId, { a: 8, b: 8 })
  const beamDims = resolveDims(beamProfileId, { a: 4, b: 10 })
  const lamellaDims = resolveDims(lamellaProfileId, { a: 2, b: 10 })

  const postSizeCm = Math.max(postDims.a, postDims.b)
  // Beam height is the larger dimension (e.g., 100/40 -> height=100, depth=40)
  const beamHeightCm = Math.max(beamDims.a, beamDims.b)
  const beamDepthCm = Math.min(beamDims.a, beamDims.b)
  const lamellaHeightCm = Math.min(lamellaDims.a, lamellaDims.b)
  const lamellaDepthCm = Math.max(lamellaDims.a, lamellaDims.b)

  function update<K extends keyof PergolaParams>(key: K, value: PergolaParams[K]) {
    setParams((p) => ({ ...p, [key]: value }))
  }

  const t = getTranslations(locale)

  return (
    <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-white">
      <ControlsPanel
        locale={locale}
        params={params}
        onUpdate={update}
        profiles={profiles}
        profilesLoading={profilesLoading}
        candidates={candidates}
        postProfileId={postProfileId}
        beamProfileId={beamProfileId}
        lamellaProfileId={lamellaProfileId}
        onPostProfileChange={setPostProfileId}
        onBeamProfileChange={setBeamProfileId}
        onLamellaProfileChange={setLamellaProfileId}
        postSizeCm={postSizeCm}
        beamHeightCm={beamHeightCm}
        beamDepthCm={beamDepthCm}
        lamellaHeightCm={lamellaHeightCm}
        lamellaDepthCm={lamellaDepthCm}
      />

      <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}> 
        <color attach="background" args={[0xffffff]} />
        <PerspectiveCamera makeDefault position={[4, 3, 5]} fov={50} near={0.1} far={100} />
        <OrbitControls enableDamping dampingFactor={0.08} target={[0, cm(200), 0]} minPolarAngle={0.05} maxPolarAngle={Math.PI / 2.02} />
        <SceneWithSaveBridge
          locale={locale}
          params={params}
          postSizeCm={postSizeCm}
          beamHeightCm={beamHeightCm}
          beamDepthCm={beamDepthCm}
          lamellaHeightCm={lamellaHeightCm}
          lamellaDepthCm={lamellaDepthCm}
        />
      </Canvas>

      <button
        onClick={() => (globalThis as any).__savePergola?.()}
        className="absolute right-4 bottom-4 bg-green-600 hover:bg-green-500 text-white rounded-xl px-4 py-2 shadow-lg"
      >
        {t.saveButton}
      </button>
    </div>
  )
}

export default Pergola3D
