'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  computeFrame,
  specFromPlan,
  type PlanConstructionParams,
  type Point2D,
  type ProfileDimensions,
} from '@pashkovsky/pergola-core'

interface RoofSlopeFieldsProps {
  params: PlanConstructionParams
  onChange: (params: PlanConstructionParams) => void
  contourMm: Array<{ x: number; y: number }> | null
  wallEdgeIndices: number[]
  profiles: Map<string, ProfileDimensions>
  selectClass: string
  labelClass: string
}

export function RoofSlopeFields({
  params,
  onChange,
  contourMm,
  wallEdgeIndices,
  profiles,
  selectClass,
  labelClass,
}: RoofSlopeFieldsProps) {
  const t = useTranslations('planEditor')

  const slope = params.slope ?? { mode: 'deg' as const, value: 0 }
  const highEdgeIndex = params.highEdgeIndex ?? 0
  const postHeightOverridesMm = params.postHeightOverridesMm ?? {}

  function patch(p: Partial<PlanConstructionParams>) {
    onChange({
      ...params,
      slope,
      highEdgeIndex,
      postHeightOverridesMm,
      ...p,
    })
  }

  const contour: Point2D[] | null = useMemo(
    () => (contourMm && contourMm.length >= 3 ? contourMm.map((p): Point2D => [p.x, p.y]) : null),
    [contourMm],
  )

  const frame = useMemo(() => {
    if (!contour) return null
    try {
      return computeFrame(specFromPlan({ contour, wallEdgeIndices, params }), profiles)
    } catch {
      return null
    }
  }, [contour, wallEdgeIndices, params, profiles])

  const edges = contour
    ? contour.map((a, i) => {
        const b = contour[(i + 1) % contour.length]
        const length = Math.hypot(b[0] - a[0], b[1] - a[1])
        return { i, a, b, length }
      })
    : []

  return (
    <>
      <label className={labelClass}>
        {t('paramsPanel.slopeLabel')}
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            className={`${selectClass} min-w-0 flex-1`}
            value={slope.value}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (Number.isFinite(v)) patch({ slope: { ...slope, value: v } })
            }}
          />
          <select
            className={selectClass}
            value={slope.mode}
            onChange={(e) => {
              const mode = e.target.value
              if (mode === 'deg' || mode === 'percent' || mode === 'dropCm') {
                patch({ slope: { ...slope, mode } })
              }
            }}
          >
            <option value="deg">{t('paramsPanel.slopeModeDeg')}</option>
            <option value="percent">{t('paramsPanel.slopeModePercent')}</option>
            <option value="dropCm">{t('paramsPanel.slopeModeDropCm')}</option>
          </select>
        </div>
      </label>

      {edges.length > 0 && (
        <label className={labelClass}>
          {t('paramsPanel.highEdgeLabel')}
          <select
            className={selectClass}
            value={highEdgeIndex}
            onChange={(e) => patch({ highEdgeIndex: parseInt(e.target.value, 10) || 0 })}
          >
            {edges.map((edge) => (
              <option key={edge.i} value={edge.i}>
                {t('paramsPanel.highEdgeOption', {
                  from: `${Math.round(edge.a[0])},${Math.round(edge.a[1])}`,
                  to: `${Math.round(edge.b[0])},${Math.round(edge.b[1])}`,
                  length: Math.round(edge.length),
                })}
              </option>
            ))}
          </select>
        </label>
      )}

      {frame?.roof.warning && (
        <p className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
          {t('paramsPanel.roofPlaneWarning', { mm: frame.roof.maxAbsResidualMm.toFixed(1) })}
        </p>
      )}

      {frame && frame.posts.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('paramsPanel.postHeightsLabel')}</span>
          <ul className="flex flex-col gap-1">
            {frame.posts.map((post) => (
              <li key={post.id} className="flex items-center gap-2">
                <span className="w-28 shrink-0 font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                  {post.id}
                </span>
                <input
                  type="number"
                  step={10}
                  className={`${selectClass} min-w-0 flex-1`}
                  value={Math.round(post.lengthAxisMm)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!Number.isFinite(v) || v <= 0) return
                    patch({
                      postHeightOverridesMm: { ...postHeightOverridesMm, [post.id]: v },
                    })
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {frame && frame.hangers.length > 0 && params.supportType === 'hanging' && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('paramsPanel.hangerHeightsLabel')}</span>
          <ul className="flex flex-col gap-1">
            {frame.hangers.map((hanger) => (
              <li key={hanger.id} className="flex items-center gap-2 font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                <span className="w-28 shrink-0">{hanger.id}</span>
                <span>{Math.round(hanger.position[1])} mm</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
