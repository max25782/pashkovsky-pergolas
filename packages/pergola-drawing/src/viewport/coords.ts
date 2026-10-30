import type { Point, Viewport, WorldBounds, CanvasSize } from './types'

export function worldToScreen(p: Point, vp: Viewport): Point {
  return {
    x: vp.panX + p.x * vp.scale,
    y: vp.panY - p.y * vp.scale,
  }
}

export function screenToWorld(p: Point, vp: Viewport): Point {
  return {
    x: (p.x - vp.panX) / vp.scale,
    y: (vp.panY - p.y) / vp.scale,
  }
}

export function dirFromAngle(angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad), y: Math.sin(rad) }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function mmToPx(mm: number, viewport: Viewport): number {
  return mm * viewport.scale
}

export function projectOntoRay(from: Point, angleDeg: number, cursor: Point): Point {
  const dir = dirFromAngle(angleDeg)
  const dx = cursor.x - from.x
  const dy = cursor.y - from.y
  const projLength = dx * dir.x + dy * dir.y
  return {
    x: from.x + dir.x * projLength,
    y: from.y + dir.y * projLength,
  }
}

export function computeFitToScreenViewport(
  worldBounds: WorldBounds,
  canvasSize: CanvasSize,
  marginRatio: number = 0.1,
): Viewport {
  const boundsWidth = worldBounds.maxX - worldBounds.minX
  const boundsHeight = worldBounds.maxY - worldBounds.minY

  const usableWidthPx = canvasSize.widthPx * (1 - 2 * marginRatio)
  const usableHeightPx = canvasSize.heightPx * (1 - 2 * marginRatio)

  const scaleX = boundsWidth > 0 ? usableWidthPx / boundsWidth : Infinity
  const scaleY = boundsHeight > 0 ? usableHeightPx / boundsHeight : Infinity
  const scale = Math.min(scaleX, scaleY)

  const worldCenterX = (worldBounds.minX + worldBounds.maxX) / 2
  const worldCenterY = (worldBounds.minY + worldBounds.maxY) / 2
  const canvasCenterX = canvasSize.widthPx / 2
  const canvasCenterY = canvasSize.heightPx / 2

  return {
    scale,
    panX: canvasCenterX - worldCenterX * scale,
    panY: canvasCenterY + worldCenterY * scale,
  }
}
