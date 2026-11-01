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
import type { CutPiece, ProfileDimensions, Point2D, LamellaSection } from '@pashkovsky/pergola-core'
import { formatPurlinClearLabelMm, groupLamellaSectionTypes, lamellaSectionTypeById } from '@pashkovsky/pergola-core'
import { pieceAxis } from '@pashkovsky/pergola-core'
import { computeFitToScreenViewport, worldToScreen } from './viewport'
import type { Viewport, Point, CanvasSize, WorldBounds } from './viewport'
import { lamellaFootprintCorners } from './geometry/footprints'
import { buildDimensionLineLayout, type DimensionLineLayout } from './geometry/dimensionLayout'
import { groupLamellaRows, buildLamellaRhythm } from './geometry/lamellaRhythm'
import { DimensionChainSvg } from './DimensionChainSvg'

function sectionCorners(section: LamellaSection): Point2D[] {
  return section.trapezoid?.corners ?? [
    [section.minX, section.minY],
    [section.maxX, section.minY],
    [section.maxX, section.maxY],
    [section.minX, section.maxY],
  ]
}

function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][1]
    const yj = polygon[j][1]
    if ((yi > point[1]) === (yj > point[1])) continue
    const xi = polygon[i][0]
    const xj = polygon[j][0]
    const x = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    if (point[0] < x) inside = !inside
  }
  return inside
}

function outsideEdgePoint(a: Point2D, b: Point2D, interior: Point2D, offsetMm: number): Point2D {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  let nx = dy / len
  let ny = -dx / len
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  if (nx * (interior[0] - mx) + ny * (interior[1] - my) > 0) {
    nx = -nx
    ny = -ny
  }
  return [mx + nx * offsetMm, my + ny * offsetMm]
}

interface SectionDimensionLabel {
  key: string
  attr: 'data-layout-top' | 'data-layout-bottom' | 'data-layout-height'
  text: string
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
}

const LABEL_FONT_PX = 12
/** Approximate glyph width of a 12 px sans-serif digit, used only to detect collisions. */
const LABEL_GLYPH_PX = 6.6

function labelRect(label: SectionDimensionLabel) {
  const width = label.text.length * LABEL_GLYPH_PX
  const left = label.anchor === 'middle' ? label.x - width / 2 : label.anchor === 'end' ? label.x - width : label.x
  return { left, right: left + width, top: label.y - LABEL_FONT_PX / 2, bottom: label.y + LABEL_FONT_PX / 2 }
}

function rectsOverlap(a: ReturnType<typeof labelRect>, b: ReturnType<typeof labelRect>): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/**
 * Dimension labels of the trapezoid sections, placed outside the edge they measure. A label whose
 * spot falls inside another section is moved to the inside of its own section, and a label that
 * would still collide with one already placed is dropped: the full W/H list is on the sections page,
 * this sheet only has to show where each section sits and be readable.
 */
function buildSectionDimensionLabels(sections: LamellaSection[], viewport: Viewport): SectionDimensionLabel[] {
  const polygons = sections.map((section) => ({ id: section.id, corners: sectionCorners(section) }))
  const ordered = sections
    .filter((section) => section.trapezoid != null)
    .sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm)
  const placed: ReturnType<typeof labelRect>[] = []
  const labels: SectionDimensionLabel[] = []
  for (const section of ordered) {
    const trap = section.trapezoid!
    const corners = trap.corners
    const interior = corners.reduce<Point2D>(
      (sum, point) => [sum[0] + point[0] / corners.length, sum[1] + point[1] / corners.length],
      [0, 0],
    )
    const others = polygons.filter((other) => other.id !== section.id).map((other) => other.corners)
    const specs: { attr: SectionDimensionLabel['attr']; text: string; a: Point2D; b: Point2D; offset: number; anchor: SectionDimensionLabel['anchor'] }[] = [
      { attr: 'data-layout-top', text: formatPurlinClearLabelMm(trap.widthAtHighMm), a: corners[3], b: corners[2], offset: 260, anchor: 'middle' },
      { attr: 'data-layout-bottom', text: formatPurlinClearLabelMm(trap.widthAtLowMm), a: corners[0], b: corners[1], offset: 240, anchor: 'middle' },
      { attr: 'data-layout-height', text: formatPurlinClearLabelMm(section.heightMm), a: corners[1], b: corners[2], offset: 320, anchor: 'start' },
    ]
    for (const spec of specs) {
      // A triangle apex (width 0) has no edge to measure; "0.0" would only be noise.
      if (spec.text === formatPurlinClearLabelMm(0)) continue
      let world = outsideEdgePoint(spec.a, spec.b, interior, spec.offset)
      if (others.some((polygon) => pointInPolygon(world, polygon))) {
        world = outsideEdgePoint(spec.a, spec.b, interior, -spec.offset * 0.5)
      }
      const screen = worldToScreen(toPoint(world), viewport)
      const label: SectionDimensionLabel = { key: `${section.id}-${spec.attr}`, attr: spec.attr, text: spec.text, x: screen.x, y: screen.y, anchor: spec.anchor }
      const rect = labelRect(label)
      if (placed.some((other) => rectsOverlap(rect, other))) continue
      placed.push(rect)
      labels.push(label)
    }
  }
  return labels
}

export interface LamellaLayoutSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  lamellaOnEdge?: boolean
  /** Factory sections (version 1): one rectangle per cassette, no per-row labels. */
  sections?: LamellaSection[]
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

export function LamellaLayoutSheet({
  pieces,
  profiles,
  lamellaOnEdge = false,
  sections,
  className,
}: LamellaLayoutSheetProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [canvasPx, setCanvasPx] = useState<CanvasSize>({ widthPx: 0, heightPx: 0 })

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const parent = svg.parentElement?.getBoundingClientRect()
      const rect = svg.getBoundingClientRect()
      const widthPx = Math.max(rect.width, parent?.width ?? 0)
      const heightPx = Math.max(rect.height, parent?.height ?? 0)
      if (widthPx < 40 || heightPx < 40) return
      setCanvasPx((prev) => (
        prev.widthPx === widthPx && prev.heightPx === heightPx ? prev : { widthPx, heightPx }
      ))
    }
    measure()
    const raf = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    if (svg.parentElement) observer.observe(svg.parentElement)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  const lamellas = useMemo(() => pieces.filter((p) => p.role === 'lamella'), [pieces])
  const sectionTypeById = useMemo(
    () => lamellaSectionTypeById(groupLamellaSectionTypes(sections ?? [])),
    [sections],
  )

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
    if (sections && sections.length > 0) {
      return boundsFromPoints(sections.flatMap((s) => s.trapezoid?.corners ?? [
        [s.minX, s.minY],
        [s.maxX, s.minY],
        [s.maxX, s.maxY],
        [s.minX, s.maxY],
      ]))
    }
    const allPoints: Point2D[] = [
      ...footprints.flatMap((f) => f.corners),
      ...(pitchLayout?.extensionLines.map((e) => e.to) ?? []),
      ...gapMarkers.flatMap((g) => [g.from, g.to]),
    ]
    return boundsFromPoints(allPoints)
  }, [footprints, pitchLayout, gapMarkers, sections])

  const viewport = useMemo(
    () => computeFitToScreenViewport(worldBounds, canvasPx.widthPx > 0 ? canvasPx : { widthPx: 800, heightPx: 600 }, MARGIN_RATIO),
    [worldBounds, canvasPx],
  )

  const sectionDimensionLabels = useMemo(
    () => (sections && sections.length > 0 ? buildSectionDimensionLabels(sections, viewport) : []),
    [sections, viewport],
  )

  return (
    <svg
      ref={svgRef}
      className={className ?? 'h-full w-full'}
      style={{ background: '#ffffff', display: 'block', direction: 'ltr', unicodeBidi: 'isolate' }}
    >
      <defs>
        <marker id="pergola-dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 Z" fill="#1f2937" />
        </marker>
      </defs>

      {sections && sections.length > 0 ? (
        <>
          {sections.map((section) => (
            <polygon
              key={section.id}
              data-section-trapezoid={section.trapezoid ? '1' : undefined}
              points={pointsToSvg(sectionCorners(section), viewport)}
              fill="#e7e5e4"
              stroke="#44403c"
              strokeWidth={1.5}
            />
          ))}
          {/* Text goes after every polygon: a neighbouring section must never paint over a label. */}
          {sectionDimensionLabels.map((label) => (
            <text
              key={label.key}
              {...{ [label.attr]: label.text }}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              dominantBaseline="middle"
              fontSize={12}
              fontFamily="sans-serif"
              fill="#111827"
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {label.text}
            </text>
          ))}
          {sections.map((section) => {
            const screenCorners = sectionCorners(section).map((p) => worldToScreen(toPoint(p), viewport))
            const xs = screenCorners.map((p) => p.x)
            const ys = screenCorners.map((p) => p.y)
            const center = {
              x: screenCorners.reduce((sum, p) => sum + p.x, 0) / screenCorners.length,
              y: screenCorners.reduce((sum, p) => sum + p.y, 0) / screenCorners.length,
            }
            const box = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
            const fontSize = Math.max(16, Math.min(42, box * 0.42))
            return (
              <text
                key={`type-${section.id}`}
                x={center.x}
                y={center.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fontFamily="sans-serif"
                fontWeight={700}
                fill="#1c1917"
                stroke="#ffffff"
                strokeWidth={Math.max(3, fontSize * 0.12)}
                paintOrder="stroke"
              >
                {sectionTypeById.get(section.id) ?? ''}
              </text>
            )
          })}
        </>
      ) : (
      footprints.map(({ piece, corners }) => (
        <polygon key={piece.id} points={pointsToSvg(corners, viewport)} fill="#d6d3d1" stroke="#57534e" strokeWidth={1} />
      ))
      )}

      {!(sections && sections.length > 0) && gapMarkers.map((g) => {
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

      {!(sections && sections.length > 0) && pitchLayout && (
        <DimensionChainSvg layout={pitchLayout} viewport={viewport} />
      )}
    </svg>
  )
}
