/** Shared 2D point (world mm or screen px depending on context). */
export interface Point {
  x: number
  y: number
}

export interface WorldBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface CanvasSize {
  widthPx: number
  heightPx: number
}

export interface Viewport {
  scale: number
  panX: number
  panY: number
}
