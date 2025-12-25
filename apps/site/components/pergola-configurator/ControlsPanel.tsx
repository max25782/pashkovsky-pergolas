'use client'

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { Locale } from '@/lib/locales'
import type { PergolaParams, ProfileMeta } from './types'
import { clamp } from './utils'
import { getTranslations } from './translations'

interface ControlsPanelProps {
  locale: Locale
  params: PergolaParams
  onUpdate: <K extends keyof PergolaParams>(key: K, value: PergolaParams[K]) => void
  profiles: ProfileMeta[]
  profilesLoading: boolean
  candidates: Array<{ p: ProfileMeta; dims: { a: number; b: number } | null }>
  postProfileId: string | null
  beamProfileId: string | null
  lamellaProfileId: string | null
  onPostProfileChange: (id: string | null) => void
  onBeamProfileChange: (id: string | null) => void
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
  lamellaProfileId,
  onPostProfileChange,
  onBeamProfileChange,
  onLamellaProfileChange,
  postSizeCm,
  beamHeightCm,
  beamDepthCm,
  lamellaHeightCm,
  lamellaDepthCm,
}: ControlsPanelProps): ReactElement {
  const t = getTranslations(locale)
  
  // Draft strings so user can type freely before commit
  const [widthDraft, setWidthDraft] = useState<string>(String(params.widthCm))
  const [depthDraft, setDepthDraft] = useState<string>(String(params.depthCm))
  const [heightDraft, setHeightDraft] = useState<string>(String(params.heightCm))
  const [gapDraft, setGapDraft] = useState<string>(String(params.lamellaGapCm))

  // Keep drafts in sync when params change externally
  useEffect(() => { setWidthDraft(String(params.widthCm)) }, [params.widthCm])
  useEffect(() => { setDepthDraft(String(params.depthCm)) }, [params.depthCm])
  useEffect(() => { setHeightDraft(String(params.heightCm)) }, [params.heightCm])
  useEffect(() => { setGapDraft(String(params.lamellaGapCm)) }, [params.lamellaGapCm])

  function commitNumber(key: 'widthCm'|'depthCm'|'heightCm'|'lamellaGapCm', draft: string, min: number, max: number) {
    const parsed = parseInt(draft, 10)
    if (Number.isNaN(parsed)) {
      // Revert draft to current value if invalid
      if (key === 'widthCm') setWidthDraft(String(params.widthCm))
      if (key === 'depthCm') setDepthDraft(String(params.depthCm))
      if (key === 'heightCm') setHeightDraft(String(params.heightCm))
      if (key === 'lamellaGapCm') setGapDraft(String(params.lamellaGapCm))
      return
    }
    const clamped = clamp(parsed, min, max)
    onUpdate(key, clamped as any)
  }

  const isRTL = locale === 'he'
  
  return (
    <div 
      className="absolute right-4 top-4 z-50 w-72 rounded-2xl bg-white/95 backdrop-blur-md p-4 shadow-xl space-y-3 text-sm text-gray-800"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="font-semibold text-gray-900">{t.title}</div>
      <div className="grid grid-cols-2 gap-2 items-center">
        <label>{t.width}</label>
        <input
          className="border rounded px-2 py-1 bg-white text-gray-900"
          type="number"
          inputMode="numeric"
          value={widthDraft}
          onChange={(e) => setWidthDraft(e.target.value)}
          onBlur={() => commitNumber('widthCm', widthDraft, 100, 1000)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('widthCm', widthDraft, 100, 1000) }}
        />
        <label>{t.depth}</label>
        <input
          className="border rounded px-2 py-1 bg-white text-gray-900"
          type="number"
          inputMode="numeric"
          value={depthDraft}
          onChange={(e) => setDepthDraft(e.target.value)}
          onBlur={() => commitNumber('depthCm', depthDraft, 100, 1000)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('depthCm', depthDraft, 100, 1000) }}
        />
        <label>{t.height}</label>
        <input
          className="border rounded px-2 py-1 bg-white text-gray-900"
          type="number"
          inputMode="numeric"
          value={heightDraft}
          onChange={(e) => setHeightDraft(e.target.value)}
          onBlur={() => commitNumber('heightCm', heightDraft, 200, 400)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('heightCm', heightDraft, 200, 400) }}
        />
        <label>{t.color}</label>
        <input className="border rounded px-2 py-1 bg-white text-gray-900" type="color" value={params.color} onChange={(e) => onUpdate('color', e.target.value)} />
        <label>{t.lamellaGap}</label>
        <input
          className="border rounded px-2 py-1 bg-white text-gray-900"
          type="number"
          inputMode="numeric"
          value={gapDraft}
          onChange={(e) => setGapDraft(e.target.value)}
          onBlur={() => commitNumber('lamellaGapCm', gapDraft, 0, 20)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNumber('lamellaGapCm', gapDraft, 0, 20) }}
        />
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="attachedToWall"
            checked={params.attachedToWall}
            onChange={(e) => onUpdate('attachedToWall', e.target.checked)}
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
          />
          <label htmlFor="attachedToWall" className="text-sm text-gray-700 cursor-pointer">
            {t.attachedToWall}
          </label>
        </div>
        <div className="col-span-2 h-px bg-gray-200 my-1" />
        <label>{t.postProfile}</label>
        <select 
          className="border rounded px-2 py-1 bg-white text-gray-900 disabled:opacity-50" 
          value={postProfileId || ''} 
          onChange={(e)=> onPostProfileChange(e.target.value || null)}
          disabled={profilesLoading}
        >
          <option value="">{t.defaultPost}</option>
          {profilesLoading && <option disabled>{t.loadingProfiles}</option>}
          {candidates.map(c => (
            <option key={c.p.id} value={c.p.id}>
              {c.p.id} {c.dims ? `(${c.dims.a.toFixed(1)}x${c.dims.b.toFixed(1)} cm)` : ` ${t.dimensionsUnknown}`}
            </option>
          ))}
        </select>
        <label>{t.beamProfile}</label>
        <select 
          className="border rounded px-2 py-1 bg-white text-gray-900 disabled:opacity-50" 
          value={beamProfileId || ''} 
          onChange={(e)=> onBeamProfileChange(e.target.value || null)}
          disabled={profilesLoading}
        >
          <option value="">{t.defaultBeam}</option>
          {profilesLoading && <option disabled>{t.loadingProfiles}</option>}
          {candidates.map(c => (
            <option key={c.p.id} value={c.p.id}>
              {c.p.id} {c.dims ? `(${c.dims.a.toFixed(1)}x${c.dims.b.toFixed(1)} cm)` : ` ${t.dimensionsUnknown}`}
            </option>
          ))}
        </select>
        <label>{t.lamellaProfile}</label>
        <select 
          className="border rounded px-2 py-1 bg-white text-gray-900 disabled:opacity-50" 
          value={lamellaProfileId || ''} 
          onChange={(e)=> onLamellaProfileChange(e.target.value || null)}
          disabled={profilesLoading}
        >
          <option value="">{t.defaultLamella}</option>
          {profilesLoading && <option disabled>{t.loadingProfiles}</option>}
          {candidates.map(c => (
            <option key={c.p.id} value={c.p.id}>
              {c.p.id} {c.dims ? `(${c.dims.a.toFixed(1)}x${c.dims.b.toFixed(1)} cm)` : ` ${t.dimensionsUnknown}`}
            </option>
          ))}
        </select>
        <div className="col-span-2 text-xs text-gray-500">{t.selected} {t.selectedPost} {postSizeCm.toFixed(1)} cm, {t.selectedBeam} {beamHeightCm.toFixed(1)}x{beamDepthCm.toFixed(1)} cm, {t.selectedLamella} {lamellaHeightCm.toFixed(1)}x{lamellaDepthCm.toFixed(1)} cm</div>
      </div>
    </div>
  )
}

