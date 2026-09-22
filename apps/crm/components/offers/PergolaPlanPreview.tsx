'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TopPlanSheet } from '@pashkovsky/pergola-drawing'
import { PergolaCutPieceViewer } from '@pashkovsky/pergola-3d-preview'
import type { PergolaPlan } from '@/types/offer'
import { buildPiecesFromPlan, PLAN_PREVIEW_PROFILES } from '@/lib/pergolas/plan-pieces'

interface PergolaPlanPreviewProps {
  plan: PergolaPlan
  title: string
}

function polygonViewBox(polygon: Array<{ x: number; y: number }>): string {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of polygon) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  const pad = 400
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  return `${minX - pad} ${-(maxY + pad)} ${width + pad * 2} ${height + pad * 2}`
}

export function PergolaPlanPreview({ plan, title }: PergolaPlanPreviewProps) {
  const t = useTranslations('planEditor')
  const [open, setOpen] = useState(false)

  const built = useMemo(() => {
    try {
      return { pieces: buildPiecesFromPlan(plan), error: null as string | null }
    } catch (error) {
      return {
        pieces: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }, [plan])

  const outline = plan.polygon.map((point) => `${point.x},${-point.y}`).join(' ')

  return (
    <div className="border-b border-white/10 last:border-b-0">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm font-medium text-white">{title}</span>
        {built.pieces && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-blue-300 hover:text-blue-200"
          >
            {t('preview3D.title')}
          </button>
        )}
      </div>
      <div className="h-72 bg-white">
        {built.pieces ? (
          <TopPlanSheet pieces={built.pieces} profiles={PLAN_PREVIEW_PROFILES} isOrthogonal />
        ) : (
          <svg viewBox={polygonViewBox(plan.polygon)} className="h-full w-full">
            <polygon points={outline} fill="#e8eef5" stroke="#1d4ed8" strokeWidth={80} />
          </svg>
        )}
      </div>
      {built.error && (
        <p className="px-4 py-2 text-xs text-red-300 whitespace-pre-line">{built.error}</p>
      )}
      {open && built.pieces && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
          <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <span className="text-sm font-semibold text-neutral-900">
                {title} — {t('preview3D.title')}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                {t('preview3D.closeButton')}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <PergolaCutPieceViewer pieces={built.pieces} profiles={PLAN_PREVIEW_PROFILES} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
