'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addPlanDivider,
  movePlanDivider,
  planPointToDividerPositionMm,
  removePlanDivider,
  resolvePlanPurlinLines,
  type PieceWarning,
  type PlanConstructionParams,
  type Point2D,
  type ProfileDimensions,
} from '@pashkovsky/pergola-core'

interface Plan3DDividerControlsProps {
  contour: Point2D[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  warnings: PieceWarning[]
  dividerIds?: string[]
  onChange: (params: PlanConstructionParams) => void
  t: (key: string, values?: Record<string, string | number | Date>) => string
  children: (bind: {
    selectedDividerId: string | null
    warningDividerIds: string[]
    addDividerActive: boolean
    onSelectDivider: (id: string | null) => void
    onMoveDivider: (id: string, planXMm: number, planYMm: number) => void
    onAddDividerAt: (planXMm: number, planYMm: number) => void
  }) => React.ReactNode
}

export function Plan3DDividerControls({
  contour,
  params,
  profiles,
  warnings,
  dividerIds = [],
  onChange,
  t,
  children,
}: Plan3DDividerControlsProps) {
  const [selectedDividerId, setSelectedDividerId] = useState<string | null>(null)
  const [addDividerActive, setAddDividerActive] = useState(false)

  const uniqueDividerIds = useMemo(() => {
    const ids = new Set(dividerIds.filter(Boolean))
    for (const line of resolvePlanPurlinLines(contour, params, profiles)) ids.add(line.id)
    return [...ids].sort((a, b) => {
      const na = /^div-(\d+)$/.exec(a)
      const nb = /^div-(\d+)$/.exec(b)
      if (na && nb) return Number(na[1]) - Number(nb[1])
      return a.localeCompare(b)
    })
  }, [contour, params, profiles, dividerIds])

  const warningDividerIds = useMemo(() => {
    const ids = new Set<string>()
    for (const warning of warnings) {
      if (warning.startDividerId) ids.add(warning.startDividerId)
      if (warning.endDividerId) ids.add(warning.endDividerId)
    }
    return [...ids]
  }, [warnings])

  const onMoveDivider = useCallback(
    (id: string, planXMm: number, planYMm: number) => {
      const positionMm = planPointToDividerPositionMm(planXMm, planYMm, params.lamellaDirectionDeg)
      onChange(movePlanDivider(contour, params, profiles, id, positionMm))
    },
    [contour, params, profiles, onChange],
  )

  const onAddDividerAt = useCallback(
    (planXMm: number, planYMm: number) => {
      const positionMm = planPointToDividerPositionMm(planXMm, planYMm, params.lamellaDirectionDeg)
      onChange(addPlanDivider(contour, params, profiles, positionMm))
      setAddDividerActive(false)
    },
    [contour, params, profiles, onChange],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedDividerId) return
    onChange(removePlanDivider(contour, params, profiles, selectedDividerId))
    setSelectedDividerId(null)
  }, [selectedDividerId, contour, params, profiles, onChange])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (event.key === 'Delete') deleteSelected()
      if (event.key === 'Escape') {
        setSelectedDividerId(null)
        setAddDividerActive(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected])

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {warnings.length > 0 && (
        <div className="whitespace-pre-line border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          {t('preview3D.spanWarningTitle')}
          {warnings.slice(0, 4).map((warning) => (
            <div key={`${warning.pieceId}-${warning.spanStartMm}`}>
              {t('preview3D.spanWarningLine', {
                span: Math.round(warning.spanMm),
                max: Math.round(warning.maxSpanMm),
                start: warning.startDividerId ?? t('preview3D.contourEdge'),
                end: warning.endDividerId ?? t('preview3D.contourEdge'),
              })}
            </div>
          ))}
          {warnings.length > 4 && (
            <div>{t('preview3D.spanWarningMore', { count: warnings.length - 4 })}</div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {t('preview3D.editDividers')}
        </span>
        <button
          type="button"
          onClick={() => setAddDividerActive((v) => !v)}
          className={
            addDividerActive
              ? 'rounded bg-blue-600 px-2 py-1 font-medium text-white'
              : 'rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200'
          }
        >
          {t('preview3D.addDivider')}
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedDividerId}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {t('preview3D.deleteDivider')}
        </button>
        <span className="text-neutral-500 dark:text-neutral-400">
          {selectedDividerId
            ? t('preview3D.selectedDivider', { id: selectedDividerId })
            : t('preview3D.dividerHint')}
        </span>
        {uniqueDividerIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelectedDividerId(id)}
            className={
              selectedDividerId === id
                ? 'rounded bg-blue-600 px-2 py-1 font-medium text-white'
                : 'rounded border border-amber-400 bg-amber-50 px-2 py-1 text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100'
            }
          >
            {id}
          </button>
        ))}
        {selectedDividerId && (
          <label className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
            {t('preview3D.dividerPositionMm')}
            <input
              data-testid="divider-position-mm"
              type="number"
              step={0.1}
              className="w-24 rounded border border-neutral-300 bg-white px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-900"
              value={
                resolvePlanPurlinLines(contour, params, profiles).find((l) => l.id === selectedDividerId)
                  ?.positionMm ?? ''
              }
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!Number.isFinite(v) || !selectedDividerId) return
                onChange(movePlanDivider(contour, params, profiles, selectedDividerId, v))
              }}
            />
          </label>
        )}
      </div>
      <div className="h-[420px] w-full shrink-0">
        {children({
          selectedDividerId,
          warningDividerIds,
          addDividerActive,
          onSelectDivider: setSelectedDividerId,
          onMoveDivider,
          onAddDividerAt,
        })}
      </div>
    </div>
  )
}
