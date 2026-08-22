'use client'

/**
 * Лист «Раскладка ламелей» (Вид Б, промпт «рама-вистур и вычеты размеров
 * ламелей» — «раскладка ламелей (как лежат)... виден ритм ламелей»).
 *
 * Строится ИСКЛЮЧИТЕЛЬНО из props.pieces (тот же CutPiece[], что кормит
 * 3D/раскрой — см. TopPlanSheet.tsx и project rule «чертёж не читает
 * редактор плана»). Показывает:
 *   - все ламели секции сверху, каждая — свой footprint (учитывает
 *     lamellaOnEdge — см. lamellaFootprintCorners);
 *   - просвет между соседними рядами, проставленный размером (короткая
 *     размерная связка у одного края, см. buildLamellaRhythm.gapMm);
 *   - осевой шаг между рядами (более крупная цепочка дальше за краем,
 *     см. buildLamellaRhythm.pitchMm) — общий «ритм», в т.ч. при
 *     смешанном узоре (70/40/20), где шаг между соседними рядами не
 *     постоянен.
 *
 * `lamellaOnEdge` — тот же булев параметр, что уже есть в
 * ConstructionParams на стороне вызывающего кода (CRM debug page); он НЕ
 * пересчитывается из геометрии (см. lamellaRhythm.ts почему это
 * невозможно однозначно) — тот же флаг, которым ядро уже пользовалось,
 * когда строило эти самые детали.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CutPiece, ProfileDimensions, Point2D } from '@pashkovsky/pergola-core'
import { pieceAxis } from '@pashkovsky/pergola-core'
import { computeFitToScreenViewport, worldToScreen } from '@pashkovsky/plan-editor'
import type { Viewport, Point, CanvasSize, WorldBounds } from '@pashkovsky/plan-editor'
import { lamellaFootprintCorners } from './geometry/footprints'
import { buildDimensionLineLayout, type DimensionLineLayout } from './geometry/dimensionLayout'
import { groupLamellaRows, buildLamellaRhythm } from './geometry/lamellaRhythm'
import { DimensionChainSvg } from './DimensionChainSvg'

export interface LamellaLayoutSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  lamellaOnEdge?: boolean
  className?: string
}

const MARGIN_RATIO = 0.18
/** How far beyond the nearest lamella end the reference measuring line sits, mm. */
const REFERENCE_MARGIN_MM = 300
/** How far the PITCH chain (outer, one number per row-to-row step) is pushed out beyond the reference line, mm. */
const PITCH_OFFSET_MM = 500
/** How far the GAP markers (inner, short, one per просвет) are pushed out beyond the reference line, mm — closer than the pitch chain so both stay readable without overlapping. */
const GAP_OFFSET_MM = 120

function toPoint(p: Point2D): Point {
  return { x: p[0], y: p[1] }
}
function add(a: Point2D, b: Point2D): Point2D {
  return [a[0] + b[0], a[1] + b[1]]
}
function scale(a: Point2D, s: number): Point2D {
  return [a[0] * s, a[1] * s]
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

export function LamellaLayoutSheet({ pieces, profiles, lamellaOnEdge = false, className }: LamellaLayoutSheetProps) {
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

  // Common run direction/perpendicular — every lamella in one pergola
  // shares the same azimuth (rotation.y), see lamellaRhythm.ts.
  const { dir, perp } = useMemo(() => {
    if (lamellas.length === 0) return { dir: [1, 0] as Point2D, perp: [0, 1] as Point2D }
    const theta = -lamellas[0].rotation[1]
    return { dir: [Math.cos(theta), Math.sin(theta)] as Point2D, perp: [-Math.sin(theta), Math.cos(theta)] as Point2D }
  }, [lamellas])

  const footprints = useMemo(
    () =>
      lamellas.map((piece) => ({
        piece,
        corners: lamellaFootprintCorners(piece, profiles.get(piece.profileId) ?? { widthMm: 40, heightMm: 20 }, lamellaOnEdge),
      })),
    [lamellas, profiles, lamellaOnEdge],
  )

  const rhythm = useMemo(() => buildLamellaRhythm(lamellas, profiles, lamellaOnEdge), [lamellas, profiles, lamellaOnEdge])

  // Reference measuring line: a fixed along-axis coordinate strictly
  // BEYOND every lamella's nearest end, so extension/gap/pitch lines never
  // cross a lamella footprint (see prompt "размерная линия не пересекает
  // деталь").
  const refAxisT = useMemo(() => {
    if (lamellas.length === 0) return 0
    const ts = lamellas.flatMap((p) => {
      const { start, end } = pieceAxis(p)
      return [start[0] * dir[0] + start[1] * dir[1], end[0] * dir[0] + end[1] * dir[1]]
    })
    return Math.min(...ts) - REFERENCE_MARGIN_MM
  }, [lamellas, dir])

  const pitchLayout = useMemo<DimensionLineLayout | null>(() => {
    if (rhythm.rows.length < 2) return null
    const points = rhythm.rows.map((row) => ({
      distanceFromStartMm: row.scanCoordinateMm - rhythm.rows[0].scanCoordinateMm,
      point: add(scale(dir, refAxisT), scale(perp, row.scanCoordinateMm)),
      kind: 'post' as const,
    }))
    const segmentsMm = points.slice(1).map((p, i) => p.distanceFromStartMm - points[i].distanceFromStartMm)
    const outward: Point2D = [-dir[0], -dir[1]]
    return buildDimensionLineLayout({ edgeIndex: 0, beamId: 'lamella-rhythm', points, segmentsMm }, outward, PITCH_OFFSET_MM)
  }, [rhythm, dir, perp, refAxisT])

  const gapMarkers = useMemo(
    () =>
      rhythm.segments.map((seg, i) => {
        const rowA = rhythm.rows[i]
        const rowB = rhythm.rows[i + 1]
        const profileA = profiles.get(rowA.profileId)
        const profileB = profiles.get(rowB.profileId)
        const widthA = profileA ? (lamellaOnEdge ? profileA.heightMm : profileA.widthMm) : 0
        const widthB = profileB ? (lamellaOnEdge ? profileB.heightMm : profileB.widthMm) : 0
        const gapStart = rowA.scanCoordinateMm + widthA / 2
        const gapEnd = rowB.scanCoordinateMm - widthB / 2
        const outward = scale(dir, -GAP_OFFSET_MM)
        const from = add(add(scale(dir, refAxisT), scale(perp, gapStart)), outward)
        const to = add(add(scale(dir, refAxisT), scale(perp, gapEnd)), outward)
        return { key: `gap-${i}`, from, to, gapMm: seg.gapMm }
      }),
    [rhythm, profiles, lamellaOnEdge, dir, perp, refAxisT],
  )

  const worldBounds = useMemo<WorldBounds>(() => {
    const allPoints: Point2D[] = [
      ...footprints.flatMap((f) => f.corners),
      ...(pitchLayout?.extensionLines.map((e) => e.to) ?? []),
      ...gapMarkers.flatMap((g) => [g.from, g.to]),
    ]
    return boundsFromPoints(allPoints)
  }, [footprints, pitchLayout, gapMarkers])

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

      {/* Ламели */}
      {footprints.map(({ piece, corners }) => (
        <polygon key={piece.id} points={pointsToSvg(corners, viewport)} fill="#d6d3d1" stroke="#57534e" strokeWidth={1} />
      ))}

      {/* Просвет между соседними рядами — короткая размерная связка ближе к деталям */}
      {gapMarkers.map((g) => {
        const from = worldToScreen(toPoint(g.from), viewport)
        const to = worldToScreen(toPoint(g.to), viewport)
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2
        return (
          <g key={g.key}>
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="#2563eb" strokeWidth={1}
              markerStart="url(#pergola-dim-arrow)" markerEnd="url(#pergola-dim-arrow)"
            />
            <text x={midX} y={midY - 6} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#2563eb">
              {Math.round(g.gapMm)}
            </text>
          </g>
        )
      })}

      {/* Осевой шаг между рядами — цепочка дальше за краем */}
      {pitchLayout && <DimensionChainSvg layout={pitchLayout} viewport={viewport} />}
    </svg>
  )
}
