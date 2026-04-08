'use client'

import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { ConfiguratorLocale } from './locale'
import type { CustomSavePayload } from './runtime-context'
import { PergolaConfiguratorProvider } from './runtime-context'
import type { PergolaParams } from './types'
import { cm } from './utils'
import { useProfiles } from './useProfiles'
import { ControlsPanel } from './ControlsPanel'
import { CanvasReflowOnMount } from './CanvasReflowOnMount'
import { SceneWithSaveBridge } from './SceneWithSaveBridge'
import { getTranslations } from './translations'
import { defaultPergolaParams } from './params-defaults'

export interface Pergola3DProps {
  locale: ConfiguratorLocale
  linkToken?: string
  readOnly?: boolean
  /**
   * Base URL for `/data/profiles.json`, `/api/configurator/prefill`, `/api/sendPergolaConfig`.
   * Omit for same-origin (marketing site).
   */
  resourceBaseUrl?: string
  /** Seed controls from offer rectangle (m → cm) when not using token prefill */
  initialParams?: Partial<PergolaParams>
  /** CRM: persist via authenticated API instead of site sendPergolaConfig */
  onCustomSave?: (payload: CustomSavePayload) => Promise<void>
  /**
   * Full path to profiles JSON on this origin (e.g. `/api/configurator/profiles` in CRM).
   * When set, overrides `resourceBaseUrl` + `/data/profiles.json`.
   */
  profilesJsonUrl?: string
}

function Pergola3DInner({
  locale,
  linkToken,
  readOnly = false,
  resourceBaseUrl = '',
  initialParams,
  onCustomSave,
  profilesJsonUrl,
}: Pergola3DProps): ReactElement {
  const [saveNotice, setSaveNotice] = useState<{
    variant: 'success' | 'error'
    message: string
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    if (saveNotice === null) return
    const id = window.setTimeout(() => setSaveNotice(null), 4000)
    return () => window.clearTimeout(id)
  }, [saveNotice])

  const [params, setParams] = useState<PergolaParams>(() => defaultPergolaParams(initialParams))

  const initialKey = JSON.stringify(initialParams ?? {})
  useEffect(() => {
    const partial =
      initialKey === '{}'
        ? undefined
        : (JSON.parse(initialKey) as Partial<PergolaParams>)
    setParams(defaultPergolaParams(partial))
  }, [initialKey])

  useEffect(() => {
    if (linkToken === undefined || linkToken === '') return
    let cancelled = false
    const base = resourceBaseUrl.replace(/\/$/, '')
    const prefillPath = `/api/configurator/prefill?ct=${encodeURIComponent(linkToken)}`
    const url = base ? `${base}${prefillPath}` : prefillPath
    void (async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) return  // token not found / expired — silently use defaults
        const data = (await res.json()) as { prefill?: Partial<PergolaParams> | null }
        if (cancelled || !data.prefill || typeof data.prefill !== 'object') return
        const p = data.prefill
        setParams((prev) => ({
          ...prev,
          shapeType:
            p.shapeType === 'rectangle' || p.shapeType === 'L' || p.shapeType === 'U'
              ? p.shapeType
              : prev.shapeType,
          widthCm: typeof p.widthCm === 'number' ? p.widthCm : prev.widthCm,
          depthCm: typeof p.depthCm === 'number' ? p.depthCm : prev.depthCm,
          heightCm: typeof p.heightCm === 'number' ? p.heightCm : prev.heightCm,
          arm1WidthCm: typeof p.arm1WidthCm === 'number' ? p.arm1WidthCm : prev.arm1WidthCm,
          arm1DepthCm: typeof p.arm1DepthCm === 'number' ? p.arm1DepthCm : prev.arm1DepthCm,
          color: typeof p.color === 'string' ? p.color : prev.color,
          lamellaAngleDeg:
            typeof p.lamellaAngleDeg === 'number' ? p.lamellaAngleDeg : prev.lamellaAngleDeg,
          attachedToWall:
            typeof p.attachedToWall === 'boolean' ? p.attachedToWall : prev.attachedToWall,
          lamellaGapCm: typeof p.lamellaGapCm === 'number' ? p.lamellaGapCm : prev.lamellaGapCm,
          beamLed: typeof p.beamLed === 'boolean' ? p.beamLed : prev.beamLed,
          lamellaStanding:
            typeof p.lamellaStanding === 'boolean' ? p.lamellaStanding : prev.lamellaStanding,
          lamellaAlongWidth:
            typeof p.lamellaAlongWidth === 'boolean' ? p.lamellaAlongWidth : prev.lamellaAlongWidth,
          postProfileId:
            typeof p.postProfileId === 'string' || p.postProfileId === null
              ? p.postProfileId ?? prev.postProfileId
              : prev.postProfileId,
          beamProfileId:
            typeof p.beamProfileId === 'string' ? p.beamProfileId : prev.beamProfileId,
          dividerProfileId:
            typeof p.dividerProfileId === 'string' || p.dividerProfileId === null
              ? p.dividerProfileId ?? prev.dividerProfileId
              : prev.dividerProfileId,
          lamellaProfileId:
            typeof p.lamellaProfileId === 'string' ? p.lamellaProfileId : prev.lamellaProfileId,
        }))
      } catch {
        /* keep defaults */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [linkToken, resourceBaseUrl])

  const { profiles, profilesLoading, candidates } = useProfiles()

  function resolveDims(id: string | null, fallback: { a: number; b: number }): { a: number; b: number } {
    const found = candidates.find((c) => c.p.id === id)
    return found?.dims || fallback
  }

  const postDims = resolveDims(params.postProfileId, { a: 8, b: 8 })
  const beamDims = resolveDims(params.beamProfileId, { a: 4, b: 10 })
  const lamellaDims = resolveDims(params.lamellaProfileId, { a: 2, b: 10 })

  const postSizeCm = Math.max(postDims.a, postDims.b)
  const beamHeightCm = Math.max(beamDims.a, beamDims.b)
  const beamDepthCm = Math.min(beamDims.a, beamDims.b)
  const lamellaHeightCm = Math.min(lamellaDims.a, lamellaDims.b)
  const lamellaDepthCm = Math.max(lamellaDims.a, lamellaDims.b)

  function update<K extends keyof PergolaParams>(key: K, value: PergolaParams[K]) {
    setParams((p) => ({ ...p, [key]: value }))
  }

  const t = getTranslations(locale)

  const isRTL = locale === 'he'

  return (
    <div
      className="relative flex h-full w-full overflow-hidden bg-white"
      dir="ltr"
    >
      {/* Save notice */}
      {saveNotice !== null ? (
        <div
          role="status"
          className={
            'absolute left-1/2 top-4 z-[20] max-w-md -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ' +
            (saveNotice.variant === 'success' ? 'bg-green-700' : 'bg-red-700')
          }
        >
          {saveNotice.message}
        </div>
      ) : null}

      {/* Read-only label */}
      {readOnly && (
        <div className="absolute start-3 top-3 z-10 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
          {t.readOnlyLabel}
        </div>
      )}

      {/* Canvas — full width, pointer-events only on canvas itself */}
      <div className="absolute inset-0">
        <Canvas
          shadows
          className="!absolute inset-0 !h-full !w-full touch-none"
          dpr={[1, 3]}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          resize={{ debounce: 0, scroll: false }}
        >
          <CanvasReflowOnMount />
          <color attach="background" args={['#c8dff0']} />
          <PerspectiveCamera makeDefault position={[7, 4, 9]} fov={50} near={0.1} far={100} />
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            target={[0, cm(130), 2]}
            minPolarAngle={0.05}
            maxPolarAngle={Math.PI / 2.02}
          />
          <SceneWithSaveBridge
            locale={locale}
            linkToken={linkToken}
            readOnly={readOnly}
            params={params}
            postSizeCm={postSizeCm}
            beamHeightCm={beamHeightCm}
            beamDepthCm={beamDepthCm}
            lamellaHeightCm={lamellaHeightCm}
            lamellaDepthCm={lamellaDepthCm}
            onSaveSuccess={(msg) => setSaveNotice({ variant: 'success', message: msg })}
            onSaveError={(msg) => setSaveNotice({ variant: 'error', message: msg })}
          />
        </Canvas>
      </div>

      {/* UI overlay — sits above canvas, pointer-events only on interactive children */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Hamburger button */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="pointer-events-auto absolute right-3 top-10 z-30 flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg bg-white/90 shadow-md hover:bg-white transition-colors"
            aria-label={t.settingsAriaLabel}
          >
            {panelOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <line x1="2" y1="2" x2="14" y2="14" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
                <line x1="14" y1="2" x2="2" y2="14" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <>
                <span className="block h-0.5 w-5 rounded bg-gray-700" />
                <span className="block h-0.5 w-5 rounded bg-gray-700" />
                <span className="block h-0.5 w-5 rounded bg-gray-700" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Slide-out controls drawer — overlays canvas from the right */}
      {!readOnly && (
        <>
          {/* Backdrop */}
          {panelOpen && (
            <div
              className="fixed inset-0 z-[199] bg-black/20"
              onClick={() => setPanelOpen(false)}
            />
          )}

          {/* Drawer */}
          <aside
            className={
              'fixed right-0 top-0 z-[200] flex h-full w-72 flex-col overflow-hidden bg-white shadow-[-4px_0_16px_rgba(0,0,0,0.15)] transition-transform duration-300 ' +
              (panelOpen ? 'translate-x-0' : 'translate-x-full')
            }
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-700" dir={isRTL ? 'rtl' : 'ltr'}>
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded p-1 hover:bg-gray-100 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <line x1="1" y1="1" x2="13" y2="13" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="13" y1="1" x2="1" y2="13" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Scrollable controls */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ControlsPanel
                locale={locale}
                params={params}
                onUpdate={update}
                profiles={profiles}
                profilesLoading={profilesLoading}
                candidates={candidates}
                postProfileId={params.postProfileId}
                beamProfileId={params.beamProfileId}
                dividerProfileId={params.dividerProfileId}
                lamellaProfileId={params.lamellaProfileId}
                onPostProfileChange={(id) => update('postProfileId', id)}
                onBeamProfileChange={(id) => update('beamProfileId', id)}
                onDividerProfileChange={(id) => update('dividerProfileId', id)}
                onLamellaProfileChange={(id) => update('lamellaProfileId', id)}
                postSizeCm={postSizeCm}
                beamHeightCm={beamHeightCm}
                beamDepthCm={beamDepthCm}
                lamellaHeightCm={lamellaHeightCm}
                lamellaDepthCm={lamellaDepthCm}
              />
            </div>

            {/* Save button pinned at bottom */}
            <div className="shrink-0 border-t border-gray-200 p-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  const fn = (globalThis as { __savePergola?: () => Promise<void> }).__savePergola
                  if (!fn) return
                  setIsSaving(true)
                  try {
                    await fn()
                  } finally {
                    setIsSaving(false)
                  }
                }}
                className="w-full rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? '...' : t.saveButton}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

export function Pergola3D(props: Pergola3DProps): ReactElement {
  const { resourceBaseUrl, onCustomSave, profilesJsonUrl, ...rest } = props
  return (
    <PergolaConfiguratorProvider
      resourceBaseUrl={resourceBaseUrl}
      profilesJsonUrl={profilesJsonUrl}
      onCustomSave={onCustomSave}
    >
      <Pergola3DInner
        {...rest}
        resourceBaseUrl={resourceBaseUrl}
        profilesJsonUrl={profilesJsonUrl}
        onCustomSave={onCustomSave}
      />
    </PergolaConfiguratorProvider>
  )
}

export default Pergola3D
