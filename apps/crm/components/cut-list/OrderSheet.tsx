'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import {
  buildProfileBundlePlans,
  buildOrderSheetTotals,
  chosenStockLengthMm,
  DEFAULT_KERF_MM,
  fittingStockOptions,
  type ProfileBundlePlan,
} from '@/lib/cut-list/order-sheet'

export interface OrderSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  chosenLengths: Map<string, number>
  onChooseLength: (bundleKey: string, stockLengthMm: number) => void
  /** Order PDF: only the chosen bar length, no radios and no other lengths. */
  printMode?: boolean
}

function formatMeters(mm: number): string {
  return (mm / 1000).toFixed(mm % 1000 === 0 ? 1 : 2)
}

export function OrderSheet({ pieces, profiles, chosenLengths, onChooseLength, printMode = false }: OrderSheetProps) {
  const t = useTranslations('planEditor.drawing')
  const locale = useLocale()
  const dir = locale === 'he' ? 'rtl' : 'ltr'
  const plans = useMemo(() => buildProfileBundlePlans(pieces, profiles), [pieces, profiles])
  const effectiveLengths = useMemo(() => {
    const next = new Map<string, number>()
    for (const bundle of plans) {
      const lengthMm = chosenStockLengthMm(bundle, chosenLengths)
      if (lengthMm != null) next.set(bundle.bundleKey, lengthMm)
    }
    return next
  }, [plans, chosenLengths])
  const totals = useMemo(() => buildOrderSheetTotals(plans, effectiveLengths), [plans, effectiveLengths])

  return (
    <div dir={dir} className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('kerfNote', { mm: DEFAULT_KERF_MM })}</p>
      <div className="flex flex-col gap-3">
        {plans.map((bundle) => (
          <BundleRow
            key={bundle.bundleKey}
            bundle={bundle}
            chosenStockLengthMm={chosenStockLengthMm(bundle, chosenLengths)}
            onChoose={(len) => onChooseLength(bundle.bundleKey, len)}
            printMode={printMode}
          />
        ))}
        {plans.length === 0 && (
          <div className="text-neutral-500 dark:text-neutral-400">{t('noPieces')}</div>
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
  printMode: boolean
}

function BundleRow({ bundle, chosenStockLengthMm, onChoose, printMode }: BundleRowProps) {
  const t = useTranslations('planEditor.drawing')
  const fitting = fittingStockOptions(bundle)
  const chosen = fitting.some((option) => option.stockLengthMm === chosenStockLengthMm)
    ? chosenStockLengthMm
    : bundle.recommendedStockLengthMm
  const chosenOption = fitting.find((option) => option.stockLengthMm === chosen)

  return (
    <div data-pdf-keep="" className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      {bundle.lamellaOversizeMm != null && (
        <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t('lamellaTooLong', { length: Math.round(bundle.lamellaOversizeMm), stock: 6000 })}
        </div>
      )}
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <span className="shrink-0 whitespace-nowrap font-mono font-semibold text-neutral-900 dark:text-neutral-100">
          {bundle.profileId}
          {bundle.profileWidthMm && bundle.profileHeightMm ? (
            <>
              {' '}
              <bdi dir="ltr">({bundle.profileWidthMm}×{bundle.profileHeightMm} {t('unitMm')})</bdi>
            </>
          ) : null}
        </span>
        <span
          className="inline-block h-3.5 w-3.5 rounded-sm border border-neutral-300 dark:border-neutral-600"
          style={{ backgroundColor: bundle.color }}
          title={bundle.color}
        />
        <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400"><bdi dir="ltr">{bundle.color}</bdi></span>
        <span className="shrink-0 whitespace-nowrap text-neutral-500 dark:text-neutral-400">
          {t('pieceSummary', {
            count: bundle.pieceCount,
            meters: (bundle.totalLengthLongMm / 1000).toFixed(2),
          })}
        </span>
      </div>

      {bundle.options.length === 0 ? (
        <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {t('noStockCatalog', { profile: bundle.profileId })}
        </div>
      ) : fitting.length > 0 && printMode ? (
        chosenOption?.plan ? (
          <div data-pdf-keep="" data-pdf-row="" className="overflow-hidden text-sm font-semibold" style={{ height: '8mm', lineHeight: '8mm' }}>
            <bdi dir="ltr">{chosenOption.plan.totalBars} × {formatMeters(chosenOption.stockLengthMm)} m</bdi>
          </div>
        ) : null
      ) : fitting.length > 0 ? (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-start text-neutral-500 dark:text-neutral-400">
                <th className="py-1 pe-3 font-normal"> </th>
                <th className="py-1 pe-3 font-normal">{t('stockLength')}</th>
                <th className="py-1 pe-3 font-normal">{t('bars')}</th>
                <th className="py-1 pe-3 font-normal">{t('waste')}</th>
              </tr>
            </thead>
            <tbody>
              {fitting.map((opt) => {
                const isChosen = opt.stockLengthMm === chosen
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
                    <td className="py-1 pe-3">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`stock-${bundle.bundleKey}`}
                          checked={isChosen}
                          onChange={() => onChoose(opt.stockLengthMm)}
                        />
                      </label>
                    </td>
                    <td className="py-1 pe-3">
                      <bdi dir="ltr">{formatMeters(opt.stockLengthMm)} m</bdi>
                      {isRecommended && (
                        <span className="ms-1 text-emerald-600 dark:text-emerald-400">({t('recommended')})</span>
                      )}
                    </td>
                    <td className="py-1 pe-3 font-semibold"><bdi dir="ltr">{opt.plan?.totalBars}</bdi></td>
                    <td className="py-1 pe-3">
                      <bdi dir="ltr">
                        {((opt.plan?.totalWasteMm ?? 0) / 1000).toFixed(2)} m ({opt.plan?.wastePct.toFixed(1)}%)
                      </bdi>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {chosenOption?.plan && (
            <div className="mt-2 text-neutral-600 dark:text-neutral-300">
              {t('orderSummary', {
                bars: chosenOption.plan.totalBars,
                meters: formatMeters(chosenOption.stockLengthMm),
              })}
              {bundle.weightKgPerMeter != null ? (
                <>
                  {' '}
                  · {t('weightApprox', {
                    kg: ((chosenOption.plan.totalBars * chosenOption.stockLengthMm * bundle.weightKgPerMeter) / 1000).toFixed(1),
                  })}
                </>
              ) : (
                <>
                  {' '}
                  · {t('weightNotSet')}
                </>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function TotalsTable({ totals }: { totals: ReturnType<typeof buildOrderSheetTotals> }) {
  const t = useTranslations('planEditor.drawing')
  if (totals.length === 0) return null
  return (
    <div className="mt-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
      <div className="mb-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{t('totalByProfile')}</div>
      <table className="text-xs">
        <thead>
          <tr className="text-start text-neutral-500 dark:text-neutral-400">
            <th className="py-1 pe-4 font-normal">{t('colProfile')}</th>
            <th className="py-1 pe-4 font-normal">{t('barsTotal')}</th>
            <th className="py-1 font-normal">{t('colWeight')}</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((row) => (
            <tr key={row.profileId} className="text-neutral-900 dark:text-neutral-100">
              <td className="py-1 pe-4 font-mono">{row.profileId}</td>
              <td className="py-1 pe-4 font-semibold"><bdi dir="ltr">{row.totalBars}</bdi></td>
              <td className="py-1 text-neutral-600 dark:text-neutral-300">
                {row.totalWeightKg != null ? <bdi dir="ltr">{row.totalWeightKg.toFixed(1)} {t('unitKg')}</bdi> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
