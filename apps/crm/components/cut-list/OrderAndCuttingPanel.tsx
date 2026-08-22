'use client'

/**
 * Обёртка над листом заказа (Part 2) и листом порезки (Part 3) — держит
 * ОДНО состояние выбранных длин хлыста (bundleKey → stockLengthMm), общее
 * для обоих листов: то, что пользователь зафиксировал в листе заказа,
 * должно быть ровно тем, что цех увидит в листе порезки (см.
 * lib/cut-list/order-sheet.ts getChosenPlan — единый источник выбора).
 */

import { useState } from 'react'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { OrderSheet } from './OrderSheet'
import { CuttingSheet } from './CuttingSheet'

export interface OrderAndCuttingPanelProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  /**
   * Honest-degradation warning (see prompt "честная плашка для
   * неортогональных форм" / TopPlanSheet's own `isOrthogonal` prop for the
   * full rationale) — `false` + non-empty `nonOrthogonalWarningText` shows
   * a banner above the order/cutting sub-tabs: the order and cutting sheets
   * below are still fully computed from the same `pieces`, just flagged as
   * approximate because the underlying shape isn't axis-aligned.
   */
  isOrthogonal?: boolean
  nonOrthogonalWarningText?: string
}

export function OrderAndCuttingPanel({
  pieces,
  profiles,
  isOrthogonal,
  nonOrthogonalWarningText,
}: OrderAndCuttingPanelProps) {
  const [subTab, setSubTab] = useState<'order' | 'cutting'>('order')
  const [chosenLengths, setChosenLengths] = useState<Map<string, number>>(new Map())
  const showWarning = isOrthogonal === false && !!nonOrthogonalWarningText

  function handleChooseLength(bundleKey: string, stockLengthMm: number) {
    setChosenLengths((prev) => {
      const next = new Map(prev)
      next.set(bundleKey, stockLengthMm)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      {showWarning && (
        <div
          role="alert"
          className="shrink-0 border-b border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200"
        >
          ⚠️ {nonOrthogonalWarningText}
        </div>
      )}
      <div className="flex items-center gap-1 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => setSubTab('order')}
          className={
            subTab === 'order'
              ? 'rounded bg-neutral-900 px-3 py-1 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'rounded px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }
        >
          Лист заказа
        </button>
        <button
          type="button"
          onClick={() => setSubTab('cutting')}
          className={
            subTab === 'cutting'
              ? 'rounded bg-neutral-900 px-3 py-1 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'rounded px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }
        >
          Лист порезки
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {subTab === 'order' ? (
          <OrderSheet
            pieces={pieces}
            profiles={profiles}
            chosenLengths={chosenLengths}
            onChooseLength={handleChooseLength}
          />
        ) : (
          <CuttingSheet pieces={pieces} profiles={profiles} chosenLengths={chosenLengths} />
        )}
      </div>
    </div>
  )
}
