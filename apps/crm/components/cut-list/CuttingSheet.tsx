'use client'

/**
 * Лист порезки (промпт «ЧАСТЬ 3 — ЛИСТ ПОРЕЗКИ») — что режет пильщик, хлыст
 * за хлыстом. Никакой новой упаковки здесь не считается: каждый хлыст —
 * это `bar` из ТОГО ЖЕ packProfile()-плана, который лист заказа (Part 2)
 * уже посчитал для выбранной пользователем длины хлыста (см.
 * lib/cut-list/order-sheet.ts getChosenPlan) — единый источник, как и
 * везде в этом пайплайне.
 *
 * Углы и рука — не декоративные цифры: cutMiterDeg + cutBevelDeg (составной
 * угол) и cutHand приходят из CutPiece без изменений (см. промпт «углы и
 * рука критичны, перепутанная рука — деталь в мусор»).
 */

import { useMemo } from 'react'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { buildProfileBundlePlans, getChosenPlan, type ProfileBundlePlan } from '@/lib/cut-list/order-sheet'

export interface CuttingSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  chosenLengths: Map<string, number>
}

const ROLE_LABEL_RU: Record<CutPiece['role'], string> = {
  beam: 'балка',
  post: 'стойка',
  lamella: 'ламель',
  purlin: 'прогон',
  hanger: 'подвес',
}

function formatAngle(hand: CutPiece['cutHandStart'], miterDeg: number, bevelDeg: number): string {
  if (hand === 'straight' && miterDeg === 0 && bevelDeg === 0) return 'прямой (90°)'
  const parts: string[] = []
  if (miterDeg !== 0) parts.push(`митра ${miterDeg.toFixed(1)}°`)
  if (bevelDeg !== 0) parts.push(`наклон ${bevelDeg.toFixed(1)}°`)
  const handLabel = hand === 'L' ? 'лево' : hand === 'R' ? 'право' : ''
  return `${parts.join(' + ')}${handLabel ? ` (${handLabel})` : ''}`
}

export function CuttingSheet({ pieces, profiles, chosenLengths }: CuttingSheetProps) {
  const plans = useMemo(() => buildProfileBundlePlans(pieces, profiles), [pieces, profiles])
  const pieceById = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces])

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      {plans.map((bundle) => (
        <BundleCuttingSheet
          key={bundle.bundleKey}
          bundle={bundle}
          chosenLengths={chosenLengths}
          pieceById={pieceById}
        />
      ))}
      {plans.length === 0 && (
        <div className="text-neutral-500 dark:text-neutral-400">Нет деталей для отображения.</div>
      )}
    </div>
  )
}

interface BundleCuttingSheetProps {
  bundle: ProfileBundlePlan
  chosenLengths: Map<string, number>
  pieceById: Map<string, CutPiece>
}

function BundleCuttingSheet({ bundle, chosenLengths, pieceById }: BundleCuttingSheetProps) {
  const plan = getChosenPlan(bundle, chosenLengths)

  if (!plan) {
    const noOptionFits = bundle.options.length > 0 && bundle.options.every((o) => o.plan == null)
    return (
      <div className="rounded-lg border border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        <span className="font-mono font-semibold">{bundle.profileId}</span> ({bundle.color}) —{' '}
        {noOptionFits
          ? 'ни одна доступная длина хлыста не подходит (в связке есть деталь длиннее любой из них), лист порезки не построен'
          : 'нет выбранной длины хлыста, лист порезки не построен'}{' '}
        (см. лист заказа).
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
        <span className="font-mono text-xs">{bundle.color}</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          хлыст {(plan.stockLengthMm / 1000).toFixed(1)} м · {plan.totalBars} шт
        </span>
      </div>

      {plan.bars.map((bar, barIndex) => (
        <div key={barIndex} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              Хлыст №{barIndex + 1} ({(bar.stockLengthMm / 1000).toFixed(1)} м)
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">
              использовано {(bar.usedMm / 1000).toFixed(2)} м · остаток {bar.wasteMm.toFixed(0)} мм
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500 dark:text-neutral-400">
                <th className="py-1 pr-3 font-normal">#</th>
                <th className="py-1 pr-3 font-normal">Деталь</th>
                <th className="py-1 pr-3 font-normal">Длина (по длинной точке)</th>
                <th className="py-1 pr-3 font-normal">Левый торец</th>
                <th className="py-1 font-normal">Правый торец</th>
              </tr>
            </thead>
            <tbody>
              {bar.pieces.map((ref, i) => {
                const source = pieceById.get(ref.pieceId)
                const roleLabel = source ? ROLE_LABEL_RU[source.role] : '?'
                return (
                  <tr
                    key={ref.pieceId}
                    className="border-t border-neutral-100 text-neutral-900 dark:border-neutral-800 dark:text-neutral-100"
                  >
                    <td className="py-1 pr-3">{i + 1}</td>
                    <td className="py-1 pr-3 font-mono">
                      {roleLabel} ({ref.pieceId})
                    </td>
                    <td className="py-1 pr-3 font-semibold">{ref.lengthLongMm.toFixed(0)} мм</td>
                    <td className="py-1 pr-3">{formatAngle(ref.cutHandStart, ref.cutMiterStartDeg, ref.cutBevelStartDeg)}</td>
                    <td className="py-1">{formatAngle(ref.cutHandEnd, ref.cutMiterEndDeg, ref.cutBevelEndDeg)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
