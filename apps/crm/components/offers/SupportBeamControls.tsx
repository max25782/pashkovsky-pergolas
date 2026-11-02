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
}): SupportBeamsDocument {
  const purlinHalf =
    beamPlanWidthForDrawing(input.profiles, input.params.purlinProfileId || input.profileId)
      .planWidthMm / 2
  const frameHalf = beamPlanWidthForDrawing(input.profiles, input.params.beamProfileId).planWidthMm / 2
  const nextBeam: StraightSupportBeam = makeStraightSupportBeam({
    id: input.existingId ?? `beam-${input.startPurlinId}`,
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
  const beam = doc?.beams[0]
  const [startPurlinId, setStartPurlinId] = useState(
    () => beam?.start.purlinId ?? lines[4]?.id ?? lines[0]?.id ?? '',
  )
  const [axisFromSideMm, setAxisFromSideMm] = useState(() => {
    if (!beam) return 3104.1
    const frameHalf = beamPlanWidthForDrawing(profiles, params.beamProfileId).planWidthMm / 2
    return Math.round(supportBeamAxisFromSideMm(beam, contour, undefined, frameHalf) * 10) / 10
  })
  const [profileId, setProfileId] = useState(beam?.profileId ?? DEFAULT_BEAM_PROFILE)
  const [widthMm, setWidthMm] = useState(beam?.widthMm ?? DEFAULT_BEAM_WIDTH_MM)

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

  function commit(axis: number, purlinId: string) {
    const line = lines.find((l) => l.id === purlinId)
    if (!line || !Number.isFinite(axis)) return
    onChange(
      buildSupportBeamDocument({
        contour,
        params,
        profiles,
        startPurlinId: purlinId,
        startPurlinPositionMm: line.positionMm,
        axisFromSideMm: axis,
        profileId,
        widthMm,
        existingId: beam?.id,
      }),
    )
  }

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
          data-testid="support-beam-apply"
          onClick={() => commit(axisFromSideMm, startPurlinId)}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {beam ? t('preview3D.supportBeamUpdate') : t('preview3D.supportBeamAdd')}
        </button>
        <button
          type="button"
          data-testid="support-beam-delete"
          onClick={() => onChange(undefined)}
          disabled={!beam && supportBeams == null}
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
            onBlur={() => commit(axisFromSideMm, startPurlinId)}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-300">
          {t('preview3D.supportBeamProfile')}
          <input
            type="text"
            className="w-28 rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-900"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          />
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

      {resolved[0] && (
        <div className="text-neutral-700 dark:text-neutral-200">
          {t('preview3D.supportBeamLength', {
            mm:
              Math.round(
                Math.hypot(
                  resolved[0].endInner[0] - resolved[0].start[0],
                  resolved[0].endInner[1] - resolved[0].start[1],
                ) * 10,
              ) / 10,
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
}): SupportBeamsDocument {
  const frameHalf = beamPlanWidthForDrawing(input.profiles, input.params.beamProfileId).planWidthMm / 2
  const axis = supportBeamAxisFromPlanPoint(
    input.planXMm,
    input.planYMm,
    input.contour,
    input.params.lamellaDirectionDeg,
    frameHalf,
  )
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
  })
}
