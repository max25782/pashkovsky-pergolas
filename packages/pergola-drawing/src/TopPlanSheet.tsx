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
 * РАЗМЕРЫ ПЕРИМЕТРА (см. Max / topPlanDimensions.ts): по одной размерной
 * линии на геометрическую сторону, снаружи контура, длина = внешняя грань
 * рамы от угла до угла (без разбиения по стойкам/стыкам). Углы — дуга и
 * внутренний угол в градусах. Поперечки — цепочка просветов вдоль оси
 * ламелей (buildPurlinClearDimensionChain). Генератор один в pergola-core.
 *
 * КООРДИНАТНЫЙ СТЕК — тот же, что в редакторе плана (промпт «не заводить
 * второй координатный механизм»): worldToScreen/computeFitToScreenViewport
 * импортированы из ./viewport, не продублированы.
 *
 * ЧТО ПОКА НЕ РЕАЛИЗОВАНО (следующие пункты согласованного порядка):
 *   - размеры «в свету» (переключатель) — п.3
 *   - лист «Разрез» — п.4
 *   - «Раскладка ламелей» / «Схема стоек» — п.5
 *   - разнесение цепочек по уровням при перегрузке — п.6
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CutPiece, LamellaSection, ProfileDimensions, Point2D, PlanConstructionParams } from '@pashkovsky/pergola-core'
import {
  pieceAxis,
  buildTopPlanDimensionModel,
  buildVertexInteriorAngles,
  contourEdgeOutward,
  groupLamellaSectionTypes,
  lamellaSectionTypeById,
  matchContourEdgeIndex,
  wallEdgeIndicesInFrameOrder,
  resolvePlanPurlinLines,
  WING_SHELF_SPAN_DIVIDER_ID,
  wingShelfFlushBandMm,
  formatPurlinClearLabelMm,
  contourSideWidthMm,
  lamellaRunEndWidthsMm,
} from '@pashkovsky/pergola-core'
import { computeFitToScreenViewport, worldToScreen } from './viewport'
import type { Viewport, Point, CanvasSize, WorldBounds } from './viewport'
import { beamFootprintCorners, postFootprintCorners } from './geometry/footprints'
import { outwardNormal, buildDimensionLineLayout } from './geometry/dimensionLayout'
import { beamSplicePoints, groupBeamsIntoGeometricSides } from './geometry/beamRuns'
import { DimensionChainSvg } from './DimensionChainSvg'
import { InteriorAngleSvg } from './InteriorAngleSvg'
import { angleLabelClearPoint, angleLabelWorldPoint } from './planDimensionsSvg'
import { placeSectionLetters } from './sectionLetters'
import { labelBox, separateLabels, type ScreenLabel, type ScreenSegment } from './planLabelClearance'

export interface TopPlanSheetProps {
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  /** When set, enables purlin clear-span dimension chain (same contour as buildPieces). */
  planContour?: Point2D[]
  lamellaDirectionDeg?: number
  constructionParams?: PlanConstructionParams
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
  /**
   * Extra honest-degradation lines (e.g. invalid supportBeams kept on the plan
   * but not applied). Shown under / instead of the non-orthogonal banner.
   */
  extraWarningTexts?: string[]
  /** Same factory cells as the lamella sheet. Letters only; sizes stay on the sections tab. */
  sections?: LamellaSection[]
  /** Legend title for grouped purlin clear lengths. Host supplies the translated string. */
  purlinLengthLegendTitle?: string
  /** Edges drawn as walls. Empty means every side is an open frame beam. */
  wallEdgeIndices?: number[]
  /** Short mark for beam n (1-based), e.g. "Б1". */
  beamMark?: (index: number) => string
  /** Font that can draw the active language, including Hebrew. */
  labelFontFamily?: string
  /** The production PDF prints one legend at the end, not on the plan. */
  showPurlinLengthLegend?: boolean
  /** Dashed note where two row bands meet and there is no beam. Pass the active locale. */
  rowBoundaryLabel?: string
  /** Caption for the lamella-run arrow. Without it the arrow is not drawn. */
  lamellaDirectionLabel?: string
}

/** Насколько размерная линия отстоит от контура, мм — фиксированное значение для первой версии (см. «что пока не реализовано» — разнесение по уровням придёт позже, если размеров станет много на одной стороне). */
const DIMENSION_OFFSET_MM = 500
const MARGIN_RATIO = 0.04
/** Print slot is 223×194 mm. This viewBox has the same aspect, so the drawing fills the sheet. */
const PRINT_SHEET_PX = { widthPx: 1115, heightPx: 970 }
const PRINT_SLOT_MM = { widthMm: 223, heightMm: 194 }

function toPoint(p: Point2D): Point {
  return { x: p[0], y: p[1] }
}

function beamEdgeIndex(id: string): number | null {
  const match = /^beam-(\d+)/.exec(id)
  return match ? Number(match[1]) : null
}

function centroidOf(points: Point2D[]): Point2D {
  if (points.length === 0) return [0, 0]
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

function pointsToSvg(points: Point2D[], vp: Viewport): string {
  return points.map((p) => { const s = worldToScreen(toPoint(p), vp); return `${s.x},${s.y}` }).join(' ')
}

function purlinSummaryShift(
  layout: { segments: Array<{ fromPoint: Point2D; fromOffsetPoint: Point2D }> },
  viewport: Viewport,
): { dx: number; dy: number } | undefined {
  const segment = layout.segments[0]
  if (!segment) return undefined
  const from = worldToScreen(toPoint(segment.fromPoint), viewport)
  const to = worldToScreen(toPoint(segment.fromOffsetPoint), viewport)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { dx: (dx / len) * 22, dy: (dy / len) * 22 }
}

function pastEnd(from: Point2D, to: Point2D, extraMm: number): Point2D {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  return [to[0] + (dx / len) * extraMm, to[1] + (dy / len) * extraMm]
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
  planContour,
  lamellaDirectionDeg = 0,
  constructionParams,
  className,
  isOrthogonal,
  nonOrthogonalWarningText,
  extraWarningTexts,
  sections,
  purlinLengthLegendTitle = 'Purlins',
  wallEdgeIndices = [],
  beamMark = (index) => `B${index}`,
  labelFontFamily = 'sans-serif',
  showPurlinLengthLegend = true,
  rowBoundaryLabel = 'row boundary (not a beam)',
  lamellaDirectionLabel,
}: TopPlanSheetProps) {
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
  const sectionTypeById = useMemo(
    () => lamellaSectionTypeById(groupLamellaSectionTypes(sections ?? [])),
    [sections],
  )

  // Геометрические стороны контура — восстановлены из балок периметра
  // ЧИСТО геометрически (смежность + коллинеарность), а не «один элемент
  // массива beams = одна сторона»: после сегментации на одну сторону может
  // приходиться несколько кусков балки (см. заголовок файла). Контур для
  // отрисовки и осевые размерные цепочки строятся из ОДНОГО и того же
  // списка сторон — второго источника контура нет.
  const geometricSides = useMemo(() => groupBeamsIntoGeometricSides(beams), [beams])
  const contour = useMemo<Point2D[]>(() => geometricSides.map((s) => s.start), [geometricSides])
  const purlinEndsBounded = useMemo(
    () => purlinEndsMeetFrame(pieces, planContour && planContour.length >= 3 ? planContour : contour),
    [pieces, planContour, contour],
  )
  // Beam ids (`beam-<k>`) count edges of the frame's counter-clockwise copy, while
  // `wallEdgeIndices` are in the plan's own order: translate before comparing.
  const wallBeamEdges = useMemo(
    () =>
      planContour && planContour.length >= 3
        ? wallEdgeIndicesInFrameOrder(planContour, wallEdgeIndices)
        : wallEdgeIndices,
    [planContour, wallEdgeIndices],
  )
  const showWarning = isOrthogonal === false && !!nonOrthogonalWarningText && !purlinEndsBounded
  const extraWarnings = (extraWarningTexts ?? []).filter((line) => line.trim().length > 0)
  const centroid = useMemo(() => centroidOf(contour), [contour])

  const dividerPositions = useMemo(() => {
    if (!planContour || planContour.length < 3 || !constructionParams) return []
    return resolvePlanPurlinLines(planContour, constructionParams, profiles, wallEdgeIndices)
  }, [planContour, constructionParams, profiles, wallEdgeIndices])

  const dimensionModel = useMemo(() => {
    const beamProfileId = constructionParams?.beamProfileId ?? beams[0]?.profileId
    if (!beamProfileId || geometricSides.length === 0) {
      return {
        perimeterChains: [],
        purlinClearChain: null,
        purlinClearVerification: null,
        purlinClearDisplaySummary: null,
        vertexAngles: buildVertexInteriorAngles(contour),
        angleClosureWarning: null,
      }
    }
    const contourForSpans =
      planContour && planContour.length >= 3 ? planContour : contour
    const perSide = constructionParams?.wallBeamWidthVersion === 1
    const sideInput = {
      wallEdgeIndices,
      beamProfileId,
      wallProfileId: constructionParams?.wallProfileId,
      wallBeamWidthVersion: constructionParams?.wallBeamWidthVersion,
    }
    const endWidths = perSide
      ? lamellaRunEndWidthsMm(contourForSpans, lamellaDirectionDeg, profiles, sideInput)
      : null
    return buildTopPlanDimensionModel({
      geometricSides,
      beams,
      profiles,
      beamProfileId,
      centroid,
      contourVertices: contourForSpans,
      lamellaDirectionDeg,
      dividerPositions,
      purlinDividerMode: constructionParams?.purlinDividers?.mode,
      measuredOuterLengthMmByEdgeIndex: constructionParams?.measuredOuterLengthMmByEdgeIndex,
      purlinClearLayoutVersion: constructionParams?.purlinClearLayoutVersion,
      ...(endWidths
        ? {
            leftEndWidthMm: endWidths.leftMm,
            rightEndWidthMm: endWidths.rightMm,
            planWidthForContourEdge: (edgeIndex: number) => contourSideWidthMm(profiles, edgeIndex, sideInput),
          }
        : {}),
    })
  }, [
    geometricSides,
    beams,
    profiles,
    constructionParams?.beamProfileId,
    constructionParams?.wallProfileId,
    constructionParams?.wallBeamWidthVersion,
    constructionParams?.measuredOuterLengthMmByEdgeIndex,
    constructionParams?.purlinDividers?.mode,
    constructionParams?.purlinClearLayoutVersion,
    centroid,
    contour,
    planContour,
    lamellaDirectionDeg,
    dividerPositions,
    wallEdgeIndices,
  ])

  const perimeterLayouts = useMemo(
    () =>
      dimensionModel.perimeterChains.map((chain, i) => {
        const side = geometricSides[i]
        const contourForSide = planContour && planContour.length >= 3 ? planContour : contour
        const edgeIndex = matchContourEdgeIndex(side, contourForSide)
        const outward = edgeIndex >= 0
          ? contourEdgeOutward(contourForSide, edgeIndex)
          : outwardNormal(side.start, side.end, centroid)
        return buildDimensionLineLayout(chain, outward, DIMENSION_OFFSET_MM)
      }),
    [dimensionModel.perimeterChains, geometricSides, centroid, planContour, contour],
  )

  const purlinClearLayout = useMemo(() => {
    const chain = dimensionModel.purlinClearChain
    if (!chain || chain.points.length === 0) return null
    let sx = 0
    let sy = 0
    for (const point of chain.points) {
      sx += point.point[0]
      sy += point.point[1]
    }
    const first = chain.points[0].point
    const last = chain.points[chain.points.length - 1].point
    const away = outwardNormal(first, last, centroid)
    return buildDimensionLineLayout(chain, away, DIMENSION_OFFSET_MM * 2.2)
  }, [dimensionModel.purlinClearChain, centroid])

  const purlinLengthGroups = useMemo(() => {
    const groups = new Map<string, { lengthMm: number; count: number }>()
    for (const piece of purlins) {
      const lengthMm = Math.round(piece.lengthAxisMm * 10) / 10
      const key = lengthMm.toFixed(1)
      const existing = groups.get(key)
      if (existing) existing.count += 1
      else groups.set(key, { lengthMm, count: 1 })
    }
    return [...groups.values()].sort((a, b) => b.lengthMm - a.lengthMm)
  }, [purlins])

  const beamFootprints = useMemo(
    () =>
      beams.map((b) => ({ piece: b, corners: beamFootprintCorners(b, profiles.get(b.profileId) ?? { widthMm: 40, heightMm: 100 }) })),
    [beams, profiles],
  )
  const shelfBandMm = useMemo(
    () => wingShelfFlushBandMm(
      profiles,
      constructionParams?.beamProfileId ?? '',
      constructionParams?.wallProfileId,
      constructionParams?.wallBeamWidthVersion,
    ),
    [profiles, constructionParams?.beamProfileId, constructionParams?.wallProfileId, constructionParams?.wallBeamWidthVersion],
  )
  const purlinFootprints = useMemo(
    () =>
      purlins.map((p) => {
        const profile = profiles.get(p.profileId) ?? { widthMm: 40, heightMm: 60 }
        const drawn = p.dividerId === WING_SHELF_SPAN_DIVIDER_ID && shelfBandMm != null
          ? { ...profile, widthMm: shelfBandMm }
          : profile
        return { piece: p, corners: beamFootprintCorners(p, drawn) }
      }),
    [purlins, profiles, shelfBandMm],
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
      ...perimeterLayouts.flatMap((l) => l.extensionLines.flatMap((e) => [e.to, pastEnd(e.from, e.to, 900)])),
      ...(purlinClearLayout?.extensionLines.flatMap((e) => [e.to, pastEnd(e.from, e.to, 900)]) ?? []),
      ...dimensionModel.vertexAngles.map((entry) => {
        const n = contour.length
        const prev = contour[(entry.vertexIndex + n - 1) % n]
        const next = contour[(entry.vertexIndex + 1) % n]
        return angleLabelWorldPoint(entry.vertex, prev, next, centroid)
      }),
    ]
    return boundsFromPoints(allPoints)
  }, [beamFootprints, postFootprints, purlinFootprints, perimeterLayouts, purlinClearLayout, dimensionModel.vertexAngles, contour, centroid])

  const sheetPx = canvasPx.widthPx > 0 ? canvasPx : PRINT_SHEET_PX
  const viewport = useMemo(
    () => computeFitToScreenViewport(worldBounds, sheetPx, MARGIN_RATIO),
    [worldBounds, sheetPx],
  )

  const placed = useMemo(() => {
    const labels: ScreenLabel[] = []
    const lines: ScreenSegment[] = []
    const miterText = new Map<string, string>()
    geometricSides.forEach((side, index) => {
      const start = worldToScreen({ x: side.start[0], y: side.start[1] }, viewport)
      const end = worldToScreen({ x: side.end[0], y: side.end[1] }, viewport)
      const dx = end.x - start.x
      const dy = end.y - start.y
      const len = Math.hypot(dx, dy) || 1
      const slide = { x: dx / len, y: dy / len }
      const along = Math.min(96, Math.max(36, len * 0.22))
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      labels.push({
        id: `beam-circle-${index}`,
        x: mid.x + slide.x * along,
        y: mid.y + slide.y * along,
        w: 30,
        h: 30,
        nudge: slide,
        slide,
        slideFrom: start,
        slideTo: end,
      })
      const cap = 28
      lines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, ownerId: `beam-circle-${index}` })
      lines.push({ x1: start.x, y1: start.y, x2: start.x + slide.x * cap, y2: start.y + slide.y * cap, ownerId: `beam-circle-${index}` })
      lines.push({ x1: end.x, y1: end.y, x2: end.x - slide.x * cap, y2: end.y - slide.y * cap, ownerId: `beam-circle-${index}` })
    })
    const count = contour.length
    const center = worldToScreen({ x: centroid[0], y: centroid[1] }, viewport)
    for (const entry of dimensionModel.vertexAngles) {
      const prev = contour[(entry.vertexIndex + count - 1) % count]
      const next = contour[(entry.vertexIndex + 1) % count]
      const world = angleLabelClearPoint(entry.vertex, prev, next, centroid, [])
      const screen = worldToScreen({ x: world[0], y: world[1] }, viewport)
      const nx = center.x - screen.x
      const ny = center.y - screen.y
      const len = Math.hypot(nx, ny) || 1
      const leadX = world[0] - entry.vertex[0]
      const leadY = world[1] - entry.vertex[1]
      const leadLen = Math.hypot(leadX, leadY) || 1
      const leaderWorld: Point2D = [
        entry.vertex[0] + (leadX / leadLen) * 360,
        entry.vertex[1] + (leadY / leadLen) * 360,
      ]
      const leader = worldToScreen({ x: leaderWorld[0], y: leaderWorld[1] }, viewport)
      const box = labelBox(screen.x, screen.y, `${entry.interiorAngleDeg.toFixed(1)}°`, 14, `angle-${entry.vertexIndex}`, { x: nx / len, y: ny / len })
      labels.push({ ...box, leaderTo: { x: leader.x, y: leader.y }, origin: { x: screen.x, y: screen.y } })
    }
    const pushChain = (
      layout: { segments: Array<{ fromPoint: Point2D; fromOffsetPoint: Point2D; toOffsetPoint: Point2D; labelAnchor: Point2D; lengthMm: number }>; extensionLines: Array<{ from: Point2D; to: Point2D }> },
      prefix: string,
      summary: string | null,
    ) => {
      if (summary) {
        const first = layout.segments[0]
        const last = layout.segments[layout.segments.length - 1]
        if (first && last) {
          const a = worldToScreen({ x: first.labelAnchor[0], y: first.labelAnchor[1] }, viewport)
          const b = worldToScreen({ x: last.labelAnchor[0], y: last.labelAnchor[1] }, viewport)
          const from = worldToScreen({ x: first.fromPoint[0], y: first.fromPoint[1] }, viewport)
          const off = worldToScreen({ x: first.fromOffsetPoint[0], y: first.fromOffsetPoint[1] }, viewport)
          const nx = off.x - from.x
          const ny = off.y - from.y
          const len = Math.hypot(nx, ny) || 1
          labels.push(labelBox((a.x + b.x) / 2 + (nx / len) * 28, (a.y + b.y) / 2 + (ny / len) * 28, summary, 17, `${prefix}-summary`, { x: nx / len, y: ny / len }))
        }
      }
      layout.segments.forEach((segment, index) => {
        const from = worldToScreen({ x: segment.fromOffsetPoint[0], y: segment.fromOffsetPoint[1] }, viewport)
        const to = worldToScreen({ x: segment.toOffsetPoint[0], y: segment.toOffsetPoint[1] }, viewport)
        const id = `${prefix}-${index}`
        lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, ownerId: summary ? undefined : id })
        if (!summary) {
          const anchor = worldToScreen({ x: segment.labelAnchor[0], y: segment.labelAnchor[1] }, viewport)
          const origin = worldToScreen({ x: segment.fromPoint[0], y: segment.fromPoint[1] }, viewport)
          const nx = from.x - origin.x
          const ny = from.y - origin.y
          const len = Math.hypot(nx, ny) || 1
          labels.push(labelBox(anchor.x + (nx / len) * 20, anchor.y + (ny / len) * 20, formatPurlinClearLabelMm(segment.lengthMm), 16, id, { x: nx / len, y: ny / len }))
        }
      })
      for (const line of layout.extensionLines) {
        const from = worldToScreen({ x: line.from[0], y: line.from[1] }, viewport)
        const to = worldToScreen({ x: line.to[0], y: line.to[1] }, viewport)
        lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })
      }
    }
    perimeterLayouts.forEach((layout, index) => pushChain(layout, `dim-${index}`, null))
    if (purlinClearLayout) {
      const summary = dimensionModel.purlinClearDisplaySummary
      const summaryText = summary
        ? `${summary.sectionCount}×${summary.sectionClearLabel ?? formatPurlinClearLabelMm(summary.sectionClearMm)}`
        : null
      pushChain(purlinClearLayout, 'clear', summaryText)
    }
    for (const label of purlinMiterLabels(purlins)) {
      const tip = worldToScreen({ x: label.tip[0], y: label.tip[1] }, viewport)
      const piece = purlins.find((item) => label.key.startsWith(item.id))
      const axis = piece ? pieceAxis(piece) : null
      const along = axis
        ? worldToScreen(
            { x: axis.end[0] - axis.start[0], y: axis.end[1] - axis.start[1] },
            { scale: viewport.scale, panX: 0, panY: 0 },
          )
        : { x: 0, y: -1 }
      const alen = Math.hypot(along.x, along.y) || 1
      const ux = along.x / alen
      const uy = along.y / alen
      const inward = label.key.endsWith('-e') ? -1 : 1
      const px = -uy * inward
      const py = ux * inward
      const center = worldToScreen({ x: centroid[0], y: centroid[1] }, viewport)
      const towardCenter = (center.x - tip.x) * px + (center.y - tip.y) * py
      const side = towardCenter >= 0 ? 1 : -1
      const x = tip.x + ux * inward * 22 + px * side * 34
      const y = tip.y + uy * inward * 22 + py * side * 34
      miterText.set(label.key, label.text)
      const box = labelBox(x, y, label.text, 14, `miter-${label.key}`, { x: px * side, y: py * side })
      labels.push({ ...box, origin: { x, y }, leaderTo: { x: tip.x, y: tip.y } })
    }
    for (const piece of purlins) {
      if (piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID) continue
      const { start, end } = pieceAxis(piece)
      const screenStart = worldToScreen({ x: start[0], y: start[1] }, viewport)
      const screenEnd = worldToScreen({ x: end[0], y: end[1] }, viewport)
      const dx = screenEnd.x - screenStart.x
      const dy = screenEnd.y - screenStart.y
      const len = Math.hypot(dx, dy) || 1
      const perp = { x: -dy / len, y: dx / len }
      const mid = { x: (screenStart.x + screenEnd.x) / 2, y: (screenStart.y + screenEnd.y) / 2 }
      const center = worldToScreen({ x: centroid[0], y: centroid[1] }, viewport)
      const inward = (center.x - mid.x) * perp.x + (center.y - mid.y) * perp.y
      const sign = inward > 0 ? -1 : 1
      const gap = 30
      const text = shelfLengthText(piece)
      const box = labelBox(mid.x + perp.x * sign * gap, mid.y + perp.y * sign * gap, text, 16, `shelf-${piece.id}`, { x: perp.x * sign, y: perp.y * sign }, true)
      labels.push(box)
      lines.push({ x1: screenStart.x, y1: screenStart.y, x2: screenEnd.x, y2: screenEnd.y, ownerId: box.id })
    }
    if (lamellaDirection && lamellaDirectionLabel) {
      const tip: Point2D = [
        centroid[0] + lamellaDirection[0] * 800,
        centroid[1] + lamellaDirection[1] * 800,
      ]
      const screen = worldToScreen({ x: tip[0], y: tip[1] }, viewport)
      const perp = worldToScreen(
        { x: -lamellaDirection[1], y: -lamellaDirection[0] },
        { scale: viewport.scale, panX: 0, panY: 0 },
      )
      const plen = Math.hypot(perp.x, perp.y) || 1
      labels.push(labelBox(screen.x + (perp.x / plen) * 22, screen.y + (perp.y / plen) * 22, lamellaDirectionLabel, 14, 'lamella-dir', { x: perp.x / plen, y: perp.y / plen }, true))
    }
    const separated = separateLabels(labels, lines)
    const letterCells = sectionLetterCells(sections ?? [], viewport).filter((cell) => sectionTypeById.get(cell.id))
    const letterFont = (cell: { right: number; left: number; bottom: number; top: number }) => {
      const box = Math.min(cell.right - cell.left, cell.bottom - cell.top)
      return box < 46 ? Math.max(14, Math.min(16, box * 0.45)) : Math.max(16, Math.min(28, box * 0.36))
    }
    const letters = placeSectionLetters(
      letterCells,
      separated.map((label) => ({ x: label.x, y: label.y, halfW: label.w / 2, halfH: label.h / 2 })),
      letterFont,
      worldToScreen({ x: centroid[0], y: centroid[1] }, viewport),
    ).map((letter) => {
      const cell = letterCells.find((item) => item.id === letter.id)
      const font = cell ? letterFont(cell) : 16
      const text = sectionTypeById.get(letter.id) ?? ''
      return { ...letter, text, font }
    })
    const withLetters: ScreenLabel[] = [
      ...separated,
      ...letters.map((letter) => labelBox(letter.x, letter.y, letter.text || 'A', letter.font, `letter-${letter.id}`, { x: 0, y: -1 }, true)),
    ]
    const settled = separateLabels(withLetters, lines)
    return {
      byId: new Map(settled.map((label) => [label.id, label])),
      miterText,
      letters: letters.map((letter) => {
        const moved = settled.find((label) => label.id === `letter-${letter.id}`)
        return moved ? { ...letter, x: moved.x, y: moved.y } : letter
      }),
    }
  }, [geometricSides, contour, centroid, dimensionModel.vertexAngles, dimensionModel.purlinClearDisplaySummary, perimeterLayouts, purlinClearLayout, viewport, purlins, sections, sectionTypeById, lamellaDirection, lamellaDirectionLabel])
  const placedLabels = placed.byId

  return (
    <div className="relative flex h-full w-full flex-col">
      {dimensionModel.angleClosureWarning && (
        <div role="alert" className="shrink-0 border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900">
          {dimensionModel.angleClosureWarning}
        </div>
      )}
      {showWarning && (
        <div
          role="alert"
          className="shrink-0 border-b border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200"
        >
          ⚠️ {nonOrthogonalWarningText}
        </div>
      )}
      {extraWarnings.length > 0 && (
        <div
          role="alert"
          data-testid="support-beam-plan-warnings"
          className="shrink-0 whitespace-pre-line border-b border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200"
        >
          {extraWarnings.map((line, i) => (
            <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
          ))}
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${sheetPx.widthPx} ${sheetPx.heightPx}`}
        preserveAspectRatio="xMidYMid meet"
        className={className ?? 'h-full w-full flex-1'}
        style={{ background: '#ffffff', display: 'block', direction: 'ltr' }}
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
        {labeledRowBoundaries(sections ?? []).map((band) => {
          const a = worldToScreen({ x: band.x0, y: band.y }, viewport)
          const b = worldToScreen({ x: band.x1, y: band.y }, viewport)
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 16 }
          return (
            <g key={`row-boundary-${band.y.toFixed(1)}`} data-row-boundary="1">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#6b7280" strokeWidth={1} strokeDasharray="7 5" />
              {band.label ? (
                <text data-row-boundary="1" x={mid.x} y={mid.y} textAnchor="middle" fontSize={14} fontFamily={labelFontFamily} fill="#4b5563">
                  {rowBoundaryLabel}
                </text>
              ) : null}
            </g>
          )
        })}

        {/* Прогоны — под балками/ламелями по z-order отрисовки, светлее */}
        {purlinFootprints.map(({ piece, corners }) => (
          <polygon key={piece.id} points={pointsToSvg(corners, viewport)} fill="#fde68a" stroke="#b45309" strokeWidth={1} />
        ))}
        {purlins.filter((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID).map((piece) => {
          const { start, end } = pieceAxis(piece)
          const screenStart = worldToScreen({ x: start[0], y: start[1] }, viewport)
          const screenEnd = worldToScreen({ x: end[0], y: end[1] }, viewport)
          const mid = worldToScreen({ x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2 }, viewport)
          const axisLabel = Math.abs(piece.lengthAxisMm - Math.round(piece.lengthAxisMm)) < 0.05
            ? String(Math.round(piece.lengthAxisMm))
            : piece.lengthAxisMm.toFixed(1)
          const longLabel = Math.abs(piece.lengthLongMm - Math.round(piece.lengthLongMm)) < 0.05
            ? String(Math.round(piece.lengthLongMm))
            : piece.lengthLongMm.toFixed(1)
          const lengthText = Math.abs(piece.lengthLongMm - piece.lengthAxisMm) < 0.5
            ? axisLabel
            : `${axisLabel} / ${longLabel}`
          const shelfLabel = placedLabels.get(`shelf-${piece.id}`)
          const shelfX = shelfLabel?.x ?? mid.x
          const shelfY = shelfLabel?.y ?? mid.y
          return (
            <g key={`${piece.id}-len`}>
              <line
                x1={screenStart.x}
                y1={screenStart.y}
                x2={screenEnd.x}
                y2={screenEnd.y}
                stroke="#b45309"
                strokeWidth={2.5}
              />
              <text
                data-label-id={`shelf-${piece.id}`}
                data-label-box={`${shelfX},${shelfY},${shelfLabel?.w ?? 40},${shelfLabel?.h ?? 16}`}
                data-label-font={16}
                x={shelfX}
                y={shelfY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={16}
                fontFamily="monospace"
                fill="#b45309"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {lengthText}
              </text>
            </g>
          )
        })}

        {/* Балки периметра */}
        {beamFootprints.map(({ piece, corners }) => {
          const edge = beamEdgeIndex(piece.id)
          const isWall = edge != null && wallBeamEdges.includes(edge)
          return (
            <polygon
              key={piece.id}
              data-wall-beam={isWall ? '1' : undefined}
              points={pointsToSvg(corners, viewport)}
              fill={isWall ? '#94a3b8' : '#cbd5e1'}
              stroke="#1f2937"
              strokeWidth={isWall ? 4 : 1.5}
            />
          )
        })}
        {beamSplicePoints(beams).map((point, index) => {
          const screen = worldToScreen({ x: point[0], y: point[1] }, viewport)
          return (
            <circle
              key={`splice-${index}`}
              data-beam-splice="1"
              cx={screen.x}
              cy={screen.y}
              r={5}
              fill="#111827"
              stroke="#ffffff"
              strokeWidth={1}
            />
          )
        })}

        {/* Стойки */}
        {postFootprints.map(({ piece, corners }) => (
          <polygon key={piece.id} points={pointsToSvg(corners, viewport)} fill="#4b5563" stroke="#111827" strokeWidth={1} />
        ))}

        {lamellaDirection && lamellaDirectionLabel && (
          <LamellaDirectionIndicator
            centroid={centroid}
            direction={lamellaDirection}
            viewport={viewport}
            label={lamellaDirectionLabel}
            labelAt={placedLabels.get('lamella-dir')}
            letters={placed.letters.map((letter) => ({ x: letter.x, y: letter.y, font: letter.font }))}
          />
        )}

        <InteriorAngleSvg
          contour={contour}
          angles={dimensionModel.vertexAngles}
          viewport={viewport}
          centroid={centroid}
          obstacles={[
            ...perimeterLayouts.flatMap((layout) => [
              ...layout.segments.map((segment) => [segment.fromOffsetPoint, segment.toOffsetPoint] as [Point2D, Point2D]),
              ...layout.extensionLines.map((line) => [line.from, line.to] as [Point2D, Point2D]),
            ]),
            ...(purlinClearLayout
              ? [
                  ...purlinClearLayout.segments.map((segment) => [segment.fromOffsetPoint, segment.toOffsetPoint] as [Point2D, Point2D]),
                  ...purlinClearLayout.extensionLines.map((line) => [line.from, line.to] as [Point2D, Point2D]),
                ]
              : []),
            ...contour.map((point, index) => [point, contour[(index + 1) % contour.length]] as [Point2D, Point2D]),
            ...purlins.map((piece) => {
              const axis = pieceAxis(piece)
              return [axis.start, axis.end] as [Point2D, Point2D]
            }),
          ]}
          labelCenters={new Map(dimensionModel.vertexAngles.flatMap((entry) => {
            const label = placedLabels.get(`angle-${entry.vertexIndex}`)
            return label ? [[entry.vertexIndex, { x: label.x, y: label.y }] as const] : []
          }))}
        />

        {perimeterLayouts.map((layout, layoutIndex) => (
          <DimensionChainSvg
            key={layout.edgeIndex}
            layout={layout}
            viewport={viewport}
            labelFontSize={16}
            segmentIds={layout.segments.map((_, index) => `dim-${layoutIndex}-${index}`)}
            segmentAnchors={layout.segments.map((_, index) => {
              const label = placedLabels.get(`dim-${layoutIndex}-${index}`)
              return label ? { x: label.x, y: label.y } : null
            })}
          />
        ))}

        {placed.letters.filter((letter) => letter.text).map((letter) => {
          const box = placedLabels.get(`letter-${letter.id}`)
          return (
          <text
            key={`${letter.id}-type`}
            data-section-letter={letter.text}
            data-section-x={letter.x.toFixed(1)}
            data-section-y={letter.y.toFixed(1)}
            data-label-id={`letter-${letter.id}`}
            data-label-box={`${letter.x},${letter.y},${box?.w ?? letter.font},${box?.h ?? letter.font}`}
            data-label-font={letter.font}
            x={letter.x}
            y={letter.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={letter.font}
            fontFamily={labelFontFamily}
            fontWeight={700}
            fill="#1c1917"
            stroke="#ffffff"
            strokeWidth={Math.max(3, letter.font * 0.14)}
            paintOrder="stroke"
          >
            {letter.text}
          </text>
          )
        })}
        {geometricSides.map((side, index) => {
          const label = placedLabels.get(`beam-circle-${index}`)
          const x = label?.x ?? 0
          const y = label?.y ?? 0
          const text = beamMark(index + 1)
          const start = worldToScreen({ x: side.start[0], y: side.start[1] }, viewport)
          const end = worldToScreen({ x: side.end[0], y: side.end[1] }, viewport)
          const dx = end.x - start.x
          const dy = end.y - start.y
          const len = Math.hypot(dx, dy) || 1
          const slide = { x: dx / len, y: dy / len }
          return (
            <g key={`beam-mark-${index}`} data-beam-mark={index + 1}>
              <line
                data-clearance-line={`${start.x},${start.y},${end.x},${end.y}`}
                data-clearance-owner={`beam-circle-${index}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="none"
              />
              <line
                data-clearance-line={`${start.x},${start.y},${start.x + slide.x * 28},${start.y + slide.y * 28}`}
                data-clearance-owner={`beam-circle-${index}`}
                x1={start.x}
                y1={start.y}
                x2={start.x + slide.x * 28}
                y2={start.y + slide.y * 28}
                stroke="none"
              />
              <line
                data-clearance-line={`${end.x},${end.y},${end.x - slide.x * 28},${end.y - slide.y * 28}`}
                data-clearance-owner={`beam-circle-${index}`}
                x1={end.x}
                y1={end.y}
                x2={end.x - slide.x * 28}
                y2={end.y - slide.y * 28}
                stroke="none"
              />
              <circle
                data-label-id={`beam-circle-${index}`}
                data-label-box={`${x},${y},30,30`}
                data-label-font={14}
                cx={x}
                cy={y}
                r={15}
                fill="#ffffff"
                stroke="#111827"
                strokeWidth={1.5}
              />
              <text
                data-beam-mark={index + 1}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={14}
                fontFamily={labelFontFamily}
                fill="#111827"
              >
                {text}
              </text>
            </g>
          )
        })}

        {[...placed.miterText.entries()].map(([key, text]) => {
          const label = placedLabels.get(`miter-${key}`)
          if (!label) return null
          const tip = label.leaderTo
          const moved = tip != null && Math.hypot(label.x - tip.x, label.y - tip.y) > 26
          const leader = moved && tip
            ? (() => {
                const dx = label.x - tip.x
                const dy = label.y - tip.y
                const dist = Math.hypot(dx, dy) || 1
                return { x: label.x - (dx / dist) * (Math.min(label.w, label.h) / 2 + 2), y: label.y - (dy / dist) * (Math.min(label.w, label.h) / 2 + 2) }
              })()
            : null
          return (
            <g key={key}>
              {leader && tip && (
                <line data-miter-leader={key} x1={tip.x} y1={tip.y} x2={leader.x} y2={leader.y} stroke="#b91c1c" strokeWidth={1} />
              )}
              <text
                data-label-id={`miter-${key}`}
                data-label-box={`${label.x},${label.y},${label.w},${label.h}`}
                data-label-font={14}
                data-miter-tip={tip ? `${tip.x},${tip.y}` : undefined}
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={14}
                fontFamily={labelFontFamily}
                fill="#b91c1c"
              >
                {text}
              </text>
            </g>
          )
        })}

        {purlinClearLayout && (
          <DimensionChainSvg
            layout={purlinClearLayout}
            viewport={viewport}
            strokeColor="#0f766e"
            extensionColor="#5eead4"
            uniformLabelSummary={dimensionModel.purlinClearDisplaySummary}
            staggerSegmentLabels={!dimensionModel.purlinClearDisplaySummary}
            labelFontSize={16}
            summaryDy={placedLabels.get('clear-summary') ? 0 : -14}
            summaryAnchor={placedLabels.get('clear-summary') ?? null}
            summaryShift={placedLabels.get('clear-summary') ? undefined : purlinSummaryShift(purlinClearLayout, viewport)}
          />
        )}
        {showPurlinLengthLegend && purlinLengthGroups.length > 0 && canvasPx.heightPx > 0 && (() => {
          const rows = purlinLengthGroups.length + 1
          const legendH = 18 * rows + 10
          const legendY = Math.max(36, canvasPx.heightPx - legendH - 20)
          return (
            <g data-purlin-length-legend="">
              <rect x={8} y={legendY} width={156} height={legendH} fill="#ffffff" stroke="#b45309" strokeWidth={1} />
              <text x={16} y={legendY + 16} fontSize={12} fontFamily="sans-serif" fontWeight={700} fill="#92400e">
                {purlinLengthLegendTitle}
              </text>
              {purlinLengthGroups.map((group, index) => {
                const label = Math.abs(group.lengthMm - Math.round(group.lengthMm)) < 0.05
                  ? String(Math.round(group.lengthMm))
                  : group.lengthMm.toFixed(1)
                return (
                  <text
                    key={label}
                    x={16}
                    y={legendY + 34 + index * 18}
                    fontSize={14}
                    fontFamily="monospace"
                    fill="#92400e"
                  >
                    {`${group.count} × ${label}`}
                  </text>
                )
              })}
            </g>
          )
        })()}
        {viewport.scale > 0 && (() => {
          const mmPerPx = canvasPx.widthPx > 0
            ? 25.4 / 96
            : Math.min(PRINT_SLOT_MM.widthMm / sheetPx.widthPx, PRINT_SLOT_MM.heightMm / sheetPx.heightPx)
          const ratio = Math.max(1, Math.round(1 / (viewport.scale * mmPerPx)))
          return (
            <g>
              <rect x={sheetPx.widthPx - 86} y={8} width={76} height={26} fill="#ffffff" />
              <text data-plan-scale="1" x={sheetPx.widthPx - 48} y={26} textAnchor="middle" fontSize={16} fontFamily="sans-serif" fontWeight={700} fill="#111827">
                {`1:${ratio}`}
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

interface LamellaDirectionIndicatorProps {
  centroid: Point2D
  direction: Point2D
  viewport: Viewport
  label: string
  labelAt?: { x: number; y: number; w: number; h: number }
  letters?: Array<{ x: number; y: number; font: number }>
}

function distPointToSeg(point: Point2D, start: Point2D, end: Point2D): number {
  const abx = end[0] - start[0]
  const aby = end[1] - start[1]
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-9) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * abx + (point[1] - start[1]) * aby) / len2))
  return Math.hypot(point[0] - (start[0] + abx * t), point[1] - (start[1] + aby * t))
}

/** True when every purlin end meets the frame, a contour edge, or the shelf. */
export function purlinEndsMeetFrame(pieces: CutPiece[], contour: Point2D[]): boolean {
  const bars = pieces.filter((piece) => piece.role === 'purlin' && piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
  if (bars.length === 0 || contour.length < 3) return false
  const bounds: Array<[Point2D, Point2D]> = []
  for (let i = 0; i < contour.length; i++) bounds.push([contour[i], contour[(i + 1) % contour.length]])
  for (const piece of pieces) {
    if (piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID) continue
    const axis = pieceAxis(piece)
    bounds.push([axis.start, axis.end])
  }
  const axes = bars.map((piece) => pieceAxis(piece))
  // The shelf is a 40 mm band. The two halves end 40 mm apart, and that band
  // is not a contour edge when no shelf profile is drawn.
  const meetsShelfMate = (point: Point2D, index: number) => axes.some((axis, other) => {
    if (other === index) return false
    return Math.hypot(point[0] - axis.start[0], point[1] - axis.start[1]) <= 80
      || Math.hypot(point[0] - axis.end[0], point[1] - axis.end[1]) <= 80
  })
  const near = (point: Point2D, index: number) =>
    bounds.some(([start, end]) => distPointToSeg(point, start, end) <= 180) || meetsShelfMate(point, index)
  return bars.every((piece, index) => {
    const axis = axes[index]
    return near(axis.start, index) && near(axis.end, index)
  })
}

function labeledRowBoundaries(sections: LamellaSection[]): Array<{ y: number; x0: number; x1: number; label: boolean }> {
  const bands = rowBoundarySegments(sections)
  let labeled = 0
  let span = -1
  bands.forEach((band, index) => {
    const width = band.x1 - band.x0
    if (width > span) {
      span = width
      labeled = index
    }
  })
  return bands.map((band, index) => ({ ...band, label: index === labeled }))
}

function rowBoundarySegments(sections: LamellaSection[]): Array<{ y: number; x0: number; x1: number }> {
  const bands = new Map<number, { x0: number; x1: number }>()
  const isBeamFace = (face: LamellaSection['faceY0']) => face === 'purlin' || face === 'support'
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]
      const b = sections[j]
      const upper = a.minY >= b.maxY ? a : b
      const lower = upper === a ? b : a
      const gap = upper.minY - lower.maxY
      if (gap < -1 || gap > 40) continue
      if (isBeamFace(upper.faceY0) || isBeamFace(lower.faceY1)) continue
      const y = (upper.minY + lower.maxY) / 2
      let x0 = Math.min(upper.minX, lower.minX)
      let x1 = Math.max(upper.maxX, lower.maxX)
      for (const section of sections) {
        if (Math.abs(section.minY - upper.minY) > 2 && Math.abs(section.maxY - lower.maxY) > 2) continue
        x0 = Math.min(x0, section.minX)
        x1 = Math.max(x1, section.maxX)
      }
      if (x1 - x0 < 40) continue
      const key = Math.round(y)
      const prev = bands.get(key)
      bands.set(key, prev ? { x0: Math.min(prev.x0, x0), x1: Math.max(prev.x1, x1) } : { x0, x1 })
    }
  }
  return [...bands.entries()].map(([y, span]) => ({ y, x0: span.x0, x1: span.x1 }))
}

function formatMiterDeg(miterFromSquareDeg: number): string {
  const rounded = Math.round(miterFromSquareDeg * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function shelfLengthText(piece: CutPiece): string {
  const axisLabel = Math.abs(piece.lengthAxisMm - Math.round(piece.lengthAxisMm)) < 0.05
    ? String(Math.round(piece.lengthAxisMm))
    : piece.lengthAxisMm.toFixed(1)
  const longLabel = Math.abs(piece.lengthLongMm - Math.round(piece.lengthLongMm)) < 0.05
    ? String(Math.round(piece.lengthLongMm))
    : piece.lengthLongMm.toFixed(1)
  return Math.abs(piece.lengthLongMm - piece.lengthAxisMm) < 0.5 ? axisLabel : `${axisLabel} / ${longLabel}`
}

function sectionLetterCells(sections: LamellaSection[], viewport: Viewport) {
  return sections.flatMap((section) => {
    const corners = section.trapezoid?.corners ?? [
      [section.minX, section.minY],
      [section.maxX, section.minY],
      [section.maxX, section.maxY],
      [section.minX, section.maxY],
    ] as Point2D[]
    const screen = corners.map((point) => worldToScreen(toPoint(point), viewport))
    const xs = screen.map((point) => point.x)
    const ys = screen.map((point) => point.y)
    return [{
      id: section.id,
      cx: screen.reduce((sum, point) => sum + point.x, 0) / screen.length,
      cy: screen.reduce((sum, point) => sum + point.y, 0) / screen.length,
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    }]
  })
}

function purlinMiterLabels(purlins: CutPiece[]): Array<{ key: string; at: Point2D; tip: Point2D; text: string }> {
  const labels: Array<{ key: string; at: Point2D; tip: Point2D; text: string }> = []
  for (const piece of purlins) {
    const { start, end } = pieceAxis(piece)
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const len = Math.hypot(dx, dy) || 1
    const along: Point2D = [dx / len, dy / len]
    const perp: Point2D = [-along[1], along[0]]
    const place = (miter: number, tip: Point2D, inward: number, key: string) => {
      if (miter < 0.5) return
      labels.push({
        key,
        tip,
        at: [
          tip[0] + along[0] * inward * 220 + perp[0] * 180,
          tip[1] + along[1] * inward * 220 + perp[1] * 180,
        ],
        text: `${formatMiterDeg(miter)}°`,
      })
    }
    place(piece.cutMiterStartDeg, start, 1, `${piece.id}-s`)
    place(piece.cutMiterEndDeg, end, -1, `${piece.id}-e`)
  }
  return labels
}

function LamellaDirectionIndicator({ centroid, direction, viewport, label, labelAt, letters = [] }: LamellaDirectionIndicatorProps) {
  const arrowLengthMm = 800
  const from: Point2D = centroid
  const to: Point2D = [centroid[0] + direction[0] * arrowLengthMm, centroid[1] + direction[1] * arrowLengthMm]
  let sFrom = worldToScreen(toPoint(from), viewport)
  let sTo = worldToScreen(toPoint(to), viewport)
  const dx = sTo.x - sFrom.x
  const dy = sTo.y - sFrom.y
  const span = Math.hypot(dx, dy) || 1
  const perp = { x: -dy / span, y: dx / span }
  const letterHalf = (letter: { font: number }) => letter.font * 0.7
  const crossesLetter = (a: { x: number; y: number }, b: { x: number; y: number }) => letters.some((letter) => {
    const half = letterHalf(letter)
    const steps = 8
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      if (Math.abs(x - letter.x) < half && Math.abs(y - letter.y) < half) return true
    }
    return false
  })
  const labelHitsLetter = (step: number) => {
    const lx = (labelAt?.x ?? sTo.x) + perp.x * step
    const ly = (labelAt?.y ?? sTo.y) + perp.y * step
    const hw = (labelAt?.w ?? 88) / 2
    const hh = (labelAt?.h ?? 18) / 2
    return letters.some((letter) => Math.abs(lx - letter.x) < hw + letterHalf(letter) && Math.abs(ly - letter.y) < hh + letterHalf(letter))
  }
  let shift = 0
  for (const step of [0, 48, -48, 96, -96, 144, -144, 192, -192]) {
    const a = { x: sFrom.x + perp.x * step, y: sFrom.y + perp.y * step }
    const b = { x: sTo.x + perp.x * step, y: sTo.y + perp.y * step }
    if (!crossesLetter(a, b) && !labelHitsLetter(step)) {
      sFrom = a
      sTo = b
      shift = step
      break
    }
  }
  const x = (labelAt?.x ?? sTo.x) + perp.x * shift
  const y = (labelAt?.y ?? sTo.y) + perp.y * shift
  return (
    <g data-lamella-direction="1">
      <line x1={sFrom.x} y1={sFrom.y} x2={sTo.x} y2={sTo.y} stroke="#2563eb" strokeWidth={2} markerEnd="url(#pergola-dim-arrow)" />
      <text
        data-label-id="lamella-dir"
        data-label-box={`${x},${y},${labelAt?.w ?? 80},${labelAt?.h ?? 16}`}
        data-label-font={14}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={14}
        fontFamily="sans-serif"
        fill="#2563eb"
      >
        {label}
      </text>
    </g>
  )
}

