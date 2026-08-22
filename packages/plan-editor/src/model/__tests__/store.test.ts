import { describe, it, expect } from 'vitest'
import { createPlanEditorStore } from '../store'
import type { DraftEdge } from '../../geometry/types'

/** Каждый тест получает свой экземпляр стора — без общего счётчика id между тестами. */
function freshStore() {
  return createPlanEditorStore()
}

function draft(from: DraftEdge['from'], to: DraftEdge['to'], angleDeg: number): DraftEdge {
  return { from, to, dir: { angleDeg, snapped: true, snapAngle: angleDeg } }
}

describe('commitDraft', () => {
  it('turns the draft into a FixedEdge, clears the draft, leaves editingEdgeId null — a rough click never auto-opens the editor', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))

    store.getState().commitDraft()
    const s = store.getState()

    expect(s.draftEdge).toBeNull()
    expect(s.fixedEdges).toHaveLength(1)
    expect(s.fixedEdges[0].from).toEqual({ x: 0, y: 0 })
    expect(s.fixedEdges[0].to).toEqual({ x: 500, y: 0 })
    expect(s.fixedEdges[0].angleDeg).toBe(0)
    expect(s.fixedEdges[0].lengthMm).toBeCloseTo(500, 10)
    // Регрессия: раньше здесь стоял editingEdgeId выставленный на новую сторону,
    // что замораживало canDraw (=!isClosed && editingEdgeId===null) сразу после
    // первого клика и убивало A1 (нельзя было продолжить рисовать без явного
    // закрытия вылезшей формы). Рогклик — грубый набросок, рисование продолжается
    // немедленно; правка — только через явный клик по стороне или панель размеров.
    expect(s.editingEdgeId).toBeNull()
  })

  it('a rough click alone never counts as measured — closedByMagnet=false, measured* stay undefined', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))

    store.getState().commitDraft()
    const edge = store.getState().fixedEdges[0]

    expect(edge.closedByMagnet).toBe(false)
    expect(edge.measuredLengthMm).toBeUndefined()
    expect(edge.measuredAngleDeg).toBeUndefined()
  })

  it('is a no-op when draftEdge is null', () => {
    const store = freshStore()
    expect(store.getState().draftEdge).toBeNull()

    store.getState().commitDraft()
    const s = store.getState()

    expect(s.fixedEdges).toHaveLength(0)
    expect(s.editingEdgeId).toBeNull()
  })

  it('ignores a short poke that never left the anchor by more than the on-screen threshold', () => {
    const store = freshStore()
    // viewport.scale=1 (FALLBACK_VIEWPORT) → 1мм = 1px, порог 12px ⇒ 2мм точно ниже него.
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 2, y: 1 }, 26.57))

    store.getState().commitDraft()
    const s = store.getState()

    expect(s.fixedEdges).toHaveLength(0)
    expect(s.editingEdgeId).toBeNull()
    // draftEdge не трогаем — пользователь может продолжать вести мышь дальше.
    expect(s.draftEdge).not.toBeNull()
  })

  it('commits normally once the on-screen length crosses the threshold', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 60, y: 0 }, 0)) // 60px > 12px порог

    store.getState().commitDraft()
    const s = store.getState()

    expect(s.fixedEdges).toHaveLength(1)
    expect(s.fixedEdges[0].lengthMm).toBeCloseTo(60, 10)
  })

  it('the threshold is measured in screen px via viewport.scale, not raw mm', () => {
    const store = freshStore()
    // scale=0.001 ⇒ 1мм = 0.001px. 5000мм в мире дают всего 5px на экране — ниже порога,
    // хотя сам мировой отрезок далеко не "вырожденный" (5 метров).
    store.getState().setViewport({ scale: 0.001 })
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 5000, y: 0 }, 0))

    store.getState().commitDraft()

    expect(store.getState().fixedEdges).toHaveLength(0)
  })

  it('each committed edge gets a distinct id, and the next draft chains from the previous end', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const firstId = store.getState().fixedEdges[0].id

    // Следующая резиновая линия должна стартовать от currentAnchor() = to первой
    const anchor = store.getState().currentAnchor()
    expect(anchor).toEqual({ x: 500, y: 0 })

    store.getState().setDraftEdge(draft(anchor, { x: 500, y: 300 }, 90))
    store.getState().commitDraft()
    const s = store.getState()

    expect(s.fixedEdges).toHaveLength(2)
    expect(s.fixedEdges[1].id).not.toBe(firstId)
    expect(s.fixedEdges[1].from).toEqual({ x: 500, y: 0 })
  })
})

describe('updateEdgeLength', () => {
  it('keeps `from` fixed, places `to` exactly on the ray, sets lengthMm exactly', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id

    store.getState().updateEdgeLength(id, 580)
    const edge = store.getState().fixedEdges[0]

    expect(edge.from).toEqual({ x: 0, y: 0 })
    expect(edge.angleDeg).toBe(0)
    expect(edge.lengthMm).toBe(580)
    expect(edge.to.x).toBeCloseTo(580, 10)
    expect(edge.to.y).toBeCloseTo(0, 10)
  })

  it('typing a number is exactly what makes a side "measured" for adjustContour — sets measuredLengthMm', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id
    expect(store.getState().fixedEdges[0].measuredLengthMm).toBeUndefined()

    store.getState().updateEdgeLength(id, 580)

    expect(store.getState().fixedEdges[0].measuredLengthMm).toBe(580)
  })

  it('editing a non-last edge shifts every edge after it (tail follows)', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const firstId = store.getState().fixedEdges[0].id
    const anchor1 = store.getState().currentAnchor()

    store.getState().setDraftEdge(draft(anchor1, { x: 500, y: 300 }, 90))
    store.getState().commitDraft()
    const anchor2 = store.getState().currentAnchor()

    store.getState().setDraftEdge(draft(anchor2, { x: 900, y: 300 }, 0))
    store.getState().commitDraft()

    // Меняем длину первого звена 500 → 700 (+200 по X)
    store.getState().updateEdgeLength(firstId, 700)
    const [a, b, c] = store.getState().fixedEdges

    expect(a.to).toEqual({ x: 700, y: 0 })
    expect(b.from).toEqual({ x: 700, y: 0 })
    expect(b.to.x).toBeCloseTo(700, 10)
    expect(b.to.y).toBeCloseTo(300, 10)
    expect(c.from.x).toBeCloseTo(700, 10)
    expect(c.lengthMm).toBe(400) // длина хвоста не меняется, только позиция
    expect(c.to.x).toBeCloseTo(1100, 10)
  })

  it('is a no-op for an unknown id', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const before = store.getState().fixedEdges

    store.getState().updateEdgeLength('does-not-exist', 999)

    expect(store.getState().fixedEdges).toEqual(before)
  })

  it('rejects a length below MIN_EDGE_LENGTH_MM as a no-op — typed input bypasses MIN_COMMIT_LENGTH_PX and could otherwise commit a near-duplicate vertex onto a live contour (see pergola-core/contourSanitize.ts for the downstream defect this used to cause)', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id
    const before = store.getState().fixedEdges

    store.getState().updateEdgeLength(id, 0.01)

    expect(store.getState().fixedEdges).toEqual(before)
    expect(store.getState().fixedEdges[0].lengthMm).toBe(500)
  })

  it('rejects zero and negative lengths as a no-op', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id

    store.getState().updateEdgeLength(id, 0)
    store.getState().updateEdgeLength(id, -50)

    expect(store.getState().fixedEdges[0].lengthMm).toBe(500)
  })

  it('accepts a length exactly at MIN_EDGE_LENGTH_MM', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id

    store.getState().updateEdgeLength(id, 1)

    expect(store.getState().fixedEdges[0].lengthMm).toBe(1)
  })
})

describe('updateEdgeAngle', () => {
  it('preserves lengthMm, recomputes direction and tail', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id

    store.getState().updateEdgeAngle(id, 90)
    const edge = store.getState().fixedEdges[0]

    expect(edge.lengthMm).toBeCloseTo(500, 10)
    expect(edge.angleDeg).toBe(90)
    expect(edge.to.x).toBeCloseTo(0, 10)
    expect(edge.to.y).toBeCloseTo(500, 10)
  })

  it('sets measuredAngleDeg — this is what tells adjustContour the angle was actually entered', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id
    expect(store.getState().fixedEdges[0].measuredAngleDeg).toBeUndefined()

    store.getState().updateEdgeAngle(id, 90)

    expect(store.getState().fixedEdges[0].measuredAngleDeg).toBe(90)
  })
})

describe('setEdgeAttachedToWall', () => {
  it('sets attachedToWall on the target edge without touching from/to/lengthMm/angleDeg', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id
    const before = store.getState().fixedEdges[0]

    store.getState().setEdgeAttachedToWall(id, true)
    const after = store.getState().fixedEdges[0]

    expect(after.attachedToWall).toBe(true)
    expect(after.from).toEqual(before.from)
    expect(after.to).toEqual(before.to)
    expect(after.lengthMm).toBe(before.lengthMm)
    expect(after.angleDeg).toBe(before.angleDeg)
  })

  it('toggles back to false', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id

    store.getState().setEdgeAttachedToWall(id, true)
    store.getState().setEdgeAttachedToWall(id, false)

    expect(store.getState().fixedEdges[0].attachedToWall).toBe(false)
  })

  it('only touches the targeted edge, leaves siblings untouched', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    store.getState().setDraftEdge(draft({ x: 500, y: 0 }, { x: 500, y: 500 }, 90))
    store.getState().commitDraft()
    const [firstId, secondId] = store.getState().fixedEdges.map((e) => e.id)

    store.getState().setEdgeAttachedToWall(firstId, true)

    expect(store.getState().fixedEdges.find((e) => e.id === firstId)?.attachedToWall).toBe(true)
    expect(store.getState().fixedEdges.find((e) => e.id === secondId)?.attachedToWall).toBeUndefined()
  })

  it('is a no-op when the edge id does not exist', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const before = store.getState().fixedEdges

    store.getState().setEdgeAttachedToWall('does-not-exist', true)

    expect(store.getState().fixedEdges).toBe(before)
  })
})

describe('currentAnchor', () => {
  it('returns startPoint when the chain is empty', () => {
    const store = freshStore()
    expect(store.getState().currentAnchor()).toEqual(store.getState().startPoint)
  })

  it('returns the `to` of the last fixed edge once something is committed', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()

    expect(store.getState().currentAnchor()).toEqual({ x: 500, y: 0 })
  })
})

describe('closeContour', () => {
  function closingDraft(from: DraftEdge['from'], to: DraftEdge['to'], angleDeg: number): DraftEdge {
    return { from, to, dir: { angleDeg, snapped: false, snapAngle: null }, closesContour: true }
  }

  it('commits the draft as a new FixedEdge and sets isClosed=true', () => {
    const store = freshStore()
    // Первая сторона — обычная, через commitDraft.
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const anchor = store.getState().currentAnchor()

    expect(store.getState().isClosed).toBe(false)

    // Замыкающая — через closeContour, closesContour=true проставлен вызывающим
    // (в реальности — applyStartMagnet), to = startPoint {0,0}.
    store.getState().setDraftEdge(closingDraft(anchor, { x: 0, y: 0 }, 180))
    store.getState().closeContour()
    const s = store.getState()

    expect(s.isClosed).toBe(true)
    expect(s.draftEdge).toBeNull()
    expect(s.fixedEdges).toHaveLength(2)
    expect(s.fixedEdges[1].to).toEqual({ x: 0, y: 0 })
    // isClosed=true уже замораживает canDraw — форма правки не открывается сама.
    expect(s.editingEdgeId).toBeNull()
  })

  it('flags the closing edge with closedByMagnet=true, and leaves measured* unset (magnet is not a typed value)', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const anchor = store.getState().currentAnchor()

    store.getState().setDraftEdge(closingDraft(anchor, { x: 0, y: 0 }, 180))
    store.getState().closeContour()
    const closingEdge = store.getState().fixedEdges[1]

    expect(closingEdge.closedByMagnet).toBe(true)
    expect(closingEdge.measuredLengthMm).toBeUndefined()
    expect(closingEdge.measuredAngleDeg).toBeUndefined()
  })

  it('is a no-op when draftEdge is null', () => {
    const store = freshStore()
    store.getState().closeContour()
    const s = store.getState()

    expect(s.isClosed).toBe(false)
    expect(s.fixedEdges).toHaveLength(0)
  })

  it('is a no-op when draftEdge.closesContour is not true (defends against direct misuse)', () => {
    const store = freshStore()
    // draft() без closesContour — обычное черновое ребро.
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))

    store.getState().closeContour()
    const s = store.getState()

    expect(s.isClosed).toBe(false)
    expect(s.fixedEdges).toHaveLength(0)
    expect(s.draftEdge).not.toBeNull()
  })

  it('does not apply the MIN_COMMIT_LENGTH_PX poke threshold (closing edge can legitimately be short)', () => {
    const store = freshStore()
    // 3мм на scale=1 (FALLBACK_VIEWPORT) — было бы ниже порога commitDraft,
    // но closeContour его не проверяет: это подтверждённое пользователем замыкание.
    store.getState().setDraftEdge(closingDraft({ x: 0, y: 0 }, { x: 3, y: 0 }, 0))

    store.getState().closeContour()
    const s = store.getState()

    expect(s.isClosed).toBe(true)
    expect(s.fixedEdges).toHaveLength(1)
  })
})

describe('closeContourExplicit', () => {
  /** Рисует прямоугольник от {0,0}, оставляя контур открытым (3 стороны, курсор не у startPoint). */
  function drawOpenRectangleThreeSides(store: ReturnType<typeof freshStore>) {
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 400, y: 0 }, 0))
    store.getState().commitDraft()
    const anchor1 = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(anchor1, { x: 400, y: 300 }, 90))
    store.getState().commitDraft()
    const anchor2 = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(anchor2, { x: 0, y: 300 }, 180))
    store.getState().commitDraft()
  }

  it('is a no-op and reports tooFewEdges when there are fewer than 3 sides', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 400, y: 0 }, 0))
    store.getState().commitDraft()
    const anchor = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(anchor, { x: 400, y: 300 }, 90))
    store.getState().commitDraft()

    store.getState().closeContourExplicit()
    const s = store.getState()

    expect(s.isClosed).toBe(false)
    expect(s.fixedEdges).toHaveLength(2)
    expect(s.closeContourError).toBe('tooFewEdges')
  })

  it('closes a valid open contour by adding a geometric closing edge back to startPoint', () => {
    const store = freshStore()
    drawOpenRectangleThreeSides(store)

    store.getState().closeContourExplicit()
    const s = store.getState()

    expect(s.isClosed).toBe(true)
    expect(s.closeContourError).toBeNull()
    expect(s.fixedEdges).toHaveLength(4)
    const closingEdge = s.fixedEdges[3]
    expect(closingEdge.from).toEqual({ x: 0, y: 300 })
    expect(closingEdge.to).toEqual({ x: 0, y: 0 })
    expect(closingEdge.lengthMm).toBeCloseTo(300, 10)
    // Замыкающая — не измерение, как и у магнита.
    expect(closingEdge.closedByMagnet).toBe(true)
    expect(closingEdge.measuredLengthMm).toBeUndefined()
  })

  it('does not add a degenerate zero-length edge when the anchor already coincides with startPoint', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 400, y: 0 }, 0))
    store.getState().commitDraft()
    const anchor1 = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(anchor1, { x: 400, y: 300 }, 90))
    store.getState().commitDraft()
    const anchor2 = store.getState().currentAnchor()
    // Третья сторона уже сама заканчивается точно в startPoint {0,0}.
    store.getState().setDraftEdge(draft(anchor2, { x: 0, y: 0 }, 200))
    store.getState().commitDraft()

    store.getState().closeContourExplicit()
    const s = store.getState()

    expect(s.isClosed).toBe(true)
    expect(s.fixedEdges).toHaveLength(3)
  })

  /**
   * Зигзаг, где именно ЗАМЫКАЮЩЕЕ ребро (а не какая-то из уже нарисованных
   * сторон) пересекает сторону 1→2. P0(0,0) → P1(200,0) → P2(200,200) →
   * P3(300,100); замыкающая P3→P0 идёт от (300,100) к (0,0) и по пути
   * пересекает вертикальный отрезок P1-P2 (x=200, y∈[0,200]) — сама тройка
   * сторон 0..2 не самопересекается, проблема появляется только с четвёртым,
   * замыкающим, ребром.
   */
  function drawZigzagWhoseClosingEdgeCrosses(store: ReturnType<typeof freshStore>) {
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 200, y: 0 }, 0))
    store.getState().commitDraft()
    const a1 = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(a1, { x: 200, y: 200 }, 90))
    store.getState().commitDraft()
    const a2 = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(a2, { x: 300, y: 100 }, 315))
    store.getState().commitDraft()
  }

  it('rejects closing when the closing edge would self-intersect an existing side, and leaves state untouched', () => {
    const store = freshStore()
    drawZigzagWhoseClosingEdgeCrosses(store)

    const before = store.getState().fixedEdges
    store.getState().closeContourExplicit()
    const s = store.getState()

    expect(s.isClosed).toBe(false)
    expect(s.closeContourError).toBe('selfIntersecting')
    expect(s.fixedEdges).toBe(before)
  })

  it('is a no-op when the contour is already closed', () => {
    const store = freshStore()
    drawOpenRectangleThreeSides(store)
    store.getState().closeContourExplicit()
    const closedEdges = store.getState().fixedEdges

    store.getState().closeContourExplicit()
    const s = store.getState()

    expect(s.fixedEdges).toBe(closedEdges)
    expect(s.isClosed).toBe(true)
  })

  it('clears a stale closeContourError once the shape changes (e.g. via updateEdgeLength)', () => {
    const store = freshStore()
    drawZigzagWhoseClosingEdgeCrosses(store)
    store.getState().closeContourExplicit()
    expect(store.getState().closeContourError).toBe('selfIntersecting')

    const id2 = store.getState().fixedEdges[2].id
    store.getState().updateEdgeLength(id2, 10)

    expect(store.getState().closeContourError).toBeNull()
  })
})

describe('adjustAndClose', () => {
  it('is a no-op on an empty contour', () => {
    const store = freshStore()
    store.getState().adjustAndClose()
    const s = store.getState()

    expect(s.fixedEdges).toHaveLength(0)
    expect(s.isClosed).toBe(false)
    expect(s.lastAdjustResult).toBeNull()
  })

  it('replaces fixedEdges with the least-squares result, sets isClosed, records diagnostics', () => {
    const store = freshStore()
    // Две измеренные стороны (числом введённые через updateEdgeLength/Angle) +
    // одна magnet-закрытая, ничем не измеренная — ровно тот сценарий, из-за
    // которого 3A даёт мнимый нулевой gap (см. обсуждение в чате).
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 1000, y: 0 }, 0))
    store.getState().commitDraft()
    const id0 = store.getState().fixedEdges[0].id
    store.getState().updateEdgeLength(id0, 1000)
    store.getState().updateEdgeAngle(id0, 0)

    const anchor1 = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(anchor1, { x: 500, y: 800 }, 122))
    store.getState().commitDraft()
    const id1 = store.getState().fixedEdges[1].id
    store.getState().updateEdgeLength(id1, 943.398)
    store.getState().updateEdgeAngle(id1, 122.0054)

    // Замыкающая — грубо, магнитом, без единого введённого числа.
    const anchor2 = store.getState().currentAnchor()
    store.getState().setDraftEdge({
      from: anchor2,
      to: { x: 0, y: 0 },
      dir: { angleDeg: 200, snapped: false, snapAngle: null },
      closesContour: true,
    })
    store.getState().closeContour()

    store.getState().adjustAndClose()
    const s = store.getState()

    expect(s.isClosed).toBe(true)
    expect(s.fixedEdges).toHaveLength(3)
    expect(s.lastAdjustResult).not.toBeNull()
    expect(s.lastAdjustResult!.converged).toBe(true)
    expect(s.lastAdjustResult!.closureGapMm).toBeLessThan(0.01)
    // Измеренные стороны почти не сдвинулись, magnet-сторона забрала правку.
    expect(Math.abs(s.lastAdjustResult!.residuals[0].lengthResidualMm)).toBeLessThan(0.5)
    expect(Math.abs(s.lastAdjustResult!.residuals[1].lengthResidualMm)).toBeLessThan(0.5)
    expect(s.lastAdjustResult!.residuals[2].wasUnmeasured).toBe(true)
    expect(s.lastAdjustResult!.worstEdgeIndex).not.toBe(2)
    // Контур в сторе действительно замкнут после подстановки уравненных сторон.
    const last = s.fixedEdges[s.fixedEdges.length - 1]
    expect(last.to.x).toBeCloseTo(0, 1)
    expect(last.to.y).toBeCloseTo(0, 1)
  })
})

describe('closeEditor', () => {
  it('clears editingEdgeId without touching fixedEdges', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id
    // Правка — явное действие (клик по стороне/панель размеров), не побочный
    // эффект commitDraft. Открываем её сами, как это делает openEditor из UI.
    store.getState().openEditor(id)
    const edgesBefore = store.getState().fixedEdges

    expect(store.getState().editingEdgeId).not.toBeNull()
    store.getState().closeEditor()

    expect(store.getState().editingEdgeId).toBeNull()
    expect(store.getState().fixedEdges).toEqual(edgesBefore)
  })

  it('also clears draftEdge — прогнивший курсор: A2 держал фокус, pointermove на холст не приходил', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id
    store.getState().openEditor(id) // editingEdgeId выставлен явно
    // Симулируем "протухший" draftEdge — последняя позиция курсора ДО того,
    // как открылось поле A2 (в реальности его туда положил бы recompute()).
    store.getState().setDraftEdge(draft({ x: 500, y: 0 }, { x: 600, y: 0 }, 0))

    store.getState().closeEditor()

    expect(store.getState().draftEdge).toBeNull()
  })
})

describe('openEditor', () => {
  it('sets editingEdgeId to the given id and clears draftEdge (A2 entry via a click on a fixed edge)', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 500, y: 0 }, 0))
    store.getState().commitDraft()
    const id = store.getState().fixedEdges[0].id

    store.getState().setDraftEdge(draft({ x: 500, y: 0 }, { x: 600, y: 100 }, 45))
    store.getState().openEditor(id)

    const s = store.getState()
    expect(s.editingEdgeId).toBe(id)
    expect(s.draftEdge).toBeNull()
  })
})

describe('commitDraftTyped (A1 — Enter с оверрайдом из буфера)', () => {
  it('typed length only: становится measuredLengthMm, editingEdgeId НЕ выставляется', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 100, y: 0 }, 0))

    store.getState().commitDraftTyped({ lengthMm: 5800 })
    const s = store.getState()

    expect(s.fixedEdges).toHaveLength(1)
    const edge = s.fixedEdges[0]
    expect(edge.lengthMm).toBeCloseTo(5800, 6)
    expect(edge.measuredLengthMm).toBe(5800)
    expect(edge.measuredAngleDeg).toBeUndefined()
    expect(edge.closedByMagnet).toBe(false)
    expect(s.editingEdgeId).toBeNull() // ключевое отличие от commitDraft()
    expect(s.draftEdge).toBeNull()
  })

  it('typed angle only: становится measuredAngleDeg, длина остаётся мышиной (не measured)', () => {
    const store = freshStore()
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 100, y: 0 }, 0))

    store.getState().commitDraftTyped({ angleDeg: 66 })
    const edge = store.getState().fixedEdges[0]

    expect(edge.angleDeg).toBe(66)
    expect(edge.measuredAngleDeg).toBe(66)
    expect(edge.measuredLengthMm).toBeUndefined()
    expect(edge.lengthMm).toBeCloseTo(100, 6) // мышиная длина сохранена
  })

  it('is a no-op when draftEdge is null', () => {
    const store = freshStore()
    store.getState().commitDraftTyped({ lengthMm: 1000 })
    expect(store.getState().fixedEdges).toHaveLength(0)
  })

  it('не применяет порог MIN_COMMIT_LENGTH_PX — печать числа это осознанное подтверждение, а не короткий тычок', () => {
    const store = freshStore()
    // 2мм на экране (viewport.scale=1) — ниже порога commitDraft, но пользователь ЯВНО напечатал длину.
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 2, y: 0 }, 0))
    store.getState().commitDraftTyped({ lengthMm: 5800 })
    expect(store.getState().fixedEdges).toHaveLength(1)
    expect(store.getState().fixedEdges[0].lengthMm).toBeCloseTo(5800, 6)
  })

  it('closing edge: typed length переопределяет magnet-геометрию, но isClosed всё равно становится true — честная невязка', () => {
    const store = freshStore()
    // Первая сторона.
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 1000, y: 0 }, 0))
    store.getState().commitDraft()
    // Вторая — магнит "прилип" к startPoint (closesContour: true, to=startPoint).
    const anchor = store.getState().currentAnchor()
    store.getState().setDraftEdge({
      from: anchor,
      to: { x: 0, y: 0 },
      dir: { angleDeg: 180, snapped: true, snapAngle: 180 },
      closesContour: true,
    })

    store.getState().commitDraftTyped({ lengthMm: 1050 }) // пользователь измерил РЕАЛЬНО 1050, не 1000
    const s = store.getState()

    expect(s.isClosed).toBe(true)
    expect(s.fixedEdges).toHaveLength(2)
    const closingEdge = s.fixedEdges[1]
    expect(closingEdge.lengthMm).toBeCloseTo(1050, 6)
    expect(closingEdge.measuredLengthMm).toBe(1050)
    expect(closingEdge.closedByMagnet).toBe(false) // геометрия больше не навязана UI — это измерение
    expect(closingEdge.to).not.toEqual({ x: 0, y: 0 }) // честная невязка, а не подмена на startPoint
  })
})

describe('cancelAdjust / acceptAdjust', () => {
  function threeSideTriangle(store: ReturnType<typeof freshStore>) {
    store.getState().setDraftEdge(draft({ x: 0, y: 0 }, { x: 1000, y: 0 }, 0))
    store.getState().commitDraft()
    store.getState().updateEdgeLength(store.getState().fixedEdges[0].id, 1000)
    store.getState().updateEdgeAngle(store.getState().fixedEdges[0].id, 0)
    store.getState().closeEditor()

    const a1 = store.getState().currentAnchor()
    store.getState().setDraftEdge(draft(a1, { x: 1000, y: 800 }, 90))
    store.getState().commitDraft()
    store.getState().updateEdgeLength(store.getState().fixedEdges[1].id, 800)
    store.getState().updateEdgeAngle(store.getState().fixedEdges[1].id, 90)
    store.getState().closeEditor()

    const a2 = store.getState().currentAnchor()
    store.getState().setDraftEdge({
      from: a2,
      to: { x: 0, y: 0 },
      dir: { angleDeg: 200, snapped: false, snapAngle: null },
      closesContour: true,
    })
    store.getState().closeContour()
  }

  it('adjustAndClose captures a preAdjustSnapshot; cancelAdjust restores fixedEdges/isClosed and clears lastAdjustResult', () => {
    const store = freshStore()
    threeSideTriangle(store)
    const edgesBeforeAdjust = store.getState().fixedEdges

    store.getState().adjustAndClose()
    expect(store.getState().lastAdjustResult).not.toBeNull()
    expect(store.getState().preAdjustSnapshot).not.toBeNull()

    store.getState().cancelAdjust()
    const s = store.getState()

    expect(s.fixedEdges).toEqual(edgesBeforeAdjust)
    expect(s.lastAdjustResult).toBeNull()
    expect(s.preAdjustSnapshot).toBeNull()
  })

  it('cancelAdjust is a no-op when there is no snapshot (adjustAndClose never ran)', () => {
    const store = freshStore()
    threeSideTriangle(store)
    const edgesBefore = store.getState().fixedEdges

    store.getState().cancelAdjust()

    expect(store.getState().fixedEdges).toEqual(edgesBefore)
  })

  it('acceptAdjust keeps the adjusted fixedEdges and only clears preAdjustSnapshot', () => {
    const store = freshStore()
    threeSideTriangle(store)

    store.getState().adjustAndClose()
    const adjustedEdges = store.getState().fixedEdges

    store.getState().acceptAdjust()
    const s = store.getState()

    expect(s.fixedEdges).toEqual(adjustedEdges)
    expect(s.lastAdjustResult).not.toBeNull() // результат остаётся видимым для панели
    expect(s.preAdjustSnapshot).toBeNull()
  })
})

describe('acceptance test — реальный замер L-образной перголы (часть 1 доп. промпта про панель размеров)', () => {
  it('после ввода всех 6 реальных длин (580/624.9/1085.6/422.6/598.6/443.1 см) через updateEdgeLength — measuredLengthMm заполнен у всех сторон, солвер даёт конкретную невязку и конкретного подозреваемого, а не «весь контур жёлтый»', () => {
    const store = freshStore()

    // Грубый набросок мышью: L-образный контур, 5 выпуклых поворотов на 90° и
    // один вогнутый на 270° ("подмышка" L) — направления те, что даёт ortho-
    // привязка (dir.snapped=true у всех, как в draft()). Номинальные длины
    // наброска (500мм) НЕ важны — их целиком перепишет ввод реальных чисел.
    const dirsDeg = [0, 90, 180, 90, 180, 270]
    const roughLengthMm = 500

    let anchor = store.getState().startPoint
    for (let i = 0; i < 5; i++) {
      const rad = (dirsDeg[i] * Math.PI) / 180
      const to = { x: anchor.x + roughLengthMm * Math.cos(rad), y: anchor.y + roughLengthMm * Math.sin(rad) }
      store.getState().setDraftEdge(draft(anchor, to, dirsDeg[i]))
      store.getState().commitDraft()
      anchor = store.getState().currentAnchor()
    }
    // Замыкающая сторона — магнит тянет to точно в startPoint, как в реальном
    // UI (applyStartMagnet), независимо от номинального угла наброска.
    store.getState().setDraftEdge({
      from: anchor,
      to: store.getState().startPoint,
      dir: { angleDeg: dirsDeg[5], snapped: true, snapAngle: dirsDeg[5] },
      closesContour: true,
    })
    store.getState().closeContour()

    expect(store.getState().fixedEdges).toHaveLength(6)
    expect(store.getState().isClosed).toBe(true)

    // Оператор приехал с рулеткой и вбивает 6 чисел подряд — ровно то, что
    // делает панель «Изменить размеры» на каждый blur/Enter поля длины.
    const measuredCm = [580, 624.9, 1085.6, 422.6, 598.6, 443.1]
    const ids = store.getState().fixedEdges.map((e) => e.id)
    ids.forEach((id, i) => {
      store.getState().updateEdgeLength(id, measuredCm[i] * 10)
    })

    const beforeAdjust = store.getState()
    // Ключевое условие из формулировки бага: measuredLengthMm заполнен у ВСЕХ
    // шести сторон — до фикса commitDraft/closeContour это было недостижимо
    // штатным путём (форма правки открывалась на каждой стороне и обычно
    // просто закрывалась Escape, не подтверждая число).
    beforeAdjust.fixedEdges.forEach((e, i) => {
      expect(e.measuredLengthMm).toBeCloseTo(measuredCm[i] * 10, 6)
    })

    store.getState().adjustAndClose()
    const result = store.getState().lastAdjustResult
    expect(result).not.toBeNull()
    expect(result!.converged).toBe(true)
    expect(result!.closureGapMm).toBeLessThan(0.01)
    // Реальный замер прямыми углами почти никогда не закрывается идеально —
    // до уравнивания должен быть настоящий, не мнимый нулевой, зазор.
    expect(result!.initialGapMm).toBeGreaterThan(1)

    // "Осмысленный результат" из промпта: конкретная подозрительная сторона
    // (или пустой список кандидатов — однозначный виновник), а НЕ весь контур
    // одинаково жёлтый. Все 6 сторон "измерены" (measuredLengthMm), поэтому
    // ни одна не исключена из рассмотрения как wasUnmeasured — worstEdgeIndex
    // обязан найти конкретного кандидата.
    expect(result!.worstEdgeIndex).not.toBeNull()
    expect(result!.ambiguousCandidates.length).toBeLessThan(6)
    result!.residuals.forEach((r) => expect(r.wasUnmeasured).toBe(false))
  })
})
