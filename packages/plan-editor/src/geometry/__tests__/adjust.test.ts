import { describe, it, expect } from 'vitest'
import { adjustContour, DEFAULT_ADJUST_WEIGHTS } from '../adjust'
import type { FixedEdge } from '../types'

const START = { x: 0, y: 0 }

/** Строит FixedEdge без from/to (adjustContour их пересчитывает через rebuildChain). */
function edge(
  id: string,
  lengthMm: number,
  angleDeg: number,
  opts: {
    measuredLengthMm?: number
    measuredAngleDeg?: number
    closedByMagnet?: boolean
    angleSnapped?: boolean
  } = {},
): FixedEdge {
  return {
    id,
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    lengthMm,
    angleDeg,
    ...opts,
  }
}

describe('adjustContour — degenerate input', () => {
  it('empty contour: no-op, converged, zero gap', () => {
    const result = adjustContour([], START)
    expect(result.edges).toEqual([])
    expect(result.residuals).toEqual([])
    expect(result.worstEdgeIndex).toBeNull()
    expect(result.closureGapMm).toBe(0)
    expect(result.converged).toBe(true)
  })

  it('single edge cannot close except degenerating toward zero length — must not crash or produce NaN', () => {
    const edges = [edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 })]
    const result = adjustContour(edges, START)

    expect(Number.isFinite(result.closureGapMm)).toBe(true)
    expect(Number.isFinite(result.edges[0].lengthMm)).toBe(true)
    expect(Number.isFinite(result.edges[0].angleDeg)).toBe(true)
    expect(Number.isNaN(result.residuals[0].lengthResidualMm)).toBe(false)
    // Единственный геометрически точный способ замкнуть один вектор — свести его длину к нулю.
    expect(result.edges[0].lengthMm).toBeLessThan(1000)
  })

  it('two collinear out-and-back edges are already closed — near-zero residuals, no drama', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 1000, 180, { measuredLengthMm: 1000, measuredAngleDeg: 180 }),
    ]
    const result = adjustContour(edges, START)

    expect(result.converged).toBe(true)
    expect(result.closureGapMm).toBeLessThan(0.01)
    for (const r of result.residuals) {
      expect(Math.abs(r.lengthResidualMm)).toBeLessThan(0.01)
      expect(Math.abs(r.angleResidualDeg)).toBeLessThan(0.01)
    }
  })
})

describe('adjustContour — perfect rectangle, all sides measured and already closed', () => {
  it('leaves every side essentially untouched', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 800, 90, { measuredLengthMm: 800, measuredAngleDeg: 90 }),
      edge('edge-2', 1000, 180, { measuredLengthMm: 1000, measuredAngleDeg: 180 }),
      edge('edge-3', 800, 270, { measuredLengthMm: 800, measuredAngleDeg: 270 }),
    ]
    const result = adjustContour(edges, START)

    expect(result.converged).toBe(true)
    expect(result.closureGapMm).toBeLessThan(0.01)
    for (const r of result.residuals) {
      expect(Math.abs(r.lengthResidualMm)).toBeLessThan(0.01)
      expect(Math.abs(r.angleResidualDeg)).toBeLessThan(0.01)
      expect(r.wasUnmeasured).toBe(false)
    }
    // from/to пересобраны и действительно образуют замкнутый контур.
    const last = result.edges[result.edges.length - 1]
    expect(last.to.x).toBeCloseTo(START.x, 1)
    expect(last.to.y).toBeCloseTo(START.y, 1)
  })
})

describe('adjustContour — angle trust has three tiers: snapped > typed > free', () => {
  it('an edge whose angle came from ortho/polar snap barely rotates even under pressure, more so than a typed angle', () => {
    // Один и тот же контур, отличается только ИСТОЧНИК угла второй стороны:
    // snapped (привязка) должен держаться жёстче typed (введено числом).
    // Проверяем через прямое сравнение углового остатка на идентичной геометрии.
    const buildEdges = (angleSource: 'snapped' | 'typed'): FixedEdge[] => [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge(
        'edge-1',
        800,
        90,
        angleSource === 'snapped' ? { measuredLengthMm: 800, angleSnapped: true } : { measuredLengthMm: 800, measuredAngleDeg: 90 },
      ),
      edge('edge-2', 1100, 180, { measuredLengthMm: 1100, angleSnapped: true }), // намеренно +100, чтобы был реальный gx-конфликт
      edge('edge-3', 800, 270, { measuredLengthMm: 800, angleSnapped: true }),
    ]

    const snappedResult = adjustContour(buildEdges('snapped'), START)
    const typedResult = adjustContour(buildEdges('typed'), START)

    expect(snappedResult.converged).toBe(true)
    expect(typedResult.converged).toBe(true)
    // Угол стороны 1 при snapped сдвигается меньше, чем при typed, при абсолютно
    // одинаковой геометрии и одинаковой "вине" остальных сторон — единственная
    // разница — источник угла. Это и есть прямое доказательство иерархии весов.
    expect(Math.abs(snappedResult.residuals[1].angleResidualDeg)).toBeLessThan(
      Math.abs(typedResult.residuals[1].angleResidualDeg),
    )
  })

  it('DEFAULT_ADJUST_WEIGHTS.angleSnapped is stiffer than angleTyped, which is stiffer than angleFree/lengthFree', () => {
    expect(DEFAULT_ADJUST_WEIGHTS.angleSnapped).toBeGreaterThan(DEFAULT_ADJUST_WEIGHTS.angleTyped)
    expect(DEFAULT_ADJUST_WEIGHTS.angleTyped).toBeGreaterThan(DEFAULT_ADJUST_WEIGHTS.angleFree)
    expect(DEFAULT_ADJUST_WEIGHTS.lengthTyped).toBeGreaterThan(DEFAULT_ADJUST_WEIGHTS.lengthFree)
  })
})

describe('adjustContour — broken rectangle: one measured side is wrong, all angles snapped', () => {
  // Прямоугольник 1000×800, сторона "180°" измерена как 1100 вместо 1000 — x-невязка 100мм.
  // Все 4 угла — из привязки (angleSnapped), очень жёсткий вес. Раньше (равный вес длины
  // и угла) поворот вертикальной стороны на долю градуса стоил РОВНО столько же, сколько
  // подвинуть горизонтальную сторону на эквивалентный миллиметраж — ортогональные стороны
  // 1/3 участвовали в подгонке почти на равных с 0/2 (см. историю правок). Сделав угол,
  // защёлкнутый привязкой, ощутимо жёстче типизированной длины, мы закрываем именно этот
  // канал: 1/3 больше не могут "откупиться" от подгонки поворотом на пару градусов.
  //
  // НО: это не решает и не может решить симметрию между 0 и 2. Обе стороны — противолежащие,
  // с РАВНЫМ весом типизированной длины и РАВНОЙ (по модулю) чувствительностью к x-невязке —
  // у решателя буквально нет данных, чтобы отличить "0 слишком короткая" от "2 слишком длинная":
  // это доказано ниже (flip-test) — если поменять, какая из двух сторон "неправильная", результат
  // распределения не меняется по модулю, а worstEdgeIndex объективно выбирает между двумя
  // практически равными по стоимости кандидатами. Никакая перенастройка весов угла это не изменит,
  // потому что угол здесь не имеет плеча на эту невязку вообще (обе стороны горизонтальны).
  // Разрешить такую неоднозначность может только независимое третье измерение (диагональ,
  // например) — вне контура из 4 сторон с 2 уравнениями замыкания оно взяться не может.
  it('orthogonal sides (1, 3) are no longer meaningfully blamed — the fix concentrates on the sides that actually have leverage on the gap', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, angleSnapped: true }),
      edge('edge-1', 800, 90, { measuredLengthMm: 800, angleSnapped: true }),
      edge('edge-2', 1100, 180, { measuredLengthMm: 1100, angleSnapped: true }), // должно быть 1000
      edge('edge-3', 800, 270, { measuredLengthMm: 800, angleSnapped: true }),
    ]
    const result = adjustContour(edges, START)

    expect(result.converged).toBe(true)
    expect(result.closureGapMm).toBeLessThan(0.01)

    const [r0, r1, r2, r3] = result.residuals
    // Ортогональные стороны почти не тронуты — их угловой вес теперь дороже отказа.
    expect(Math.abs(r1.angleResidualDeg)).toBeLessThan(1)
    expect(Math.abs(r3.angleResidualDeg)).toBeLessThan(1)
    // Стороны 0/2 (единственные с реальным плечом на x-невязку) забрали практически
    // всю поправку между собой — сумма их модулей близка к полным 100мм.
    const combined = Math.abs(r0.lengthResidualMm) + Math.abs(r2.lengthResidualMm)
    expect(combined).toBeGreaterThan(85)
    expect(combined).toBeLessThan(100.5)
    // worstEdgeIndex гарантированно НЕ указывает на ортогональную сторону.
    expect([0, 2]).toContain(result.worstEdgeIndex)
    // И это ИМЕННО случай 2 (неоднозначность) диагностики для 3C: 0 и 2 —
    // математически неразличимые кандидаты, UI обязан показать оба, а не
    // указать на worstEdgeIndex как на единственного виновника.
    expect(result.ambiguousCandidates).toEqual([0, 2])
  })

  it('proves the 0-vs-2 tie is a hard information-theoretic limit, not a leftover weight-tuning bug: flipping which side is wrong does not change which index "wins"', () => {
    const build = (wrongIndex: 0 | 2): FixedEdge[] => {
      const lengths: [number, number] = wrongIndex === 2 ? [1000, 1100] : [1100, 1000]
      return [
        edge('edge-0', lengths[0], 0, { measuredLengthMm: lengths[0], angleSnapped: true }),
        edge('edge-1', 800, 90, { measuredLengthMm: 800, angleSnapped: true }),
        edge('edge-2', lengths[1], 180, { measuredLengthMm: lengths[1], angleSnapped: true }),
        edge('edge-3', 800, 270, { measuredLengthMm: 800, angleSnapped: true }),
      ]
    }

    const wrongIsEdge2 = adjustContour(build(2), START)
    const wrongIsEdge0 = adjustContour(build(0), START)

    // |остаток| на паре 0/2 одинаков в обоих прогонах (симметрия задачи) —
    // будь тут реальный сигнал "кто виноват", он поменялся бы местами вместе
    // с тем, какая сторона реально неверна. Он не меняется: это чистая
    // симметрия равных весов, а не диагностика.
    expect(Math.abs(wrongIsEdge2.residuals[0].lengthResidualMm)).toBeCloseTo(
      Math.abs(wrongIsEdge0.residuals[0].lengthResidualMm),
      3,
    )
    expect(wrongIsEdge2.worstEdgeIndex).toBe(wrongIsEdge0.worstEdgeIndex)
  })
})

describe('adjustContour — worstEdgeIndex finds the real culprit in an asymmetric contour', () => {
  it('a grossly wrong measured side clearly dominates the weighted cost, even though its raw mm residual is not the single largest', () => {
    // Треугольник: сторона 0 и сторона 1 — согласованные и верные (в реальности
    // они и дают тот самый треугольник из живой проверки 3A). Сторона 2 должна
    // была быть ~943.4мм / ~238°, чтобы замкнуть контур, но пользователь явно
    // ВВЁЛ число 500мм / 180° — грубая ошибка, а не магнит и не недомер.
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 943.398, 122.0054, { measuredLengthMm: 943.398, measuredAngleDeg: 122.0054 }),
      edge('edge-2', 500, 180, { measuredLengthMm: 500, measuredAngleDeg: 180 }),
    ]
    const result = adjustContour(edges, START)

    expect(result.converged).toBe(true)
    expect(result.closureGapMm).toBeLessThan(0.01)
    expect(result.worstEdgeIndex).toBe(2)

    // Явно неверная сторона получила заметно больший угловой остаток, чем обе
    // корректные — это и есть тот самый "реально подозрительный замер".
    const [, , r2] = result.residuals
    expect(Math.abs(r2.angleResidualDeg)).toBeGreaterThan(20)
    // Случай 1 диагностики (один явный виновник) — ambiguousCandidates ПУСТ,
    // UI обязан показать именно worstEdgeIndex, а не список "нельзя различить".
    expect(result.ambiguousCandidates).toEqual([])
  })
})

describe('adjustContour — trapezoid, all measured and consistent (sanity check on non-rectangular geometry)', () => {
  it('closes with near-zero residuals for a symmetric trapeze', () => {
    // Равнобедренная трапеция: нижнее основание 2000, верхнее 1000, боковые под 45°/135°
    // к горизонтали высотой 500 ⇒ боковая сторона = 500·√2 ≈ 707.11мм.
    const side = 500 * Math.SQRT2
    const edges = [
      edge('edge-0', 2000, 0, { measuredLengthMm: 2000, measuredAngleDeg: 0 }),
      edge('edge-1', side, 135, { measuredLengthMm: side, measuredAngleDeg: 135 }),
      edge('edge-2', 1000, 180, { measuredLengthMm: 1000, measuredAngleDeg: 180 }),
      edge('edge-3', side, 225, { measuredLengthMm: side, measuredAngleDeg: 225 }),
    ]
    const result = adjustContour(edges, START)

    expect(result.converged).toBe(true)
    expect(result.closureGapMm).toBeLessThan(0.01)
    for (const r of result.residuals) {
      expect(Math.abs(r.lengthResidualMm)).toBeLessThan(0.01)
      expect(Math.abs(r.angleResidualDeg)).toBeLessThan(0.01)
    }
  })
})

describe('adjustContour — initialGapMm (панель итога 3C: "была невязка X мм")', () => {
  it('is ~0 for a contour that was already closed before adjusting', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 800, 90, { measuredLengthMm: 800, measuredAngleDeg: 90 }),
      edge('edge-2', 1000, 180, { measuredLengthMm: 1000, measuredAngleDeg: 180 }),
      edge('edge-3', 800, 270, { measuredLengthMm: 800, measuredAngleDeg: 270 }),
    ]
    const result = adjustContour(edges, START)
    expect(result.initialGapMm).toBeLessThan(0.01)
  })

  it('reflects the raw pre-adjustment discrepancy, independent of the post-adjustment closureGapMm', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, angleSnapped: true }),
      edge('edge-1', 800, 90, { measuredLengthMm: 800, angleSnapped: true }),
      edge('edge-2', 1100, 180, { measuredLengthMm: 1100, angleSnapped: true }), // +100мм рассинхрон
      edge('edge-3', 800, 270, { measuredLengthMm: 800, angleSnapped: true }),
    ]
    const result = adjustContour(edges, START)
    expect(result.initialGapMm).toBeCloseTo(100, 1) // ровно та невязка, что и заложена
    expect(result.closureGapMm).toBeLessThan(0.01) // а ПОСЛЕ уравнивания — сошлось
  })

  it('empty contour: initialGapMm is 0', () => {
    expect(adjustContour([], START).initialGapMm).toBe(0)
  })
})

describe('adjustContour — underDeterminedEdgeIds (панель итога 3C: недоопределённость угла)', () => {
  it('is empty when every angle is either typed or snapped', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 943.398, 122.0054, { measuredLengthMm: 943.398, angleSnapped: true }),
      edge('edge-2', 500, 180, { measuredLengthMm: 500, measuredAngleDeg: 180 }),
    ]
    expect(adjustContour(edges, START).underDeterminedEdgeIds).toEqual([])
  })

  it('lists ids of edges whose angle has neither a typed value nor a snap — the classic magnet-closed side', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 943.398, 122.0054, { measuredLengthMm: 943.398, measuredAngleDeg: 122.0054 }),
      edge('edge-2', 900, 200, { closedByMagnet: true }), // не введено, не защёлкнуто
    ]
    expect(adjustContour(edges, START).underDeterminedEdgeIds).toEqual(['edge-2'])
  })
})

describe('adjustContour — ambiguousCandidates edge cases', () => {
  it('single measured edge: never ambiguous (need at least two candidates to be indistinguishable)', () => {
    const edges = [edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 })]
    expect(adjustContour(edges, START).ambiguousCandidates).toEqual([])
  })

  it('a contour with zero residual everywhere: ambiguousCandidates is empty, not "everyone is a candidate"', () => {
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 800, 90, { measuredLengthMm: 800, measuredAngleDeg: 90 }),
      edge('edge-2', 1000, 180, { measuredLengthMm: 1000, measuredAngleDeg: 180 }),
      edge('edge-3', 800, 270, { measuredLengthMm: 800, measuredAngleDeg: 270 }),
    ]
    const result = adjustContour(edges, START)
    expect(result.closureGapMm).toBeLessThan(0.01)
    expect(result.ambiguousCandidates).toEqual([])
  })
})

describe('adjustContour — unmeasured (magnet-closed) side absorbs the gap, measured sides stay put', () => {
  it('is the core motivating case: 0mm gap from the magnet is NOT proof of a good measurement', () => {
    // Треугольник: две стороны честно измерены и согласованы друг с другом.
    // Третья — "домотана до магнита": committed без measuredLengthMm/measuredAngleDeg,
    // с грубыми lengthMm/angleDeg (то, что дал магнит), но closedByMagnet=true.
    const edges = [
      edge('edge-0', 1000, 0, { measuredLengthMm: 1000, measuredAngleDeg: 0 }),
      edge('edge-1', 943.398, 122.0054, { measuredLengthMm: 943.398, measuredAngleDeg: 122.0054 }),
      // Магнит поставил ЧТО УГОДНО (здесь — заведомо грубые числа) в lengthMm/angleDeg,
      // но не заполнил measured* — сторона свободна.
      edge('edge-2', 900, 200, { closedByMagnet: true }),
    ]
    const result = adjustContour(edges, START)

    expect(result.converged).toBe(true)
    expect(result.closureGapMm).toBeLessThan(0.01)

    const [r0, r1, r2] = result.residuals
    // Измеренные стороны почти не шевельнулись.
    expect(Math.abs(r0.lengthResidualMm)).toBeLessThan(0.5)
    expect(Math.abs(r1.lengthResidualMm)).toBeLessThan(0.5)
    expect(r0.wasUnmeasured).toBe(false)
    expect(r1.wasUnmeasured).toBe(false)
    // Неизмеренная сторона забрала всю перестройку — её итоговые числа далеко
    // от грубых 900/200°, которые дал магнит.
    expect(r2.wasUnmeasured).toBe(true)
    expect(Math.abs(result.edges[2].lengthMm - 900)).toBeGreaterThan(10)

    // worstEdgeIndex НЕ должен указывать на свободную сторону несмотря на то,
    // что у неё самый большой голый остаток в мм — вес у неё маленький.
    expect(result.worstEdgeIndex).not.toBe(2)
    // Неизмеренная сторона не может быть "кандидатом на неоднозначность" —
    // она вообще не участвует в конкурсе на виновника.
    expect(result.ambiguousCandidates).not.toContain(2)
    expect(result.underDeterminedEdgeIds).toEqual(['edge-2'])

    // И геометрически контур действительно замкнут.
    const last = result.edges[result.edges.length - 1]
    expect(last.to.x).toBeCloseTo(START.x, 1)
    expect(last.to.y).toBeCloseTo(START.y, 1)
  })
})
