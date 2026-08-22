'use client'

/**
 * Лист заказа (промпт «ЧАСТЬ 2 — ЛИСТ ЗАКАЗА») — сколько какого алюминия
 * заказать у поставщика. Одна строка на связку (профиль + цвет), с
 * управляемым выбором длины хлыста (пользователь видит сравнение по всем
 * доступным длинам и фиксирует, откуда заказывать этот профиль — см.
 * lib/cut-list/order-sheet.ts buildProfileBundlePlans).
 *
 * Строится ИСКЛЮЧИТЕЛЬНО из props.pieces + props.profiles — тот же
 * CutPiece[], что уже ушёл в 3D/чертёж (единый источник правды, см.
 * TopPlanSheet.tsx). Никакого отдельного пересчёта конструктива здесь нет.
 */

import { useMemo } from 'react'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import {
  buildProfileBundlePlans,
  buildOrderSheetTotals,
  type ProfileBundlePlan,
} from '@/lib/cut-list/order-sheet'

export interface OrderSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  /** Lifted up so CuttingSheet (Part 3) can read the SAME choice the user made here. */
  chosenLengths: Map<string, number>
  onChooseLength: (bundleKey: string, stockLengthMm: number) => void
}

function formatProfileLabel(bundle: ProfileBundlePlan): string {
  const dims = bundle.profileWidthMm && bundle.profileHeightMm
    ? ` (${bundle.profileWidthMm}×${bundle.profileHeightMm} мм)`
    : ''
  return `${bundle.profileId}${dims}`
}

export function OrderSheet({ pieces, profiles, chosenLengths, onChooseLength }: OrderSheetProps) {
  const plans = useMemo(() => buildProfileBundlePlans(pieces, profiles), [pieces, profiles])
  const totals = useMemo(() => buildOrderSheetTotals(plans, chosenLengths), [plans, chosenLengths])

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <div className="flex flex-col gap-3">
        {plans.map((bundle) => (
          <BundleRow
            key={bundle.bundleKey}
            bundle={bundle}
            chosenStockLengthMm={chosenLengths.get(bundle.bundleKey) ?? bundle.recommendedStockLengthMm}
            onChoose={(len) => onChooseLength(bundle.bundleKey, len)}
          />
        ))}
        {plans.length === 0 && (
          <div className="text-neutral-500 dark:text-neutral-400">Нет деталей для отображения.</div>
        )}
      </div>

      <TotalsTable totals={totals} />
    </div>
  )
}

interface BundleRowProps {
  bundle: ProfileBundlePlan
  chosenStockLengthMm: number | null
  onChoose: (stockLengthMm: number) => void
}

function BundleRow({ bundle, chosenStockLengthMm, onChoose }: BundleRowProps) {
  const chosenOption = bundle.options.find((o) => o.stockLengthMm === chosenStockLengthMm)
  const hasAnyValidOption = bundle.options.some((o) => o.plan != null)

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
          {formatProfileLabel(bundle)}
        </span>
        <span
          className="inline-block h-3.5 w-3.5 rounded-sm border border-neutral-300 dark:border-neutral-600"
          style={{ backgroundColor: bundle.color }}
          title={bundle.color}
        />
        <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">{bundle.color}</span>
        <span className="text-neutral-500 dark:text-neutral-400">
          {bundle.pieceCount} дет. · {(bundle.totalLengthLongMm / 1000).toFixed(2)} м суммарно
        </span>
      </div>

      {bundle.options.length === 0 ? (
        <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Для профиля &quot;{bundle.profileId}&quot; не заданы доступные длины хлыста (availableStockLengthsMm) —
          лист заказа по нему не считается, пока каталог не заполнен.
        </div>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500 dark:text-neutral-400">
                <th className="py-1 pr-3 font-normal"> </th>
                <th className="py-1 pr-3 font-normal">Длина хлыста</th>
                <th className="py-1 pr-3 font-normal">Хлыстов</th>
                <th className="py-1 pr-3 font-normal">Отход</th>
              </tr>
            </thead>
            <tbody>
              {bundle.options.map((opt) => {
                const isChosen = opt.stockLengthMm === chosenStockLengthMm
                const isRecommended = opt.stockLengthMm === bundle.recommendedStockLengthMm
                return (
                  <tr
                    key={opt.stockLengthMm}
                    className={
                      isChosen
                        ? 'bg-emerald-50 text-neutral-900 dark:bg-emerald-950 dark:text-neutral-100'
                        : 'text-neutral-900 dark:text-neutral-100'
                    }
                  >
                    <td className="py-1 pr-3">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`stock-${bundle.bundleKey}`}
                          checked={isChosen}
                          disabled={opt.plan == null}
                          onChange={() => onChoose(opt.stockLengthMm)}
                        />
                      </label>
                    </td>
                    <td className="py-1 pr-3">
                      {(opt.stockLengthMm / 1000).toFixed(1)} м
                      {isRecommended && (
                        <span className="ml-1 text-emerald-600 dark:text-emerald-400">(рекомендуется)</span>
                      )}
                    </td>
                    {opt.plan ? (
                      <>
                        <td className="py-1 pr-3 font-semibold">{opt.plan.totalBars}</td>
                        <td className="py-1 pr-3">
                          {(opt.plan.totalWasteMm / 1000).toFixed(2)} м ({opt.plan.wastePct.toFixed(1)}%)
                        </td>
                      </>
                    ) : (
                      <td className="py-1 pr-3 text-red-600 dark:text-red-400" colSpan={2} title={opt.error ?? undefined}>
                        не влезает — в связке есть деталь длиннее этого хлыста
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {chosenOption?.plan && (
            <div className="mt-2 text-neutral-600 dark:text-neutral-300">
              Заказ: <strong>{chosenOption.plan.totalBars}</strong> хлыстов ×{' '}
              {(chosenOption.stockLengthMm / 1000).toFixed(1)} м
              {bundle.weightKgPerMeter != null && (
                <>
                  {' '}
                  · вес ≈{' '}
                  {((chosenOption.plan.totalBars * chosenOption.stockLengthMm * bundle.weightKgPerMeter) / 1000).toFixed(1)}{' '}
                  кг
                </>
              )}
            </div>
          )}

          {!hasAnyValidOption && (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              Ни одна доступная длина хлыста для &quot;{bundle.profileId}&quot; не подходит — самая длинная деталь в
              этой связке длиннее любой из них. Нужна более длинная позиция в availableStockLengthsMm каталога, или
              деталь нужно сегментировать выше по потоку (это НЕ решается выбором хлыста здесь).
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TotalsTable({ totals }: { totals: ReturnType<typeof buildOrderSheetTotals> }) {
  if (totals.length === 0) return null
  return (
    <div className="mt-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
      <div className="mb-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">Итого по профилям</div>
      <table className="text-xs">
        <thead>
          <tr className="text-left text-neutral-500 dark:text-neutral-400">
            <th className="py-1 pr-4 font-normal">Профиль</th>
            <th className="py-1 pr-4 font-normal">Хлыстов всего</th>
            <th className="py-1 font-normal">Вес</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((row) => (
            <tr key={row.profileId} className="text-neutral-900 dark:text-neutral-100">
              <td className="py-1 pr-4 font-mono">{row.profileId}</td>
              <td className="py-1 pr-4 font-semibold">{row.totalBars}</td>
              <td className="py-1 text-neutral-600 dark:text-neutral-300">
                {row.totalWeightKg != null ? `${row.totalWeightKg.toFixed(1)} кг` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
