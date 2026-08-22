import { dirFromAngle } from './coords'
import type { Point, FixedEdge } from './types'

/**
 * Пересобирает from/to всей цепочки от `startAnchor`, идя по angleDeg и
 * lengthMm каждого звена по порядку. angleDeg и lengthMm — источник истины,
 * from/to — производные.
 *
 * Это и есть «сдвиг хвоста»: правка одного звена (см. updateEdgeLength/Angle
 * в model/store.ts) обязана прогонять всю цепочку через эту функцию, а не
 * трогать только затронутое звено — иначе следующие звенья останутся висеть
 * в воздухе на старых from/to.
 */
export function rebuildChain(edges: FixedEdge[], startAnchor: Point): FixedEdge[] {
  let anchor = startAnchor
  const result: FixedEdge[] = []
  for (const edge of edges) {
    const dir = dirFromAngle(edge.angleDeg)
    const to: Point = {
      x: anchor.x + dir.x * edge.lengthMm,
      y: anchor.y + dir.y * edge.lengthMm,
    }
    result.push({ ...edge, from: anchor, to })
    anchor = to
  }
  return result
}

/**
 * Точка старта следующей резиновой линии: конец последней зафиксированной
 * стороны, либо startPoint, если цепочка ещё пуста.
 */
export function currentAnchor(edges: FixedEdge[], startPoint: Point): Point {
  if (edges.length === 0) return startPoint
  return edges[edges.length - 1].to
}

/**
 * Контур как массив вершин (мм, мир) — по одной точке `from` на каждую
 * сторону, в порядке обхода. Для замкнутого контура `edges[n-1].to` совпадает
 * (с точностью до невязки) с `edges[0].from` — последнюю точку намеренно не
 * дублируют, потребитель (computeFrame/computeLamellas в pergola-core) сам
 * замыкает контур как i → (i+1) % n.
 *
 * Чистая производная от fixedEdges — используется хостом (например, кнопкой
 * «В 3D» в оверлее редактора) для передачи полигона в ядро расчёта, минуя
 * прямую связь редактора с 3D (см. промпт шага 3D: «Ядро посередине»).
 */
export function toPolygon(edges: FixedEdge[]): Point[] {
  return edges.map((edge) => edge.from)
}

/**
 * Индексы сторон, отмеченных attachedToWall — в том же индексировании, что
 * и toPolygon (сторона i идёт от вершины i к вершине (i+1)%n), то есть
 * готовые для прямой записи в PergolaSpec.wallEdgeIndices ядром. Чистая
 * производная от fixedEdges, как и toPolygon — используется тем же
 * вызывающим (кнопка «В 3D» в хосте), чтобы вместе с полигоном передать,
 * какие стороны пристенные (см. промпт «крепление к стене»: обобщение
 * wallEdgeIndex на набор индексов).
 */
export function wallEdgeIndicesFromChain(edges: FixedEdge[]): number[] {
  const indices: number[] = []
  edges.forEach((edge, i) => {
    if (edge.attachedToWall) indices.push(i)
  })
  return indices
}
