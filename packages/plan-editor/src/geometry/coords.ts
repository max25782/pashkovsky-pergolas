import type { Point, Viewport, WorldBounds, CanvasSize } from './types'

/**
 * Мировые мм → экранные px.
 *
 * ВАЖНО: ось Y перевёрнута. В мире (и в расчётном ядре, и в AutoCAD) Y растёт
 * вверх; в SVG/canvas Y растёт вниз. Без переворота здесь вся геометрия будет
 * зеркальной по вертикали — это единственное место, где перевод происходит,
 * поэтому переворот заложен именно тут, а не размазан по вызывающему коду.
 */
export function worldToScreen(p: Point, vp: Viewport): Point {
  return {
    x: vp.panX + p.x * vp.scale,
    y: vp.panY - p.y * vp.scale,
  }
}

/** Экранные px → мировые мм. Точная инверсия worldToScreen (с тем же переворотом Y). */
export function screenToWorld(p: Point, vp: Viewport): Point {
  return {
    x: (p.x - vp.panX) / vp.scale,
    y: (vp.panY - p.y) / vp.scale,
  }
}

/**
 * Единичный вектор направления по углу в мировой системе координат.
 * 0° = вправо (+X), угол растёт против часовой стрелки — та же конвенция,
 * что и в resolveDirection (atan2 по мировым dx/dy, без переворота Y:
 * переворот — это только worldToScreen/screenToWorld, к самой геометрии
 * направления он не относится).
 */
export function dirFromAngle(angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad), y: Math.sin(rad) }
}

/** Евклидово расстояние между двумя точками (в любой согласованной системе координат). */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * Перевод мировой длины (мм) в экранные px при равномерном масштабе viewport.scale
 * (px на мм). Один канонический способ считать «сколько это пикселей» — используется
 * и порогом коммита короткого тычка (store.ts), и магнитом замыкания (closure.ts):
 * оба порога про моторную точность клика, а не про мировую геометрию, поэтому
 * должны сравниваться в px, а не в мм, независимо от текущего зума.
 */
export function mmToPx(mm: number, viewport: Viewport): number {
  return mm * viewport.scale
}

/**
 * Проецирует курсор на луч from→angle.
 * Возвращает точку на луче на расстоянии |cursor−from|·cos(delta), где delta —
 * угол между направлением на курсор и защёлкнутым направлением.
 * Резиновое ребро тянется именно до этой точки, а не до самого курсора —
 * иначе линия визуально не будет выглядеть привязанной к углу.
 */
export function projectOntoRay(from: Point, angleDeg: number, cursor: Point): Point {
  const dir = dirFromAngle(angleDeg)
  const dx = cursor.x - from.x
  const dy = cursor.y - from.y
  // Скалярная проекция вектора (from→cursor) на единичный вектор направления
  const projLength = dx * dir.x + dy * dir.y
  // Отрицательную проекцию не отбрасываем — курсор может тянуть "назад"
  // относительно защёлкнутого направления, ребро должно следовать за ним.
  return {
    x: from.x + dir.x * projLength,
    y: from.y + dir.y * projLength,
  }
}

/**
 * Вычисляет viewport из fit-to-screen: подгоняет масштаб так, чтобы worldBounds
 * поместились в canvasSize с полями marginRatio с каждой стороны, и центрирует
 * центр worldBounds в центре холста.
 *
 * Масштаб — не константа. Захардкоженный scale ломается на любом другом
 * разрешении экрана (десктоп/телефон/другое окно) — характерный размер перголы
 * либо не влезет, либо потеряется на маленьком масштабе.
 */
export function computeFitToScreenViewport(
  worldBounds: WorldBounds,
  canvasSize: CanvasSize,
  marginRatio: number = 0.1,
): Viewport {
  const boundsWidth = worldBounds.maxX - worldBounds.minX
  const boundsHeight = worldBounds.maxY - worldBounds.minY

  const usableWidthPx = canvasSize.widthPx * (1 - 2 * marginRatio)
  const usableHeightPx = canvasSize.heightPx * (1 - 2 * marginRatio)

  // Берём меньший из двух масштабов, чтобы полигон влез по обеим осям.
  // Защита от деления на 0 / вырожденных границ (например, единственная точка).
  const scaleX = boundsWidth > 0 ? usableWidthPx / boundsWidth : Infinity
  const scaleY = boundsHeight > 0 ? usableHeightPx / boundsHeight : Infinity
  const scale = Math.min(scaleX, scaleY)

  const worldCenterX = (worldBounds.minX + worldBounds.maxX) / 2
  const worldCenterY = (worldBounds.minY + worldBounds.maxY) / 2
  const canvasCenterX = canvasSize.widthPx / 2
  const canvasCenterY = canvasSize.heightPx / 2

  // Подбираем pan так, чтобы центр мировых границ лёг в центр холста,
  // с учётом того же переворота Y, что и в worldToScreen.
  return {
    scale,
    panX: canvasCenterX - worldCenterX * scale,
    panY: canvasCenterY + worldCenterY * scale,
  }
}
