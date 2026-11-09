'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { checkLamellaZones, type LamellaZone, type Point2D } from '@pashkovsky/pergola-core'
import {
  addLamellaZone,
  removeLamellaZone,
  setLamellaZoneEdge,
  type LamellaZoneEdgeField,
} from '@/lib/pergolas/lamella-zone-edit'

interface LamellaZonesFieldProps {
  contourMm: Array<{ x: number; y: number }> | null
  zones: LamellaZone[] | undefined
  onChange: (zones: LamellaZone[] | undefined) => void
  selectClass: string
  labelClass: string
}

const EDGE_FIELDS: Array<{ field: LamellaZoneEdgeField; labelKey: string }> = [
  { field: 'lamellaEdgeIndex', labelKey: 'paramsPanel.zoneLamellaEdge' },
  { field: 'dividerEdgeIndex', labelKey: 'paramsPanel.zoneDividerEdge' },
  { field: 'cutEdgeIndex', labelKey: 'paramsPanel.zoneCutEdge' },
]

/** Per-zone side selectors: lamellas along side N, dividers parallel to side M, cut along edge K. */
export function LamellaZonesField({ contourMm, zones, onChange, selectClass, labelClass }: LamellaZonesFieldProps) {
  const t = useTranslations('planEditor')
  const edgeCount = contourMm?.length ?? 0
  const list = zones ?? []

  const issueByZone = useMemo(() => {
    if (contourMm == null || list.length === 0) return new Map<string, string>()
    const contour = contourMm.map((p): Point2D => [p.x, p.y])
    return new Map(checkLamellaZones(contour, list).issues.map((issue) => [issue.zoneId, issue.message]))
  }, [contourMm, list])

  if (edgeCount < 3) return null

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 p-2 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200" title={t('paramsPanel.zonesHint')}>
          {t('paramsPanel.zonesTitle')}
        </span>
        <button
          type="button"
          className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
          onClick={() => onChange(addLamellaZone(zones))}
        >
          {t('paramsPanel.zonesAdd')}
        </button>
      </div>

      {list.map((zone, index) => {
        const issue = issueByZone.get(zone.id)
        return (
          <div key={zone.id} className="flex flex-col gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300">
              <span>{t('paramsPanel.zoneName', { n: index + 1 })}</span>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => onChange(removeLamellaZone(list, zone.id))}
              >
                {t('paramsPanel.zonesRemove')}
              </button>
            </div>
            {EDGE_FIELDS.map(({ field, labelKey }) => (
              <label key={field} className={labelClass}>
                {t(labelKey)}
                <select
                  className={selectClass}
                  value={zone[field]}
                  onChange={(e) => onChange(setLamellaZoneEdge(list, zone.id, field, Number(e.target.value)))}
                >
                  {Array.from({ length: edgeCount }, (_, edge) => (
                    <option key={edge} value={edge}>
                      {t('paramsPanel.zoneSide', { n: edge + 1 })}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {issue != null && (
              <p className="text-xs text-red-600 dark:text-red-400">{t('paramsPanel.zoneIssue', { reason: issue })}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
