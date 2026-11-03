'use client'

import { useMemo, useState } from 'react'
import {
  SUPPORT_BEAMS_FORMAT_VERSION,
  WING_SHELF_SPAN_DIVIDER_ID,
  beamPlanWidthForDrawing,
  diagnoseSupportBeams,
  makeStraightSupportBeam,
  resolvePlanPurlinLines,
  resolveStraightSupportBeams,
  specFromPlan,
  supportBeamAxisFromSideMm,
  type CutPiece,
  type PlanConstructionParams,
  type Point2D,
  type ProfileDimensions,
  type StraightSupportBeam,
  type SupportBeamsDocument,
  type SupportBeamWarning,
} from '@pashkovsky/pergola-core'

const DEFAULT_BEAM_PROFILE = 'PA3022'
const DEFAULT_BEAM_WIDTH_MM = 40

/** Profiles offered in the «Опорная балка» panel (no silent remap for other plans). */
export const SUPPORT_BEAM_PROFILE_OPTIONS = ['PA3022', 'f10040', 'f12040', 'F4060'] as const

export interface SupportBeamControlsProps {
  contour: Point2D[]
  wallEdgeIndices: number[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  supportBeams: SupportBeamsDocument | unknown | undefined
  pieces: CutPiece[] | null
  onChange: (next: SupportBeamsDocument | undefined) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  placeMode: boolean
  onPlaceModeChange: (active: boolean) => void
  t: (key: string, values?: Record<string, string | number | Date>) => string
}

function asDoc(raw: unknown): SupportBeamsDocument | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as SupportBeamsDocument
  if (o.formatVersion !== SUPPORT_BEAMS_FORMAT_VERSION || !Array.isArray(o.beams)) return undefined
  return o
}

/** Distance from the straight outer side to a plan point (mm) — same as the number field. */
export function supportBeamAxisFromPlanPoint(
  planXMm: number,
  planYMm: number,
  contour: Point2D[],
  lamellaDirectionDeg: number,
  frameHalfMm = 0,
): number {
  return (
    Math.round(
      supportBeamAxisFromSideMm(
        {
          id: 'tmp',
          kind: 'straight',
          anchorMm: { x: planXMm, y: planYMm },
          profileId: 'tmp',
          start: { purlinId: 'tmp', face: 'high' },
          end: { kind: 'outer-contour' },
          directionDeg: lamellaDirectionDeg,
        },
        contour,
        undefined,
        frameHalfMm,
      ) * 10,
    ) / 10
  )
}

function uniqueBeamId(base: string, existing: StraightSupportBeam[]): string {
  if (!existing.some((b) => b.id === base)) return base
  let n = 2
  while (existing.some((b) => b.id === `${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export function buildSupportBeamDocument(input: {
  contour: Point2D[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  startPurlinId: string
  startPurlinPositionMm: number
  axisFromSideMm: number
  profileId: string
  widthMm: number
  existingId?: string
  /** Prior beams kept when adding/updating (multi-beam). Omit ⇒ single-beam replace. */
  existingBeams?: StraightSupportBeam[]
  mode?: 'replace' | 'add' | 'update'
}): SupportBeamsDocument {
  const purlinHalf =
    beamPlanWidthForDrawing(input.profiles, input.params.purlinProfileId || input.profileId)
      .planWidthMm / 2
  const frameHalf = beamPlanWidthForDrawing(input.profiles, input.params.beamProfileId).planWidthMm / 2
  const mode = input.mode ?? (input.existingBeams && input.existingBeams.length > 0 ? 'update' : 'replace')
  const existing = input.existingBeams ?? []
  const idBase = input.existingId ?? `beam-${input.startPurlinId}`
  const id =
    mode === 'add' ? uniqueBeamId(`beam-${input.startPurlinId}`, existing) : idBase
  const nextBeam: StraightSupportBeam = makeStraightSupportBeam({
    id,
    axisFromSideMm: input.axisFromSideMm,
    contour: input.contour,
    startPurlinId: input.startPurlinId,
    face: 'high',
    profileId: input.profileId,
    widthMm: input.widthMm,
    directionDeg: input.params.lamellaDirectionDeg,
    startPurlinPositionMm: input.startPurlinPositionMm,
    purlinHalfMm: purlinHalf,
    frameHalfMm: frameHalf,
  })
  if (mode === 'add') {
    return { formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams: [...existing, nextBeam] }
  }
  if (mode === 'update' && existing.length > 0) {
    const idx = existing.findIndex((b) => b.id === (input.existingId ?? existing[0]?.id))
    if (idx >= 0) {
      const beams = existing.slice()
      beams[idx] = nextBeam
      return { formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams }
    }
    return { formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams: [...existing, nextBeam] }
  }
  return { formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams: [nextBeam] }
}

export function supportBeamWarningMessages(input: {
  contour: Point2D[]
  wallEdgeIndices: number[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  supportBeams: unknown
}): string[] {
  if (input.supportBeams == null) return []
  const doc = asDoc(input.supportBeams)
  const spec = specFromPlan({
    contour: input.contour,
    wallEdgeIndices: input.wallEdgeIndices,
    params: input.params,
    ...(doc ? { supportBeams: doc } : {}),
  })
  return diagnoseSupportBeams({
    raw: input.supportBeams,
    spec,
    profiles: input.profiles,
  }).map((w) => w.message)
}

export function SupportBeamControls({
  contour,
  wallEdgeIndices,
  params,
  profiles,
  supportBeams,
  pieces,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  placeMode,
  onPlaceModeChange,
  t,
}: SupportBeamControlsProps) {
  const lines = useMemo(
    () => resolvePlanPurlinLines(contour, params, profiles, wallEdgeIndices),
    [contour, params, profiles, wallEdgeIndices],
  )
  const doc = asDoc(supportBeams)
  const beams = doc?.beams ?? []
  const [activeBeamId, setActiveBeamId] = useState<string | null>(() => beams[0]?.id ?? null)
  const activeBeam = beams.find((b) => b.id === activeBeamId) ?? beams[0]
  const [startPurlinId, setStartPurlinId] = useState(
    () => activeBeam?.start.purlinId ?? lines[4]?.id ?? lines[0]?.id ?? '',
  )
  const [axisFromSideMm, setAxisFromSideMm] = useState(() => {
    if (!activeBeam) return 3104.1
    const frameHalf = beamPlanWidthForDrawing(profiles, params.beamProfileId).planWidthMm / 2
    return Math.round(supportBeamAxisFromSideMm(activeBeam, contour, undefined, frameHalf) * 10) / 10
  })
  const [profileId, setProfileId] = useState(activeBeam?.profileId ?? DEFAULT_BEAM_PROFILE)
  const [widthMm, setWidthMm] = useState(activeBeam?.widthMm ?? DEFAULT_BEAM_WIDTH_MM)

  const warnings = useMemo((): SupportBeamWarning[] => {
    if (supportBeams == null) return []
    const spec = specFromPlan({
      contour,
      wallEdgeIndices,
      params,
      ...(doc ? { supportBeams: doc } : {}),
    })
    return diagnoseSupportBeams({ raw: supportBeams, spec, profiles })
  }, [contour, wallEdgeIndices, params, supportBeams, doc, profiles])

  const resolved = useMemo(() => {
    if (!doc) return []
    const spec = specFromPlan({ contour, wallEdgeIndices, params, supportBeams: doc })
    return resolveStraightSupportBeams(spec, profiles)
  }, [doc, contour, wallEdgeIndices, params, profiles])

  const splitSummary = useMemo(() => {
    if (!pieces) return null
    const support = pieces.filter((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    if (support.length === 0) return null
    const beamPiece = support[0]
    const crossed = pieces.filter(
      (p) =>
        p.role === 'purlin' &&
        p.dividerId &&
        p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID &&
        /-[ab]$/.test(p.id),
    )
    const byRow = new Map<string, number[]>()
    for (const p of crossed) {
      const row = p.dividerId!
      const list = byRow.get(row) ?? []
      list.push(Math.round(p.lengthAxisMm * 10) / 10)
      byRow.set(row, list)
    }
    return {
      beamAxisMm: Math.round(beamPiece.lengthAxisMm * 10) / 10,
      splits: [...byRow.entries()].map(([id, lens]) => ({ id, lens: lens.sort((a, b) => a - b) })),
    }
  }, [pieces])

  function selectBeam(beam: StraightSupportBeam) {
    setActiveBeamId(beam.id)
    setStartPurlinId(beam.start.purlinId)
    const frameHalf = beamPlanWidthForDrawing(profiles, params.beamProfileId).planWidthMm / 2
    setAxisFromSideMm(Math.round(supportBeamAxisFromSideMm(beam, contour, undefined, frameHalf) * 10) / 10)
    setProfileId(beam.profileId)
    setWidthMm(beam.widthMm ?? DEFAULT_BEAM_WIDTH_MM)
  }

  function commit(axis: number, purlinId: string, mode: 'add' | 'update' | 'replace') {
    const line = lines.find((l) => l.id === purlinId)
    if (!line || !Number.isFinite(axis)) return
    const next = buildSupportBeamDocument({
      contour,
      params,
      profiles,
      startPurlinId: purlinId,
      startPurlinPositionMm: line.positionMm,
      axisFromSideMm: axis,
      profileId,
      widthMm,
      existingId: mode === 'add' ? undefined : activeBeam?.id,
      existingBeams: beams,
      mode,
    })
    onChange(next)
    const last = next.beams[next.beams.length - 1]
    if (last) setActiveBeamId(last.id)
  }

  function deleteActive() {
    if (!activeBeam || beams.length === 0) {
      onChange(undefined)
      setActiveBeamId(null)
      return
    }
    const next = beams.filter((b) => b.id !== activeBeam.id)
    if (next.length === 0) {
      onChange(undefined)
      setActiveBeamId(null)
      return
    }
    onChange({ formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams: next })
    setActiveBeamId(next[0]?.id ?? null)
  }

  const profileOptions = useMemo(() => {
    const set = new Set<string>([...SUPPORT_BEAM_PROFILE_OPTIONS])
    if (profileId) set.add(profileId)
    for (const b of beams) set.add(b.profileId)
    return [...set]
  }, [profileId, beams])

  return (
    <div
      className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
      data-testid="support-beam-controls"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {t('preview3D.supportBeamTitle')}
        </span>
        <button
          type="button"
          data-testid="support-beam-place"
          onClick={() => onPlaceModeChange(!placeMode)}
          className={
            placeMode
              ? 'rounded bg-blue-600 px-2 py-1 font-medium text-white'
              : 'rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200'
          }
        >
          {t('preview3D.supportBeamPlace')}
        </button>
        <button
          type="button"
          data-testid="support-beam-add"
          onClick={() => commit(axisFromSideMm, startPurlinId, beams.length > 0 ? 'add' : 'replace')}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {t('preview3D.supportBeamAdd')}
        </button>
        <button
          type="button"
          data-testid="support-beam-apply"
          onClick={() => commit(axisFromSideMm, startPurlinId, beams.length > 0 ? 'update' : 'replace')}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {activeBeam ? t('preview3D.supportBeamUpdate') : t('preview3D.supportBeamAdd')}
        </button>
        <button
          type="button"
          data-testid="support-beam-delete"
          onClick={deleteActive}
          disabled={!activeBeam && supportBeams == null}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {t('preview3D.supportBeamDelete')}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded border border-neutral-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded border border-neutral-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900"
        >
          Redo
        </button>
      </div>

      {beams.length > 1 && (
        <div className="flex flex-wrap items-center gap-1" data-testid="support-beam-list">
          {beams.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => selectBeam(b)}
              className={
                (activeBeam?.id ?? beams[0]?.id) === b.id
                  ? 'rounded bg-blue-600 px-2 py-0.5 text-white'
                  : 'rounded border border-neutral-300 bg-white px-2 py-0.5 dark:border-neutral-600 dark:bg-neutral-900'
              }
            >
              #{i + 1} {b.profileId}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-300">
          {t('preview3D.supportBeamStartPurlin')}
          <select
            data-testid="support-beam-start-purlin"
            className="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            value={startPurlinId}
            onChange={(e) => setStartPurlinId(e.target.value)}
          >
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.id} ({Math.round(line.positionMm)} mm)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-300">
          {t('preview3D.supportBeamAxisFromSide')}
          <input
            data-testid="support-beam-axis"
            type="number"
            step={0.1}
            className="w-28 rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            value={axisFromSideMm}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (Number.isFinite(v)) setAxisFromSideMm(v)
            }}
            onBlur={() => commit(axisFromSideMm, startPurlinId, beams.length > 0 ? 'update' : 'replace')}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-300">
          {t('preview3D.supportBeamProfile')}
          <select
            data-testid="support-beam-profile"
            className="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {profileOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-300">
          {t('preview3D.supportBeamWidth')}
          <input
            type="number"
            step={1}
            className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            value={widthMm}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (Number.isFinite(v) && v > 0) setWidthMm(v)
            }}
          />
        </label>
      </div>

      {resolved.length > 0 && (
        <div className="text-neutral-700 dark:text-neutral-200">
          {resolved.map((r) => {
            const len =
              Math.round(
                Math.hypot(r.endInner[0] - r.start[0], r.endInner[1] - r.start[1]) * 10,
              ) / 10
            return (
              <div key={r.id}>
                {t('preview3D.supportBeamLength', { mm: len })} ({r.profileId})
              </div>
            )
          })}
          {splitSummary && (
            <span className="ml-2">
              {t('preview3D.supportBeamSplits', {
                beam: splitSummary.beamAxisMm,
                detail: splitSummary.splits.map((s) => `${s.id}: ${s.lens.join('/')}`).join('; '),
              })}
            </span>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div
          data-testid="support-beam-warnings"
          className="whitespace-pre-line rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          {warnings.map((w, i) => (
            <div key={`${w.code}-${w.beamId ?? i}`}>{w.message}</div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{t('preview3D.supportBeamHint')}</p>
    </div>
  )
}

/** Host calls this when place-mode is on and the user clicks the 3D/plan surface. */
export function placeSupportBeamAtPlanPoint(input: {
  planXMm: number
  planYMm: number
  contour: Point2D[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  startPurlinId: string
  startPurlinPositionMm: number
  profileId?: string
  widthMm?: number
  existingId?: string
  existingBeams?: StraightSupportBeam[]
  mode?: 'replace' | 'add' | 'update'
}): SupportBeamsDocument {
  const frameHalf = beamPlanWidthForDrawing(input.profiles, input.params.beamProfileId).planWidthMm / 2
  const axis = supportBeamAxisFromPlanPoint(
    input.planXMm,
    input.planYMm,
    input.contour,
    input.params.lamellaDirectionDeg,
    frameHalf,
  )
  const existing = input.existingBeams ?? []
  return buildSupportBeamDocument({
    contour: input.contour,
    params: input.params,
    profiles: input.profiles,
    startPurlinId: input.startPurlinId,
    startPurlinPositionMm: input.startPurlinPositionMm,
    axisFromSideMm: axis,
    profileId: input.profileId ?? DEFAULT_BEAM_PROFILE,
    widthMm: input.widthMm ?? DEFAULT_BEAM_WIDTH_MM,
    existingId: input.existingId,
    existingBeams: existing,
    mode: input.mode ?? (existing.length > 0 ? 'add' : 'replace'),
  })
}
