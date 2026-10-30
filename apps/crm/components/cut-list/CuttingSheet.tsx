'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { buildProfileBundlePlans, chosenStockLengthMm, DEFAULT_KERF_MM, formatCutDeg, groupCuttingLayouts, type CuttingLayoutCut, type ProfileBundlePlan } from '@/lib/cut-list/order-sheet'

export interface CuttingSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  chosenLengths: Map<string, number>
}

export function CuttingSheet({ pieces, profiles, chosenLengths }: CuttingSheetProps) {
  const t = useTranslations('planEditor.drawing')
  const locale = useLocale()
  const dir = locale === 'he' ? 'rtl' : 'ltr'
  const plans = useMemo(() => buildProfileBundlePlans(pieces, profiles), [pieces, profiles])

  return (
    <div dir={dir} className="legacy-cut-rows flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('kerfNote', { mm: DEFAULT_KERF_MM })}</p>
      {plans.map((bundle) => (
        <BundleCuttingSheet
          key={bundle.bundleKey}
          bundle={bundle}
          chosenLengths={chosenLengths}
        />
      ))}
      {plans.length === 0 && (
        <div className="text-neutral-500 dark:text-neutral-400">{t('noPieces')}</div>
      )}
    </div>
  )
}

interface BundleCuttingSheetProps {
  bundle: ProfileBundlePlan
  chosenLengths: Map<string, number>
}

function CutEndMark({ cut }: { cut: CuttingLayoutCut }) {
  const tilt = (deg: number) => ((90 - deg) * Math.PI) / 180
  const end = (x: number, deg: number, outward: number) => {
    const dx = Math.tan(tilt(deg)) * 3 * outward
    return { x1: x - dx, y1: 1, x2: x + dx, y2: 7 }
  }
  const left = end(3, cut.cutStartDeg, 1)
  const right = end(19, cut.cutEndDeg, -1)
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true" style={{ verticalAlign: 'middle', marginInlineEnd: 4 }}>
      <polygon
        points={`${left.x1},${left.y1} ${right.x1},${right.y1} ${right.x2},${right.y2} ${left.x2},${left.y2}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {cut.cutStartDeg !== 90 && <circle cx={left.x2} cy={left.y2} r="1.1" fill="currentColor" />}
      {cut.cutEndDeg !== 90 && <circle cx={right.x2} cy={right.y2} r="1.1" fill="currentColor" />}
    </svg>
  )
}

function BundleCuttingSheet({ bundle, chosenLengths }: BundleCuttingSheetProps) {
  const t = useTranslations('planEditor.drawing')
  const stockMm = chosenStockLengthMm(bundle, chosenLengths)
  const plan = stockMm == null ? null : bundle.options.find((option) => option.stockLengthMm === stockMm)?.plan ?? null

  if (!plan) {
    return (
      <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        <span className="font-mono font-semibold">{bundle.profileId}</span> (<bdi dir="ltr">{bundle.color}</bdi>) — {t('cuttingNoPlan')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
        <span className="font-mono font-semibold">{bundle.profileId}</span>
        <span
          className="inline-block h-3.5 w-3.5 rounded-sm border border-neutral-300 dark:border-neutral-600"
          style={{ backgroundColor: bundle.color }}
        />
        <span className="font-mono text-xs"><bdi dir="ltr">{bundle.color}</bdi></span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          <bdi dir="ltr">{(plan.stockLengthMm / 1000).toFixed(1)} m · {plan.totalBars}</bdi>
        </span>
      </div>
      {bundle.lamellaOversizeMm != null && (
        <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t('lamellaTooLong', { length: Math.round(bundle.lamellaOversizeMm), stock: 6000 })}
        </div>
      )}

      {groupCuttingLayouts(plan.bars).map((line, index) => (
        <div
          key={`${line.stockLengthMm}-${line.wasteMm}-${line.cuts.map((cut) => `${cut.count}x${cut.lengthMm}`).join('+')}`}
          data-pdf-keep=""
          data-pdf-row=""
          data-pdf-break={index > 0 && index % 24 === 0 ? '' : undefined}
          className="overflow-hidden text-xs text-neutral-900 dark:text-neutral-100"
          style={{ height: '8mm', lineHeight: '8mm', whiteSpace: 'nowrap' }}
        >
          <bdi dir="ltr">
            {line.cuts.map((cut) => (
              <CutEndMark key={`${cut.lengthMm}-${cut.cutStartDeg}-${cut.cutEndDeg}`} cut={cut} />
            ))}
            {t('cuttingGroup', {
              count: line.count,
              bar: t('cuttingBar'),
              meters: (line.stockLengthMm / 1000).toFixed(1),
              cuts: line.cuts.map((cut) => {
                const length = t('cuttingCut', { count: cut.count, length: cut.lengthMm })
                const angles = `${formatCutDeg(cut.cutStartDeg)}°/${formatCutDeg(cut.cutEndDeg)}°`
                const beam = cut.beamPart
                  ? ` ${t('beamPart', { n: cut.beamIndex ?? 0, part: cut.beamPart.part, total: cut.beamPart.total })}`
                  : ''
                return `${length} ${angles}${beam}`
              }).join(' + '),
              rest: t('cuttingRest'),
              waste: line.wasteMm,
            })}
          </bdi>
        </div>
      ))}
    </div>
  )
}
