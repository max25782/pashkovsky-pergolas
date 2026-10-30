'use client'

import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { compareStockLengthOptions, formatConstructionProfileLabel } from '@pashkovsky/pergola-core'
import { useTranslations } from 'next-intl'

const ROLE_LABELS: Record<CutPiece['role'], string> = {
  beam: 'beam',
  post: 'post',
  lamella: 'lamella',
  purlin: 'purlin',
  hanger: 'hanger',
}

function countByRole(pieces: CutPiece[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of pieces) counts[p.role] = (counts[p.role] ?? 0) + 1
  return counts
}

function countByProfile(pieces: CutPiece[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of pieces) counts[p.profileId] = (counts[p.profileId] ?? 0) + 1
  return counts
}

export function formatPlanProfileOption(
  profileId: string,
  profiles: Map<string, ProfileDimensions>,
): string {
  const profile = profiles.get(profileId)
  const base = formatConstructionProfileLabel(profileId, profile)
  if (!profile) return base
  const traits: string[] = []
  if (profile.maxSpanMm) traits.push(`maxSpan ${profile.maxSpanMm}мм`)
  if (profile.maxLamellaSpanMm) traits.push(`maxSpan ${profile.maxLamellaSpanMm}мм`)
  if (profile.interruptsLamella) traits.push('перебивает ламель')
  if (profile.hasLedChannel) traits.push('LED')
  return traits.length > 0 ? `${base} — ${traits.join(', ')}` : base
}

export interface ProfileStockComparison {
  profileId: string
  comparison: ReturnType<typeof compareStockLengthOptions>
}

export function computeStockComparisons(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): ProfileStockComparison[] {
  const byProfile = new Map<string, CutPiece[]>()
  for (const piece of pieces) {
    const list = byProfile.get(piece.profileId) ?? []
    list.push(piece)
    byProfile.set(piece.profileId, list)
  }

  const result: ProfileStockComparison[] = []
  for (const [profileId, profilePieces] of byProfile) {
    const availableStockLengthsMm = profiles.get(profileId)?.availableStockLengthsMm
    if (!availableStockLengthsMm || availableStockLengthsMm.length === 0) continue
    result.push({
      profileId,
      comparison: compareStockLengthOptions(profilePieces, availableStockLengthsMm),
    })
  }
  return result
}

export function PlanPieceSummary({
  pieces,
  ledStripLengthMm,
  profiles,
}: {
  pieces: CutPiece[]
  ledStripLengthMm: number
  profiles: Map<string, ProfileDimensions>
}) {
  const t = useTranslations('planEditor')
  const counts = countByRole(pieces)
  const lamellaProfileCounts = countByProfile(pieces.filter((p) => p.role === 'lamella'))
  const lamellaProfileIds = Object.keys(lamellaProfileCounts)

  return (
    <div className="mb-3 flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
      <div className="flex flex-wrap items-center gap-4">
        {(Object.keys(ROLE_LABELS) as Array<CutPiece['role']>)
          .filter((role) => (counts[role] ?? 0) > 0)
          .map((role) => (
            <span key={role}>
              {t('preview3D.roleCount', { role: t(`preview3D.role.${role}`), count: counts[role] })}
            </span>
          ))}
        {ledStripLengthMm > 0 && (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {t('preview3D.ledStripLength', { meters: (ledStripLengthMm / 1000).toFixed(1) })}
          </span>
        )}
      </div>
      {lamellaProfileIds.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 text-neutral-500 dark:text-neutral-400">
          <span>{t('preview3D.lamellaBreakdownLabel')}</span>
          {lamellaProfileIds.map((profileId) => (
            <span key={profileId}>
              {t('preview3D.profileCount', {
                profile: formatPlanProfileOption(profileId, profiles),
                count: lamellaProfileCounts[profileId],
              })}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function PlanStockComparisonTable({
  comparisons,
}: {
  comparisons: ProfileStockComparison[]
}) {
  const t = useTranslations('planEditor')
  if (comparisons.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        {t('preview3D.stockComparisonTitle')}
      </span>
      <div className="flex flex-wrap gap-4">
        {comparisons.map(({ profileId, comparison }) => (
          <table key={profileId} className="text-xs">
            <caption className="mb-1 text-left font-mono text-neutral-500 dark:text-neutral-400">
              {profileId}
            </caption>
            <thead>
              <tr className="text-neutral-500 dark:text-neutral-400">
                <th className="pr-3 text-left font-normal">{t('preview3D.stockLengthHeader')}</th>
                <th className="pr-3 text-left font-normal">{t('preview3D.barsHeader')}</th>
                <th className="text-left font-normal">{t('preview3D.wasteHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.options.map((opt) => (
                <tr
                  key={opt.stockLengthMm}
                  className={
                    opt.stockLengthMm === comparison.bestStockLengthMm
                      ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }
                >
                  <td className="pr-3">{(opt.stockLengthMm / 1000).toFixed(1)} м</td>
                  <td className="pr-3">{opt.barsUsed}</td>
                  <td>
                    {(opt.wasteMm / 1000).toFixed(2)} м ({opt.wastePercent.toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}
