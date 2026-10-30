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
      const built = buildPiecesFromPlan(plan)
      return {
        pieces: built.pieces,
        roofWarning: built.roof.warning,
        warnings: built.warnings,
        error: null as string | null,
      }
    } catch (error) {
      return {
        pieces: null,
        roofWarning: null,
        warnings: [],
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
          <TopPlanSheet
            pieces={built.pieces}
            profiles={PLAN_PREVIEW_PROFILES}
            planContour={plan.polygon.map((p): [number, number] => [p.x, p.y])}
            constructionParams={plan.params}
            lamellaDirectionDeg={plan.params.lamellaDirectionDeg}
            isOrthogonal
            showPurlinLengthLegend={false}
            rowBoundaryLabel={t('drawing.rowBoundary')}
            lamellaDirectionLabel={t('drawing.lamellaDirection')}
          />
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
        <div className="border-t border-white/10">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold text-white">
              {title} — {t('preview3D.title')}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10"
            >
              {t('preview3D.closeButton')}
            </button>
          </div>
          {built.roofWarning && (
            <p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              {built.roofWarning}
            </p>
          )}
          {built.warnings.length > 0 && (
            <div className="whitespace-pre-line border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950">
              {t('preview3D.spanWarningTitle')}
              {built.warnings.slice(0, 4).map((warning) => (
                <div key={`${warning.pieceId}-${warning.spanStartMm}`}>
                  {t('preview3D.spanWarningLine', {
                    span: Math.round(warning.spanMm),
                    max: Math.round(warning.maxSpanMm),
                    start: warning.startDividerId ?? t('preview3D.contourEdge'),
                    end: warning.endDividerId ?? t('preview3D.contourEdge'),
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="h-80 bg-white">
            <PergolaCutPieceViewer
              pieces={built.pieces}
              profiles={PLAN_PREVIEW_PROFILES}
              colorHex={plan.params.colorHex}
            />
          </div>
        </div>
      )}
    </div>
  )
}
