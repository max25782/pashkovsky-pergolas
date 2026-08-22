import type { Point } from './types'

/**
 * Проверка «простого многоугольника» (без самопересечений) — нужна ПЕРЕД
 * замыканием явной кнопкой (model/store.ts closeContourExplicit): в отличие
 * от магнита (который замыкает ровно там, где стоит курсор пользователя —
 * зигзаг, который физически привёл бы к самопересечению, почти невозможно
 * навести мышью), явная кнопка замыкает любой набор нарисованных сторон
 * безусловно. Зигзаг с самопересечением — невалидный контур: офсет/миттеры
 * в pergola-core посчитают бессмыслицу на пересекающихся рёбрах.
 *
 * Чистая геометрия, без экрана/пикселей — принимает вершины контура (мм,
 * мир), считает рёбра циклически: point[i] → point[(i+1) % n].
 */

const EPS = 1e-6

/** Знак ориентации (a→b) относительно c: >0 — против часовой, <0 — по часовой, 0 — коллинеарны. */
function orientation(a: Point, b: Point, c: Point): number {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  if (Math.abs(cross) < EPS) return 0
  return cross > 0 ? 1 : -1
}

/** true, если p лежит на отрезке [a,b] — вызывается только когда a,b,p уже коллинеарны (orientation===0). */
function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a.x, b.x) - EPS <= p.x &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    Math.min(a.y, b.y) - EPS <= p.y &&
    p.y <= Math.max(a.y, b.y) + EPS
  )
}

/** Классический тест пересечения отрезков (a1,a2) и (b1,b2) через ориентации, включая коллинеарное перекрытие. */
function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && onSegment(a1, a2, b1)) return true
  if (o2 === 0 && onSegment(a1, a2, b2)) return true
  if (o3 === 0 && onSegment(b1, b2, a1)) return true
  if (o4 === 0 && onSegment(b1, b2, a2)) return true

  return false
}

/**
 * true, если контур `points` (циклический, i → (i+1)%n) не имеет
 * самопересечений среди НЕсоседних рёбер. Соседние рёбра (делят одну вершину,
 * включая пару последнее↔первое) заведомо касаются друг друга в этой вершине —
 * это не самопересечение, такие пары пропускаются намеренно.
 *
 * n < 3 — вырожденный случай (точка/отрезок, не многоугольник вовсе);
 * считается простым — вызывающий обязан отдельно проверять минимальное
 * число сторон (см. closeContourExplicit — там же осмысленная ошибка
 * «нужно минимум 3 стороны», а не молчаливое "true" отсюда).
 */
export function isSimplePolygon(points: Point[]): boolean {
  const n = points.length
  if (n < 3) return true

  for (let i = 0; i < n; i++) {
    const a1 = points[i]
    const a2 = points[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      const isAdjacent = j === i + 1 || (i === 0 && j === n - 1)
      if (isAdjacent) continue
      const b1 = points[j]
      const b2 = points[(j + 1) % n]
      if (segmentsIntersect(a1, a2, b1, b2)) return false
    }
  }
  return true
}
