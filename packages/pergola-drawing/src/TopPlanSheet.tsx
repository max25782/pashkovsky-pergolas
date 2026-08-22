'use client'

/**
 * Лист «План сверху» (промпт «технический чертёж перголы», п.2 из
 * согласованного порядка: «Лист «План сверху» с осевой размерной схемой»).
 *
 * ГЛАВНЫЙ ПРИНЦИП (см. промпт): чертёж строится ИСКЛЮЧИТЕЛЬНО из того же
 * `CutPiece[]`, что кормит 3D-вьюер и лист раскроя — этот компонент НЕ
 * читает редактор плана и не читает сцену Three.js, только props.pieces.
 * Контур полигона тоже не передаётся отдельно — он восстанавливается из
 * балок периметра, по той же причине: два независимых источника контура
 * разошлись бы.
 *
 * СТОРОНА КОНТУРА ≠ КУСОК БАЛКИ (см. переписку — «дважды приняли артефакт
 * презентации за баг расчёта»): `pieces` может содержать НЕСКОЛЬКО кусков
 * балки на одну сторону полигона (см. segmentBeamsForStock — балка длиннее
 * хлыста режется по стыку). Геометрическая сторона восстанавливается через
 * `groupBeamsIntoGeometricSides` — смежные, коллинеарные куски объединяются
 * обратно в одну сторону ЧИСТО по геометрии (смежность + направление), без
 * привязки к тому, сколько кусков балки физически лежит на ней и без
 * второго источника контура (никакого отдельного `spec.contour` пропа).
 * Раньше здесь считалось «одна сторона = один элемент массива beams», что
 * при сегментированной балке превращало один реальный стык в ДВЕ отдельные
 * цепочки corner→corner и рисовало стык как лишнюю фантомную размерную
 * секцию — см. groupBeamsIntoGeometricSides и buildAxialDimensionChainsFromEdges.
 *
 * ОСЕВАЯ РАЗМЕРНАЯ СХЕМА (см. переписку — исправлено после ревью):
 * цепочка размеров вдоль КАЖДОЙ стороны идёт не по двум концам балки, а по
 * ВСЕМ стойкам на этой стороне (край → промежуточная стойка → ... → край),
 * включая стойку от стыка сегментации — монтажнику нужны все опоры на
 * стороне, стык от сегментации визуально ничем не отличается от обычной
 * промежуточной стойки. См. buildAxialDimensionChainsFromEdges в
 * pergola-core (там же тест на промежуточные стойки). Здесь эта чистая
 * цепочка просто превращается в SVG: выносные линии от каждой точки цепочки
 * наружу за контур, размерная линия параллельно стороне, засечки/подписи
 * длины на каждом отрезке.
 *
 * КООРДИНАТНЫЙ СТЕК — тот же, что в редакторе плана (промпт «не заводить
 * второй координатный механизм»): worldToScreen/computeFitToScreenViewport
 * импортированы из @pashkovsky/plan-editor, не продублированы.
 *
 * ЧТО ПОКА НЕ РЕАЛИЗОВАНО (следующие пункты согласованного порядка):
 *   - размеры «в свету» (переключатель) — п.3
 *   - лист «Разрез» — п.4
 *   - «Раскладка ламелей» / «Схема стоек» — п.5
 *   - разнесение цепочек по уровням при перегрузке — п.6
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CutPiece, ProfileDimensions, Point2D } from '@pashkovsky/pergola-core'
import { pieceAxis, buildAxialDimensionChainsFromEdges } from '@pashkovsky/pergola-core'
import { computeFitToScreenViewport, worldToScreen } from '@pashkovsky/plan-editor'
import type { Viewport, Point, CanvasSize, WorldBounds } from '@pashkovsky/plan-editor'
import { beamFootprintCorners, postFootprintCorners } from './geometry/footprints'
import { outwardNormal, buildDimensionLineLayout } from './geometry/dimensionLayout'
import { groupBeamsIntoGeometricSides } from './geometry/beamRuns'
import { DimensionChainSvg } from './DimensionChainSvg'

export interface TopPlanSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  className?: string
  /**
   * Honest-degradation warning (see prompt "честная плашка для
   * неортогональных форм") — pass `false` (typically `frame.isOrthogonal`
   * from `computeFrame`, see `@pashkovsky/pergola-core`) together with
   * `nonOrthogonalWarningText` to show a banner above the plan: the post
   * placement/beam division for a non-orthogonal contour is only an
   * approximation (per-edge fallback, no shape-wide grid — see
   * `FrameResult.isOrthogonal`'s own docstring), and the user must be told
   * rather than silently trusting a possibly-misaligned drawing. `undefined`
   * (the default — e.g. an older caller that hasn't wired this through yet)
   * behaves exactly like `true`: no banner, unchanged from before this prop
   * existed. This package stays host-agnostic (no i18n dependency of its
   * own) — the caller supplies the already-translated text.
   */
  isOrthogonal?: boolean
  nonOrthogonalWarningText?: string
}

/** Насколько размерная линия отстоит от контура, мм — фиксированное значение для первой версии (см. «что пока не реализовано» — разнесение по уровням придёт позже, если размеров станет много на одной стороне). */
const DIMENSION_OFFSET_MM = 500
const MARGIN_RATIO = 0.18

function toPoint(p: Point2D): Point {
  return { x: p[0], y: p[1] }
}

function centroidOf(points: Point2D[]): Point2D {
  if (points.length === 0) return [0, 0]
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
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

export function TopPlanSheet({
  pieces,
  profiles,
  className,
  isOrthogonal,
  nonOrthogonalWarningText,
}: TopPlanSheetProps) {
  const showWarning = isOrthogonal === false && !!nonOrthogonalWarningText
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

  const beams = useMemo(() => pieces.filter((p) => p.role === 'beam'), [pieces])
  const posts = useMemo(() => pieces.filter((p) => p.role === 'post'), [pieces])
  const purlins = useMemo(() => pieces.filter((p) => p.role === 'purlin'), [pieces])
  const lamellas = useMemo(() => pieces.filter((p) => p.role === 'lamella'), [pieces])

  // Геометрические стороны контура — восстановлены из балок периметра
  // ЧИСТО геометрически (смежность + коллинеарность), а не «один элемент
  // массива beams = одна сторона»: после сегментации на одну сторону может
  // приходиться несколько кусков балки (см. заголовок файла). Контур для
  // отрисовки и осевые размерные цепочки строятся из ОДНОГО и того же
  // списка сторон — второго источника контура нет.
  const geometricSides = useMemo(() => groupBeamsIntoGeometricSides(beams), [beams])
  const contour = useMemo<Point2D[]>(() => geometricSides.map((s) => s.start), [geometricSides])
  const centroid = useMemo(() => centroidOf(contour), [contour])

  const chains = useMemo(
    () => buildAxialDimensionChainsFromEdges(geometricSides, posts),
    [geometricSides, posts],
  )
  const dimensionLayouts = useMemo(
    () =>
      chains.map((chain, i) => {
        const side = geometricSides[i]
        const outward = outwardNormal(side.start, side.end, centroid)
        return buildDimensionLineLayout(chain, outward, DIMENSION_OFFSET_MM)
      }),
    [chains, geometricSides, centroid],
  )

  const beamFootprints = useMemo(
    () =>
      beams.map((b) => ({ piece: b, corners: beamFootprintCorners(b, profiles.get(b.profileId) ?? { widthMm: 40, heightMm: 100 }) })),
    [beams, profiles],
  )
  const purlinFootprints = useMemo(
    () =>
      purlins.map((p) => ({ piece: p, corners: beamFootprintCorners(p, profiles.get(p.profileId) ?? { widthMm: 40, heightMm: 60 }) })),
    [purlins, profiles],
  )
  const postFootprints = useMemo(
    () =>
      posts.map((p) => ({ piece: p, corners: postFootprintCorners(p, profiles.get(p.profileId) ?? { widthMm: 80, heightMm: 80 }) })),
    [posts, profiles],
  )

  // Направление ламелей — берём у первой ламели (если есть), только для
  // индикатора-стрелки на плане; сама раскладка ламелей — отдельный лист
  // («Раскладка ламелей», п.5 порядка), здесь НЕ рисуем каждую ламель.
  const lamellaDirection = useMemo(() => {
    if (lamellas.length === 0) return null
    const { start, end } = pieceAxis(lamellas[0])
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const len = Math.hypot(dx, dy)
    return len > 1e-6 ? ([dx / len, dy / len] as Point2D) : null
  }, [lamellas])

  const worldBounds = useMemo<WorldBounds>(() => {
    const allPoints: Point2D[] = [
      ...beamFootprints.flatMap((f) => f.corners),
      ...postFootprints.flatMap((f) => f.corners),
      ...purlinFootprints.flatMap((f) => f.corners),
      ...dimensionLayouts.flatMap((l) => l.extensionLines.map((e) => e.to)),
    ]
    return boundsFromPoints(allPoints)
  }, [beamFootprints, postFootprints, purlinFootprints, dimensionLayouts])

  const viewport = useMemo(
    () => computeFitToScreenViewport(worldBounds, canvasPx.widthPx > 0 ? canvasPx : { widthPx: 800, heightPx: 600 }, MARGIN_RATIO),
    [worldBounds, canvasPx],
  )

  return (
    <div className="relative flex h-full w-full flex-col">
      {showWarning && (
        <div
          role="alert"
          className="shrink-0 border-b border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200"
        >
          ⚠️ {nonOrthogonalWarningText}
        </div>
      )}
      <svg
        ref={svgRef}
        className={className ?? 'h-full w-full flex-1'}
        style={{ background: '#ffffff', display: 'block' }}
      >
        <defs>
          <marker id="pergola-dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill="#1f2937" />
          </marker>
        </defs>

        {/* Контур (справочно) */}
        <polygon
          points={pointsToSvg(contour, viewport)}
          fill="none"
          stroke="#9ca3af"
          strokeDasharray="6 4"
          strokeWidth={1}
        />

        {/* Прогоны — под балками/ламелями по z-order отрисовки, светлее */}
        {purlinFootprints.map(({ piece, corners }) => (
          <polygon key={piece.id} points={pointsToSvg(corners, viewport)} fill="#fde68a" stroke="#b45309" strokeWidth={1} />
        ))}

        {/* Балки периметра */}
        {beamFootprints.map(({ piece, corners }) => (
          <polygon key={piece.id} points={pointsToSvg(corners, viewport)} fill="#cbd5e1" stroke="#1f2937" strokeWidth={1.5} />
        ))}

        {/* Стойки */}
        {postFootprints.map(({ piece, corners }) => (
          <polygon key={piece.id} points={pointsToSvg(corners, viewport)} fill="#4b5563" stroke="#111827" strokeWidth={1} />
        ))}

        {/* Индикатор направления ламелей */}
        {lamellaDirection && (
          <LamellaDirectionIndicator centroid={centroid} direction={lamellaDirection} viewport={viewport} />
        )}

        {/* Осевые размерные цепочки */}
        {dimensionLayouts.map((layout) => (
          <DimensionChainSvg key={layout.edgeIndex} layout={layout} viewport={viewport} />
        ))}
      </svg>
    </div>
  )
}

interface LamellaDirectionIndicatorProps {
  centroid: Point2D
  direction: Point2D
  viewport: Viewport
}

function LamellaDirectionIndicator({ centroid, direction, viewport }: LamellaDirectionIndicatorProps) {
  const arrowLengthMm = 800
  const from: Point2D = centroid
  const to: Point2D = [centroid[0] + direction[0] * arrowLengthMm, centroid[1] + direction[1] * arrowLengthMm]
  const sFrom = worldToScreen(toPoint(from), viewport)
  const sTo = worldToScreen(toPoint(to), viewport)
  return (
    <g>
      <line x1={sFrom.x} y1={sFrom.y} x2={sTo.x} y2={sTo.y} stroke="#2563eb" strokeWidth={2} markerEnd="url(#pergola-dim-arrow)" />
    </g>
  )
}

