'use client'

/**
 * Лист «Ячейка-рама с вычетами» (Вид А, промпт «рама-вистур и вычеты
 * размеров ламелей») — цеховой лист: показывает ОДНУ типовую ламель секции
 * с раскрытым вычетом длины (внутренняя грань-грань − 30мм суммарно).
 *
 * СКОУП ЭТОЙ ВЕРСИИ (см. уточнение в чате — «используй проём между
 * балками, без понятия проём между стойками»): показывает только
 * ДЛИННУЮ (осевую) сторону ячейки — расстояние по внутренним граням
 * периметровых балок, которое ядро уже вычитает (см. pergola-core
 * lamellas.ts VISTUR ASSEMBLY CLEARANCE). Поперечная сторона (проём между
 * стойками) НЕ показывается здесь: та ось режет не ламель, а СЕГМЕНТ
 * ПЕРИМЕТРОВОЙ БАЛКИ (см. итоговое уточнение — pergola-core
 * visturTolerances.ts "TWO AXES, TWO PARTS"), уже подключённый в
 * computeFrame; для него нужен отдельный лист по балкам/стойкам
 * («Схема стоек», см. pending), а не эта ламельная ячейка.
 *
 * Строится ИСКЛЮЧИТЕЛЬНО из props.pieces + явного lengthReductionTotalMm
 * (тот же параметр, который уже применил computeLamellas, а не повторный
 * пересчёт — см. TopPlanSheet.tsx «единый источник правды»).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CutPiece, ProfileDimensions, Point2D } from '@pashkovsky/pergola-core'
import { computeFitToScreenViewport, worldToScreen } from '@pashkovsky/plan-editor'
import type { Viewport, Point, CanvasSize, WorldBounds } from '@pashkovsky/plan-editor'
import { lamellaFootprintCorners } from './geometry/footprints'
import { buildDimensionLineLayout } from './geometry/dimensionLayout'
import { buildCellFrameGeometry, pickRepresentativeLamella } from './geometry/cellFrame'
import { DimensionChainSvg } from './DimensionChainSvg'

export interface CellFrameSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  lamellaOnEdge?: boolean
  /** Same PergolaSpec.visturTolerances?.lamellaLengthReductionMm the core already used to build these pieces — 0/undefined ⇒ no vistur clearance to show (raw === reduced). */
  lengthReductionTotalMm?: number
  className?: string
}

const MARGIN_RATIO = 0.25
const OUTER_OFFSET_MM = 350
const INNER_OFFSET_MM = 150

function toPoint(p: Point2D): Point {
  return { x: p[0], y: p[1] }
}
function pointsToSvg(points: Point2D[], vp: Viewport): string {
  return points.map((p) => { const s = worldToScreen(toPoint(p), vp); return `${s.x},${s.y}` }).join(' ')
}
function boundsFromPoints(points: Point2D[]): WorldBounds {
  if (points.length === 0) return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

export function CellFrameSheet({ pieces, profiles, lamellaOnEdge = false, lengthReductionTotalMm = 0, className }: CellFrameSheetProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [canvasPx, setCanvasPx] = useState<CanvasSize>({ widthPx: 0, heightPx: 0 })

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function measure() {
      const rect = svg!.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      setCanvasPx({ widthPx: rect.width, heightPx: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  const lamellas = useMemo(() => pieces.filter((p) => p.role === 'lamella'), [pieces])
  const representative = useMemo(() => pickRepresentativeLamella(lamellas), [lamellas])
  const profile = representative ? profiles.get(representative.profileId) : undefined

  const geo = useMemo(
    () => (representative ? buildCellFrameGeometry(representative, lengthReductionTotalMm) : null),
    [representative, lengthReductionTotalMm],
  )

  const footprint = useMemo(
    () => (representative ? lamellaFootprintCorners(representative, profile ?? { widthMm: 40, heightMm: 20 }, lamellaOnEdge) : null),
    [representative, profile, lamellaOnEdge],
  )

  const dir = useMemo<Point2D>(() => {
    if (!geo) return [1, 0]
    const dx = geo.reducedEnd[0] - geo.reducedStart[0]
    const dy = geo.reducedEnd[1] - geo.reducedStart[1]
    const l = Math.hypot(dx, dy)
    return l > 1e-9 ? [dx / l, dy / l] : [1, 0]
  }, [geo])
  const perp = useMemo<Point2D>(() => [-dir[1], dir[0]], [dir])

  const outerLayout = useMemo(() => {
    if (!geo) return null
    const chain = {
      edgeIndex: 0,
      beamId: 'cell-raw',
      points: [
        { distanceFromStartMm: 0, point: geo.rawStart, kind: 'corner' as const },
        { distanceFromStartMm: geo.rawOpeningMm, point: geo.rawEnd, kind: 'corner' as const },
      ],
      segmentsMm: [geo.rawOpeningMm],
    }
    return buildDimensionLineLayout(chain, perp, OUTER_OFFSET_MM)
  }, [geo, perp])

  const innerLayout = useMemo(() => {
    if (!geo) return null
    const chain = {
      edgeIndex: 0,
      beamId: 'cell-reduced',
      points: [
        { distanceFromStartMm: 0, point: geo.reducedStart, kind: 'corner' as const },
        { distanceFromStartMm: geo.reducedLengthMm, point: geo.reducedEnd, kind: 'corner' as const },
      ],
      segmentsMm: [geo.reducedLengthMm],
    }
    return buildDimensionLineLayout(chain, perp, INNER_OFFSET_MM)
  }, [geo, perp])

  const worldBounds = useMemo<WorldBounds>(() => {
    const points: Point2D[] = [
      ...(footprint ?? []),
      ...(outerLayout?.extensionLines.map((e) => e.to) ?? []),
    ]
    return boundsFromPoints(points)
  }, [footprint, outerLayout])

  const viewport = useMemo(
    () => computeFitToScreenViewport(worldBounds, canvasPx.widthPx > 0 ? canvasPx : { widthPx: 800, heightPx: 600 }, MARGIN_RATIO),
    [worldBounds, canvasPx],
  )

  return (
    <svg ref={svgRef} className={className ?? 'h-full w-full'} style={{ background: '#ffffff', display: 'block' }}>
      <defs>
        <marker id="pergola-dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 Z" fill="#1f2937" />
        </marker>
      </defs>

      {geo && (
        <polygon
          points={pointsToSvg([geo.rawStart, geo.rawEnd], viewport)}
          fill="none"
          stroke="#9ca3af"
          strokeDasharray="6 4"
          strokeWidth={1}
        />
      )}

      {footprint && (
        <polygon points={pointsToSvg(footprint, viewport)} fill="#d6d3d1" stroke="#57534e" strokeWidth={1.5} />
      )}

      {/* Вычет — короткие связки от края проёма до края уже урезанной ламели, по 15мм с каждой стороны */}
      {geo && geo.reductionPerEndMm > 0 && (
        <>
          <DeductionCallout from={geo.rawStart} to={geo.reducedStart} amountMm={geo.reductionPerEndMm} perp={perp} viewport={viewport} />
          <DeductionCallout from={geo.rawEnd} to={geo.reducedEnd} amountMm={geo.reductionPerEndMm} perp={perp} viewport={viewport} />
        </>
      )}

      {/* Проём в свету (габарит, до вычета) */}
      {outerLayout && <DimensionChainSvg layout={outerLayout} viewport={viewport} />}

      {/* Длина ламели (после вычета) — для цеха */}
      {innerLayout && <DimensionChainSvg layout={innerLayout} viewport={viewport} strokeColor="#b45309" extensionColor="#fcd34d" />}

      {representative && geo && (
        <text
          x={worldToScreen(toPoint([(geo.reducedStart[0] + geo.reducedEnd[0]) / 2, (geo.reducedStart[1] + geo.reducedEnd[1]) / 2]), viewport).x}
          y={worldToScreen(toPoint([(geo.reducedStart[0] + geo.reducedEnd[0]) / 2, (geo.reducedStart[1] + geo.reducedEnd[1]) / 2]), viewport).y}
          textAnchor="middle"
          fontSize={12}
          fontFamily="monospace"
          fill="#1f2937"
        >
          {representative.profileId} · {Math.round(geo.reducedLengthMm)}
        </text>
      )}
    </svg>
  )
}

interface DeductionCalloutProps {
  from: Point2D
  to: Point2D
  amountMm: number
  perp: Point2D
  viewport: Viewport
}

/** Небольшая подпись «-15» между краем проёма и краем уже урезанной ламели на одном конце. */
function DeductionCallout({ from, to, amountMm, perp, viewport }: DeductionCalloutProps) {
  const offsetMm = (INNER_OFFSET_MM + OUTER_OFFSET_MM) / 2
  const off: Point2D = [perp[0] * offsetMm, perp[1] * offsetMm]
  const fromOff: Point2D = [from[0] + off[0], from[1] + off[1]]
  const toOff: Point2D = [to[0] + off[0], to[1] + off[1]]
  const sFrom = worldToScreen(toPoint(fromOff), viewport)
  const sTo = worldToScreen(toPoint(toOff), viewport)
  const midX = (sFrom.x + sTo.x) / 2
  const midY = (sFrom.y + sTo.y) / 2
  return (
    <g>
      <line x1={sFrom.x} y1={sFrom.y} x2={sTo.x} y2={sTo.y} stroke="#dc2626" strokeWidth={1} markerStart="url(#pergola-dim-arrow)" markerEnd="url(#pergola-dim-arrow)" />
      <text x={midX} y={midY - 4} textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#dc2626">
        −{Math.round(amountMm)}
      </text>
    </g>
  )
}
