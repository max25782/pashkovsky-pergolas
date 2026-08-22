import type { Point, Modifiers, DirResult, SnapConfig } from './types'

const ORTHO_ANGLES = [0, 90, 180, 270]

/** Нормализует угол в диапазон [0, 360). */
export function normalizeAngle(deg: number): number {
  const r = deg % 360
  return r < 0 ? r + 360 : r
}

/**
 * Кратчайшее угловое расстояние между двумя углами, всегда ∈ [0, 180].
 * Экспортирована отдельно: граничные тесты порога (ровно 7°) проверяются
 * на этой чистой числовой функции, а не через resolveDirection с atan2 —
 * округление в тригонометрии даёт шум ~1e-13°, которого достаточно, чтобы
 * сравнение "ровно на границе" стало недетерминированным при проходе через sin/cos.
 */
export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360
  return diff > 180 ? 360 - diff : diff
}

/** Находит ближайший к `angle` угол среди `candidates` по angularDistance. */
function nearestAngle(angle: number, candidates: number[]): number {
  let best = candidates[0]
  let bestDist = angularDistance(angle, best)
  for (let i = 1; i < candidates.length; i++) {
    const d = angularDistance(angle, candidates[i])
    if (d < bestDist) {
      bestDist = d
      best = candidates[i]
    }
  }
  return best
}

/**
 * Разрешает направление ребра от `from` к `cursor` с учётом модификаторов
 * и конфига привязки.
 *
 * Порядок проверки:
 *   1. freeform === true  → сырой угол, без привязки (приоритет выше ortho).
 *   2. lockOrtho === true  → жёсткая привязка к ближайшему из 0/90/180/270.
 *   3. иначе               → мягкая polar-привязка к config.snapAngles
 *                             в пределах config.thresholdDeg (включительно).
 */
export function resolveDirection(
  from: Point,
  cursor: Point,
  mods: Modifiers,
  config: SnapConfig,
): DirResult {
  const rawAngle = normalizeAngle(
    (Math.atan2(cursor.y - from.y, cursor.x - from.x) * 180) / Math.PI,
  )

  if (mods.freeform) {
    return { angleDeg: rawAngle, snapped: false, snapAngle: null }
  }

  if (mods.lockOrtho) {
    const best = nearestAngle(rawAngle, ORTHO_ANGLES)
    return { angleDeg: best, snapped: true, snapAngle: best }
  }

  const best = nearestAngle(rawAngle, config.snapAngles)
  const delta = angularDistance(rawAngle, best)

  if (delta <= config.thresholdDeg) {
    return { angleDeg: best, snapped: true, snapAngle: best }
  }

  return { angleDeg: rawAngle, snapped: false, snapAngle: null }
}
