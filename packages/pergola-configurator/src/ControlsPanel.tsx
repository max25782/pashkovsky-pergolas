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

  const [widthDraft, setWidthDraft] = useState<string>(String(params.widthCm))
  const [depthDraft, setDepthDraft] = useState<string>(String(params.depthCm))
  const [heightDraft, setHeightDraft] = useState<string>(String(params.heightCm))
  const [gapDraft, setGapDraft] = useState<string>(String(params.lamellaGapCm))

  useEffect(() => {
    setWidthDraft(String(params.widthCm))
  }, [params.widthCm])
  useEffect(() => {
    setDepthDraft(String(params.depthCm))
  }, [params.depthCm])
  useEffect(() => {
    setHeightDraft(String(params.heightCm))
  }, [params.heightCm])
  useEffect(() => {
    setGapDraft(String(params.lamellaGapCm))
  }, [params.lamellaGapCm])

  function commitNumber(
    key: 'widthCm' | 'depthCm' | 'heightCm' | 'lamellaGapCm',
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
      return
    }
    const clamped = clamp(parsed, min, max)
    if (key === 'widthCm') onUpdate('widthCm', clamped)
    else if (key === 'depthCm') onUpdate('depthCm', clamped)
    else if (key === 'heightCm') onUpdate('heightCm', clamped)
    else onUpdate('lamellaGapCm', clamped)
  }

  const isRTL = locale === 'he'

  // Lamella profiles: only flat profiles where the thin side is 2 cm (20mm)
  // Allowed: 20x20, 20x40, 20x50, 20x70
  const LAMELLA_ALLOWED = new Set([20, 40, 50, 70])
  const lamellaCandidates = candidates.filter((c) => {
    if (!c.dims) return false
    const thin = Math.min(c.dims.a, c.dims.b)
    const wide = Math.max(c.dims.a, c.dims.b)
    return thin === 2 && LAMELLA_ALLOWED.has(wide * 10)
  })

  const inp = 'w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-black focus:outline-none focus:ring-1 focus:ring-green-500'
  const sel = 'w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-black disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-green-500'
  const lbl = 'text-xs text-gray-500 leading-none'

  return (
    <div
      className="flex h-full w-full flex-col gap-2 overflow-y-auto bg-white px-3 py-3 text-xs text-gray-800"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t.title}</p>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 items-center">
        <label className={lbl}>{t.width}</label>
        <input className={inp} type="number" inputMode="numeric" value={widthDraft}
          onChange={(e) => setWidthDraft(e.target.value)}
          onBlur={() => commitNumber('widthCm', widthDraft, 100, 1000)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('widthCm', widthDraft, 100, 1000) }}
        />
        <label className={lbl}>{t.depth}</label>
        <input className={inp} type="number" inputMode="numeric" value={depthDraft}
          onChange={(e) => setDepthDraft(e.target.value)}
          onBlur={() => commitNumber('depthCm', depthDraft, 100, 1000)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('depthCm', depthDraft, 100, 1000) }}
        />
        <label className={lbl}>{t.height}</label>
        <input className={inp} type="number" inputMode="numeric" value={heightDraft}
          onChange={(e) => setHeightDraft(e.target.value)}
          onBlur={() => commitNumber('heightCm', heightDraft, 200, 400)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('heightCm', heightDraft, 200, 400) }}
        />
        <label className={lbl}>{t.lamellaGap}</label>
        <input className={inp} type="number" inputMode="numeric" value={gapDraft}
          onChange={(e) => setGapDraft(e.target.value)}
          onBlur={() => commitNumber('lamellaGapCm', gapDraft, 0, 20)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('lamellaGapCm', gapDraft, 0, 20) }}
        />
        <label className={lbl}>{t.color}</label>
        <div className="flex gap-1">
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
              className="h-5 w-5 flex-shrink-0 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
              style={{
                backgroundColor: hex,
                boxShadow: params.color === hex ? '0 0 0 2px #22c55e' : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={params.attachedToWall}
          onChange={(e) => onUpdate('attachedToWall', e.target.checked)}
          className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-xs text-gray-600">{t.attachedToWall}</span>
      </label>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={params.beamLed}
          onChange={(e) => onUpdate('beamLed', e.target.checked)}
          className="h-3 w-3 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
        />
        <span className="text-xs text-gray-600 flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
          {t.beamLed}
        </span>
      </label>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={params.lamellaStanding}
          onChange={(e) => onUpdate('lamellaStanding', e.target.checked)}
          className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-xs text-gray-600">{t.lamellaStanding}</span>
      </label>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={params.lamellaAlongWidth}
          onChange={(e) => onUpdate('lamellaAlongWidth', e.target.checked)}
          className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-xs text-gray-600">{t.lamellaAlongWidth}</span>
      </label>

      <div className="h-px bg-gray-100" />

      {/* Profiles */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 items-center">
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

      <p className="text-[10px] leading-tight text-gray-400">
        {t.selectedPost} {postSizeCm.toFixed(1)} cm &middot; {t.selectedBeam} {beamHeightCm.toFixed(1)}×{beamDepthCm.toFixed(1)} cm &middot; {t.selectedLamella} {lamellaHeightCm.toFixed(1)}×{lamellaDepthCm.toFixed(1)} cm
      </p>
      {dividerProfileId && (
        <p className="text-[10px] leading-tight text-gray-400">
          {t.selectedDivider}: {dividerProfileId}
        </p>
      )}
    </div>
  )
}
