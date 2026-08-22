import { resolveDirection } from './snap'
import { projectOntoRay, dirFromAngle, distance } from './coords'
import type { Point, Modifiers, SnapConfig, DraftEdge, DraftOverride } from './types'

/**
 * Собирает черновое (резиновое) ребро от `from` до текущего курсора.
 * Единая точка входа для input-слоя: направление + проекция всегда идут
 * вместе, чтобы `to` никогда не оказался «сырым» курсором при snapped-угле.
 */
export function buildDraftEdge(
  from: Point,
  cursorWorld: Point,
  mods: Modifiers,
  config: SnapConfig,
): DraftEdge {
  const dir = resolveDirection(from, cursorWorld, mods, config)
  const to = projectOntoRay(from, dir.angleDeg, cursorWorld)
  return { from, to, dir }
}

/**
 * Применяет оверрайд динамического ввода (A1) к уже построенному черновому
 * ребру. Поле, не заданное в override, берётся из текущего edge (мышь).
 * Оба поля не заданы (или override отсутствует) → возвращает edge как есть,
 * без пересборки — это host-функция для мышиного клика без набора числа.
 *
 * `closesContour` СОХРАНЯЕТСЯ из исходного edge как есть: печать длины/угла
 * переопределяет геометрию, но не отменяет решение «это последняя сторона»,
 * принятое магнитом замыкания (см. applyStartMagnet) — если пользователь
 * напечатал длину, отличную от «довести точно до startPoint», результат —
 * честная невязка на замыкающей стороне, а не молчаливая подмена на magnet-to.
 * Поэтому `to` здесь считается от `edge.from` + угол + длина, а НЕ клонируется
 * из edge.to (который мог быть принудительно поставлен в startPoint).
 *
 * dir.snapped СОХРАНЯЕТСЯ из исходного edge: печать числа — это отдельная,
 * третья ось доверия (measuredLengthMm/measuredAngleDeg в FixedEdge), а не
 * замена ortho/polar-привязки мыши. Обе оси уживаются независимо.
 */
export function finalizeDraftEdge(edge: DraftEdge, override: DraftOverride | undefined): DraftEdge {
  if (!override || (override.lengthMm == null && override.angleDeg == null)) return edge

  const angleDeg = override.angleDeg ?? edge.dir.angleDeg
  const lengthMm = override.lengthMm ?? distance(edge.from, edge.to)
  const dirVec = dirFromAngle(angleDeg)
  const to: Point = {
    x: edge.from.x + dirVec.x * lengthMm,
    y: edge.from.y + dirVec.y * lengthMm,
  }

  return {
    ...edge,
    to,
    dir: { ...edge.dir, angleDeg },
  }
}
