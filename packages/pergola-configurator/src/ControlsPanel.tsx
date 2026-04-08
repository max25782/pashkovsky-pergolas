'use client'

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { ConfiguratorLocale } from './locale'
import type { PergolaParams, ProfileMeta } from './types'
import { clamp } from './utils'
import { getTranslations } from './translations'

interface ControlsPanelProps {
  locale: ConfiguratorLocale
  params: PergolaParams
  onUpdate: <K extends keyof PergolaParams>(key: K, value: PergolaParams[K]) => void
  profiles: ProfileMeta[]
  profilesLoading: boolean
  candidates: Array<{ p: ProfileMeta; dims: { a: number; b: number } | null }>
  postProfileId: string | null
  beamProfileId: string | null
  dividerProfileId: string | null
  lamellaProfileId: string | null
  onPostProfileChange: (id: string | null) => void
  onBeamProfileChange: (id: string | null) => void
  onDividerProfileChange: (id: string | null) => void
  onLamellaProfileChange: (id: string | null) => void
  postSizeCm: number
  beamHeightCm: number
  beamDepthCm: number
  lamellaHeightCm: number
  lamellaDepthCm: number
}

export function ControlsPanel({
  locale,
  params,
  onUpdate,
  profiles,
  profilesLoading,
  candidates,
  postProfileId,
  beamProfileId,
  dividerProfileId,
  lamellaProfileId,
  onPostProfileChange,
  onBeamProfileChange,
  onDividerProfileChange,
  onLamellaProfileChange,
  postSizeCm,
  beamHeightCm,
  beamDepthCm,
  lamellaHeightCm,
  lamellaDepthCm,
}: ControlsPanelProps): ReactElement {
  const t = getTranslations(locale)

  const [widthDraft, setWidthDraft] = useState(String(params.widthCm))
  const [depthDraft, setDepthDraft] = useState(String(params.depthCm))
  const [heightDraft, setHeightDraft] = useState(String(params.heightCm))
  const [gapDraft, setGapDraft] = useState(String(params.lamellaGapCm))
  const [arm1WidthDraft, setArm1WidthDraft] = useState(String(params.arm1WidthCm))
  const [arm1DepthDraft, setArm1DepthDraft] = useState(String(params.arm1DepthCm))

  useEffect(() => { setWidthDraft(String(params.widthCm)) }, [params.widthCm])
  useEffect(() => { setDepthDraft(String(params.depthCm)) }, [params.depthCm])
  useEffect(() => { setHeightDraft(String(params.heightCm)) }, [params.heightCm])
  useEffect(() => { setGapDraft(String(params.lamellaGapCm)) }, [params.lamellaGapCm])
  useEffect(() => { setArm1WidthDraft(String(params.arm1WidthCm)) }, [params.arm1WidthCm])
  useEffect(() => { setArm1DepthDraft(String(params.arm1DepthCm)) }, [params.arm1DepthCm])

  function commitNumber(
    key: 'widthCm' | 'depthCm' | 'heightCm' | 'lamellaGapCm' | 'arm1WidthCm' | 'arm1DepthCm',
    draft: string,
    min: number,
    max: number,
  ) {
    const parsed = parseInt(draft, 10)
    if (Number.isNaN(parsed)) {
      if (key === 'widthCm') setWidthDraft(String(params.widthCm))
      if (key === 'depthCm') setDepthDraft(String(params.depthCm))
      if (key === 'heightCm') setHeightDraft(String(params.heightCm))
      if (key === 'lamellaGapCm') setGapDraft(String(params.lamellaGapCm))
      if (key === 'arm1WidthCm') setArm1WidthDraft(String(params.arm1WidthCm))
      if (key === 'arm1DepthCm') setArm1DepthDraft(String(params.arm1DepthCm))
      return
    }
    onUpdate(key, clamp(parsed, min, max))
  }

  const hasArm = params.shapeType === 'L' || params.shapeType === 'U'
  const isRTL = locale === 'he'

  const LAMELLA_ALLOWED = new Set([20, 40, 50, 70])
  const lamellaCandidates = candidates.filter((c) => {
    if (!c.dims) return false
    const thin = Math.min(c.dims.a, c.dims.b)
    const wide = Math.max(c.dims.a, c.dims.b)
    return thin === 2 && LAMELLA_ALLOWED.has(wide * 10)
  })

  // Shared styles
  const lbl = 'block text-[11px] text-gray-500 mb-0.5'
  const inp = 'w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-green-500'
  const sel = 'w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-black disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-green-500'
  const field = 'flex flex-col'
  const sep = 'h-px bg-gray-100'

  return (
    <div
      className="flex min-h-0 flex-1 w-full flex-col gap-3 overflow-y-auto bg-white px-3 py-3 text-xs text-gray-800"
      dir={isRTL ? 'rtl' : 'ltr'}
    >

      {/* Shape */}
      <div className={field}>
        <span className={lbl}>{t.shapeLabel}</span>
        <div className="flex gap-1">
          {(['rectangle', 'L', 'U'] as const).map((s) => {
            const label = s === 'rectangle' ? t.shapeRectangle : s === 'L' ? t.shapeL : t.shapeU
            return (
              <button
                key={s}
                type="button"
                onClick={() => onUpdate('shapeType', s)}
                className={
                  'flex-1 rounded border py-1 text-[11px] font-medium transition-colors ' +
                  (params.shapeType === s
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300')
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className={sep} />

      {/* Width */}
      <div className={field}>
        <label className={lbl}>{t.width}</label>
        <input className={inp} type="number" inputMode="numeric" value={widthDraft}
          onChange={(e) => setWidthDraft(e.target.value)}
          onBlur={() => commitNumber('widthCm', widthDraft, 100, 1000)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('widthCm', widthDraft, 100, 1000) }}
        />
      </div>

      {/* Depth */}
      <div className={field}>
        <label className={lbl}>{t.depth}</label>
        <input className={inp} type="number" inputMode="numeric" value={depthDraft}
          onChange={(e) => setDepthDraft(e.target.value)}
          onBlur={() => commitNumber('depthCm', depthDraft, 100, 1000)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('depthCm', depthDraft, 100, 1000) }}
        />
      </div>

      {/* Height */}
      <div className={field}>
        <label className={lbl}>{t.height}</label>
        <input className={inp} type="number" inputMode="numeric" value={heightDraft}
          onChange={(e) => setHeightDraft(e.target.value)}
          onBlur={() => commitNumber('heightCm', heightDraft, 200, 400)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('heightCm', heightDraft, 200, 400) }}
        />
      </div>

      {/* Arm dimensions (L / U shapes) */}
      {hasArm && (
        <>
          <div className={field}>
            <label className={lbl}>{t.armWidth}</label>
            <input className={inp} type="number" inputMode="numeric" value={arm1WidthDraft}
              onChange={(e) => setArm1WidthDraft(e.target.value)}
              onBlur={() => commitNumber('arm1WidthCm', arm1WidthDraft, 50, 800)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('arm1WidthCm', arm1WidthDraft, 50, 800) }}
            />
          </div>
          <div className={field}>
            <label className={lbl}>{t.armDepth}</label>
            <input className={inp} type="number" inputMode="numeric" value={arm1DepthDraft}
              onChange={(e) => setArm1DepthDraft(e.target.value)}
              onBlur={() => commitNumber('arm1DepthCm', arm1DepthDraft, 50, 800)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('arm1DepthCm', arm1DepthDraft, 50, 800) }}
            />
          </div>
        </>
      )}

      {/* Lamella gap */}
      <div className={field}>
        <label className={lbl}>{t.lamellaGap}</label>
        <input className={inp} type="number" inputMode="numeric" value={gapDraft}
          onChange={(e) => setGapDraft(e.target.value)}
          onBlur={() => commitNumber('lamellaGapCm', gapDraft, 0, 20)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('lamellaGapCm', gapDraft, 0, 20) }}
        />
      </div>

      {/* Color */}
      <div className={field}>
        <span className={lbl}>{t.color}</span>
        <div className="flex gap-1.5">
          {([
            { hex: '#ffffff', label: 'White' },
            { hex: '#1a1a1a', label: 'Black' },
            { hex: '#f0e8d0', label: 'RAL 1013' },
            { hex: '#9aa0a6', label: 'RAL 9006' },
          ] as { hex: string; label: string }[]).map(({ hex, label }) => (
            <button
              key={hex}
              title={label}
              onClick={() => onUpdate('color', hex)}
              className="h-6 w-6 flex-shrink-0 rounded border border-gray-300 focus:outline-none"
              style={{
                backgroundColor: hex,
                boxShadow: params.color === hex ? '0 0 0 2px #22c55e' : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <div className={sep} />

      {/* Checkboxes */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={params.attachedToWall}
          onChange={(e) => onUpdate('attachedToWall', e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-xs text-gray-700">{t.attachedToWall}</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={params.beamLed}
          onChange={(e) => onUpdate('beamLed', e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
        />
        <span className="text-xs text-gray-700 flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
          {t.beamLed}
        </span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={params.lamellaStanding}
          onChange={(e) => onUpdate('lamellaStanding', e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-xs text-gray-700">{t.lamellaStanding}</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={params.lamellaAlongWidth}
          onChange={(e) => onUpdate('lamellaAlongWidth', e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-xs text-gray-700">{t.lamellaAlongWidth}</span>
      </label>

      <div className={sep} />

      {/* Profile selects — label above each */}
      <div className={field}>
        <label className={lbl}>{t.postProfile}</label>
        <select className={sel} value={postProfileId || ''} disabled={profilesLoading}
          onChange={(e) => onPostProfileChange(e.target.value || null)}
        >
          <option value="">{t.defaultPost}</option>
          {profilesLoading && <option disabled>{t.loadingProfiles}</option>}
          {candidates.map((c, idx) => (
            <option key={`post-${c.p.id}-${idx}`} value={c.p.id}>
              {c.p.id}{c.dims ? ` (${c.dims.a.toFixed(1)}x${c.dims.b.toFixed(1)})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={lbl}>{t.beamProfile}</label>
        <select className={sel} value={beamProfileId || ''} disabled={profilesLoading}
          onChange={(e) => onBeamProfileChange(e.target.value || null)}
        >
          <option value="">{t.defaultBeam}</option>
          {profilesLoading && <option disabled>{t.loadingProfiles}</option>}
          {candidates.map((c, idx) => (
            <option key={`beam-${c.p.id}-${idx}`} value={c.p.id}>
              {c.p.id}{c.dims ? ` (${c.dims.a.toFixed(1)}x${c.dims.b.toFixed(1)})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={lbl}>{t.dividerProfile}</label>
        <select className={sel} value={dividerProfileId || ''} disabled={profilesLoading}
          onChange={(e) => onDividerProfileChange(e.target.value || null)}
        >
          <option value="">{t.defaultDivider}</option>
          {profilesLoading && <option disabled>{t.loadingProfiles}</option>}
          {candidates.map((c, idx) => (
            <option key={`divider-${c.p.id}-${idx}`} value={c.p.id}>
              {c.p.id}{c.dims ? ` (${c.dims.a.toFixed(1)}x${c.dims.b.toFixed(1)})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={lbl}>{t.lamellaProfile}</label>
        <select className={sel} value={lamellaProfileId || ''} disabled={profilesLoading}
          onChange={(e) => onLamellaProfileChange(e.target.value || null)}
        >
          <option value="">{t.defaultLamella}</option>
          {profilesLoading && <option disabled>{t.loadingProfiles}</option>}
          {lamellaCandidates.map((c, idx) => (
            <option key={`lamella-${c.p.id}-${idx}`} value={c.p.id}>
              {c.p.id}{c.dims ? ` (${c.dims.a.toFixed(0)}x${c.dims.b.toFixed(0)})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className={sep} />

      {/* Size summary */}
      <p className="text-[10px] leading-relaxed text-gray-400">
        {t.selectedPost} {postSizeCm.toFixed(1)} cm<br />
        {t.selectedBeam} {beamHeightCm.toFixed(1)}×{beamDepthCm.toFixed(1)} cm<br />
        {t.selectedLamella} {lamellaHeightCm.toFixed(1)}×{lamellaDepthCm.toFixed(1)} cm
      </p>
      {dividerProfileId && (
        <p className="text-[10px] leading-tight text-gray-400">
          {t.selectedDivider}: {dividerProfileId}
        </p>
      )}
    </div>
  )
}
