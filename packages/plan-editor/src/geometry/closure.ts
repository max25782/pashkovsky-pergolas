import { dirFromAngle, distance, mmToPx } from './coords'
import { normalizeAngle } from './snap'
import { DEFAULT_MAGNET_THRESHOLD_PX } from './types'
import type { DraftEdge, FixedEdge, Point, Viewport } from './types'

/** Реэкспорт — порог теперь определён в types.ts рядом с DEFAULT_SNAP_CONFIG, см. там. */
export { DEFAULT_MAGNET_THRESHOLD_PX }

export interface ClosureGap {
  dx: number
  dy: number
  distMm: number
}

/**
 * Невязка замыкания контура.
 *
 * Считается по СУММЕ ВЕКТОРОВ сторон (angleDeg/lengthMm — источник истины),
 * а не по сравнению позиций from/to. Это принципиально: from/to — производные
 * rebuildChain и всегда «сходятся» механически (каждая следующая сторона
 * начинается ровно там, где кончилась предыдущая) — они не могут показать
 * ошибку замера, только накопленную позицию. Обход замкнутого многоугольника
 * по определению возвращается в стартовую точку, то есть сумма всех сторон-
 * векторов должна быть (0,0). Любое отклонение — честная мера того, что
 * измеренные на объекте стороны физически не складываются в замкнутый контур
 * (типичная ошибка рулетки), а не баг вычислений.
 */
export function closureGap(edges: FixedEdge[]): ClosureGap {
  let dx = 0
  let dy = 0
  for (const edge of edges) {
    const dir = dirFromAngle(edge.angleDeg)
    dx += dir.x * edge.lengthMm
    dy += dir.y * edge.lengthMm
  }
  return { dx, dy, distMm: Math.hypot(dx, dy) }
}

/**
 * Магнит замыкания: если конец черновой линии оказался в пределах thresholdPx
 * (экранных, через viewport.scale) от startPoint — «прилипает» к нему точно
 * (edge.to = startPoint) и помечается closesContour: true.
 *
 * `canClose` — внешний гейт (обычно fixedEdges.length >= 2 && !isClosed):
 * замыкать контур после одной-единственной стороны геометрически бессмысленно,
 * а после уже замкнутого — не наша забота на этом шаге.
 *
 * ВАЖНО про честность невязки: подмена `to` на startPoint здесь — это именно то,
 * что запишется как lengthMm/angleDeg замыкающей стороны при обычном клике без
 * последующей правки поля (см. commitDraft/closeContour в model/store.ts). Это
 * НЕ способ «спрятать» невязку — если пользователь ничего не поменял, значит,
 * этой стороне никто не давал независимого измерения, и gap=0 для неё честен.
 * Как только он впишет в открывшееся поле своё РЕАЛЬНОЕ измерение этой стороны
 * (отличное от геометрически досчитанного) — closureGap тут же покажет разницу.
 *
 * КРИТИЧНО: `dir.angleDeg` пересчитывается на угол from→startPoint, а НЕ
 * наследуется от исходного edge.dir (который смотрел на курсор, а курсор
 * почти никогда не стоит пиксель-в-пиксель точно в startPoint — он просто
 * оказался в пределах thresholdPx от него). Без этого пересчёта `to` снапится
 * на startPoint, а lengthMm (из distance(from,to)) станет верным, но angleDeg
 * останется чуть повёрнутым к исходной позиции курсора — closureGap увидит
 * это как фиктивную невязку в первые же миллисекунды после чистого
 * геометрического замыкания, ДО того как пользователь хоть что-то отредактировал.
 * Проверено живьём на стенде: без этой строки клик по магниту сразу давал
 * gap ≈ 17мм на пустом месте — искусственный шум, а не честная невязка.
 */
export function applyStartMagnet(
  edge: DraftEdge,
  startPoint: Point,
  viewport: Viewport,
  canClose: boolean,
  thresholdPx: number = DEFAULT_MAGNET_THRESHOLD_PX,
): DraftEdge {
  if (!canClose) return edge
  const distMm = distance(edge.to, startPoint)
  if (mmToPx(distMm, viewport) > thresholdPx) return edge
  const angleToStartDeg = normalizeAngle(
    (Math.atan2(startPoint.y - edge.from.y, startPoint.x - edge.from.x) * 180) / Math.PI,
  )
  return {
    ...edge,
    to: startPoint,
    dir: { ...edge.dir, angleDeg: angleToStartDeg },
    closesContour: true,
  }
}
