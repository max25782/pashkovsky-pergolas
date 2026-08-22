import { create } from 'zustand'
import { computeFitToScreenViewport, distance, mmToPx } from '../geometry/coords'
import { rebuildChain, currentAnchor as computeCurrentAnchor, toPolygon } from '../geometry/chain'
import { adjustContour } from '../geometry/adjust'
import { finalizeDraftEdge } from '../geometry/draftEdge'
import { normalizeAngle } from '../geometry/snap'
import { isSimplePolygon } from '../geometry/selfIntersection'
import type { CanvasSize, DraftEdge, Viewport, WorldBounds, FixedEdge, DraftOverride, LengthUnit } from '../geometry/types'
import type { PlanEditorState } from './types'

/**
 * Стартовая точка контура. Мировое значение {0,0} выбрано не случайно:
 * первая сторона считается от нуля, что упрощает отладку. Позиция на экране
 * определяется исключительно viewport (pan), а не самой точкой — см. initViewport.
 */
const START_POINT = { x: 0, y: 0 }

/**
 * Половина стороны условной рабочей области вокруг стартовой точки, мм.
 * Используется только для первичного fit-to-screen, пока на холсте нет
 * ни одного реального ребра — как только появятся первые стороны контура,
 * bounds для fit будут пересчитываться из фактической геометрии (следующий шаг).
 */
const INITIAL_WORLD_HALF_SIZE_MM = 5000

function initialWorldBounds(): WorldBounds {
  return {
    minX: START_POINT.x - INITIAL_WORLD_HALF_SIZE_MM,
    minY: START_POINT.y - INITIAL_WORLD_HALF_SIZE_MM,
    maxX: START_POINT.x + INITIAL_WORLD_HALF_SIZE_MM,
    maxY: START_POINT.y + INITIAL_WORLD_HALF_SIZE_MM,
  }
}

/** Заглушка viewport до первого вызова initViewport (реального canvasSize ещё нет). */
const FALLBACK_VIEWPORT: Viewport = { scale: 1, panX: 0, panY: 0 }

/**
 * Порог фиксации стороны, экранные px. Задача — отличить «клик без отъезда
 * курсора от якоря» (двойной клик, клик сразу после предыдущего коммита,
 * когда курсор физически ещё стоит на новом якоре) от осмысленного, но
 * короткого ребра. Живая проверка на стенде: при типичном fit-to-screen
 * зуме (весь план ~10×10 м в окне) порог в 50px отбрасывал вполне реальную
 * сторону в 700мм (~35px на экране) — слишком агрессивно. 12px — это про
 * моторную точность клика (сравнимо с порогом click-vs-drag в браузерных
 * и CAD-редакторах), а не про «маленькое, но настоящее» ребро.
 * Ниже порога commitDraft — no-op, ровно как при draftEdge === null;
 * draftEdge остаётся живым, пользователь просто продолжает вести мышь.
 */
const MIN_COMMIT_LENGTH_PX = 12

/**
 * Общий геометрический порог «это ребро вырождено» (мм), НЕ про моторику
 * клика (в отличие от MIN_COMMIT_LENGTH_PX и порога магнита) — используется
 * в двух местах:
 *
 *   1. closeContourExplicit: если разрыв между текущим якорем и startPoint
 *      меньше этого порога, контур геометрически сошёлся сам (последняя
 *      сторона случайно/специально закончилась ровно в startPoint) —
 *      лишнее вырожденное ребро длиной ~0 не добавляем, просто выставляем
 *      isClosed.
 *
 *   2. updateEdgeLength: правка уже зафиксированной стороны через
 *      EdgeEditor/SizesPanel (числовой ввод) до сих пор проверяла только
 *      `mm > 0` — этого достаточно для мыши (MIN_COMMIT_LENGTH_PX уже
 *      отфильтровал моторный шум ДО фиксации), но числовой ввод не проходит
 *      через commitDraft вообще, так что пользователь мог напечатать
 *      "0.01" и получить почти дубль-вершину на живой, уже гладкой стороне —
 *      именно так дубль-вершина попадает в контур, ломает
 *      decomposeIntoRectangles (схлопывается в bounding box) и линия лезет
 *      в крыло (см. contourSanitize.ts в pergola-core, где та же дырка
 *      закрыта как защита на входе в ядро — здесь она закрывается у
 *      источника, чтобы грязь не создавалась вовсе).
 */
export const MIN_EDGE_LENGTH_MM = 1

/**
 * Применяет `updater` к стороне `id` в fixedEdges и прогоняет весь результат
 * через rebuildChain от startPoint. Общий путь для updateEdgeLength и
 * updateEdgeAngle: оба меняют ровно одно поле у ровно одного звена, но
 * ОБЯЗАНЫ пересобрать весь хвост, а не только тронутое звено — иначе
 * следующие стороны останутся висеть на старых from/to.
 */
function applyEdgePatch(
  edges: FixedEdge[],
  startPoint: FixedEdge['from'],
  id: string,
  patch: Partial<Pick<FixedEdge, 'angleDeg' | 'lengthMm' | 'measuredAngleDeg' | 'measuredLengthMm'>>,
): FixedEdge[] | null {
  const idx = edges.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const patched = edges.map((e, i) => (i === idx ? { ...e, ...patch } : e))
  return rebuildChain(patched, startPoint)
}

/**
 * Общая часть commitDraft/closeContour: DraftEdge → FixedEdge с новым id.
 * measuredLengthMm/measuredAngleDeg здесь намеренно НЕ проставляются — и
 * грубый клик мышью (commitDraft), и магнит замыкания (closeContour) дают
 * лишь предварительную/навязанную геометрию, а не число, которое пользователь
 * подтвердил явно. См. FixedEdge в geometry/types.ts.
 *
 * angleSnapped, напротив, переносится из draftEdge.dir.snapped как есть: это
 * тот же флаг, что уже красит резиновую линию зелёной (RubberEdge) — здесь он
 * просто доживает до commit, а не пересчитывается заново. Для closeContour
 * (магнит) он тоже честно берётся из dir.snapped на момент клика — если
 * магнит сработал НЕ в точке ortho/polar-привязки, dir.snapped там уже false.
 */
function buildFixedEdgeFromDraft(draftEdge: DraftEdge, id: string, closedByMagnet: boolean): FixedEdge {
  return {
    id,
    from: draftEdge.from,
    to: draftEdge.to,
    angleDeg: draftEdge.dir.angleDeg,
    lengthMm: distance(draftEdge.from, draftEdge.to),
    closedByMagnet,
    angleSnapped: draftEdge.dir.snapped,
  }
}

/**
 * A1: DraftEdge (уже пропущенный через finalizeDraftEdge с оверрайдом) →
 * FixedEdge. closedByMagnet ВСЕГДА false здесь — даже если исходный draftEdge
 * замыкал контур магнитом: печать числа означает, что геометрия стороны
 * больше не навязана UI, а взята из явного ввода (для напечатанного поля)
 * либо из мыши (для ненапечатанного, как обычный свободный клик) — в обоих
 * случаях `to` посчитан finalizeDraftEdge от from+угол+длина, а не
 * склонирован из magnet-снапнутого to. measured* проставляются РОВНО для
 * тех полей, что были в override — не угадываем «раз напечатал одно, значит
 * и другое тоже точное».
 */
function buildFixedEdgeFromTypedDraft(finalized: DraftEdge, id: string, override: DraftOverride): FixedEdge {
  return {
    id,
    from: finalized.from,
    to: finalized.to,
    angleDeg: finalized.dir.angleDeg,
    lengthMm: distance(finalized.from, finalized.to),
    closedByMagnet: false,
    angleSnapped: finalized.dir.snapped,
    measuredLengthMm: override.lengthMm,
    measuredAngleDeg: override.angleDeg,
  }
}

/**
 * Фабрика стора — не только singleton `usePlanEditorStore`, но и отдельная
 * функция, чтобы тесты могли создавать чистый экземпляр без общего
 * состояния (счётчик id, fixedEdges) между тест-кейсами.
 */
export function createPlanEditorStore() {
  let nextEdgeId = 0

  return create<PlanEditorState>((set, get) => ({
    viewport: FALLBACK_VIEWPORT,
    startPoint: START_POINT,
    draftEdge: null,
    fixedEdges: [],
    editingEdgeId: null,
    isClosed: false,
    lastAdjustResult: null,
    preAdjustSnapshot: null,
    closeContourError: null,
    // По умолчанию см — реальные замеры с объекта почти всегда ведутся в см
    // (см. коммент к setInputUnit в model/types.ts); мм — редкий явный выбор.
    inputUnit: 'cm',
    hoveredEdgeId: null,

    initViewport: (canvasSize: CanvasSize) => {
      const viewport = computeFitToScreenViewport(initialWorldBounds(), canvasSize)
      set({ viewport })
    },

    setViewport: (patch) => set((s) => ({ viewport: { ...s.viewport, ...patch } })),

    setInputUnit: (unit: LengthUnit) => set({ inputUnit: unit }),

    setDraftEdge: (edge) => set({ draftEdge: edge }),

    setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),

    currentAnchor: () => {
      const s = get()
      return computeCurrentAnchor(s.fixedEdges, s.startPoint)
    },

    commitDraft: () => {
      const { draftEdge, viewport } = get()
      if (!draftEdge) return
      const lengthMm = distance(draftEdge.from, draftEdge.to)
      // Короткий тычок без осмысленного отъезда курсора — игнорируем клик
      // целиком (draftEdge остаётся как есть, пользователь может продолжать
      // вести мышь дальше). См. MIN_COMMIT_LENGTH_PX.
      if (mmToPx(lengthMm, viewport) < MIN_COMMIT_LENGTH_PX) return
      const id = `edge-${nextEdgeId++}`
      const newEdge = buildFixedEdgeFromDraft(draftEdge, id, false)
      // editingEdgeId НЕ выставляем: рогклик — это режим грубого наброска
      // (см. коммент к buildFixedEdgeFromDraft), рисование должно продолжаться
      // сразу же следующим кликом/печатью, а не замирать на форме правки после
      // каждой стороны. Раньше здесь стоял editingEdgeId: id — это ломало A1
      // (после первого клика canDraw становился false навсегда, пока пользователь
      // не закрывал вылезшую форму) и объясняло, почему measuredLengthMm никогда
      // не заполнялся: пользователь не понимал, зачем открылась форма, и просто
      // жал Escape (что закрывает без применения) вместо явного Enter. Правка
      // существующей стороны теперь только через явное действие — клик по уже
      // зафиксированной стороне (openEditor) или через панель «Изменить размеры».
      set((s) => ({
        fixedEdges: [...s.fixedEdges, newEdge],
        draftEdge: null,
        // Форма изменилась — старое сообщение о самопересечении (если было)
        // могло относиться к уже не существующей конфигурации сторон.
        closeContourError: null,
      }))
    },

    closeContour: () => {
      const { draftEdge } = get()
      // closesContour гарантируется вызывающим (input-слой применяет
      // applyStartMagnet перед setDraftEdge) — здесь просто защита от
      // случайного прямого вызова с неподходящим draftEdge.
      if (!draftEdge || !draftEdge.closesContour) return
      const id = `edge-${nextEdgeId++}`
      const newEdge = buildFixedEdgeFromDraft(draftEdge, id, true)
      // Аналогично commitDraft — editingEdgeId не выставляем. isClosed=true уже
      // само по себе замораживает canDraw; форма правки открывается только явно.
      set((s) => ({
        fixedEdges: [...s.fixedEdges, newEdge],
        draftEdge: null,
        isClosed: true,
      }))
    },

    /**
     * Явное замыкание контура — кнопка «Замкнуть контур», а не магнит.
     * (Двойной клик по холсту как альтернативный триггер рассмотрен и
     * отклонён — см. комментарий в view-svg/PlanCanvas.tsx: браузер шлёт два
     * обычных click ДО dblclick, они успевают закоммитить лишнее ребро.)
     * Устраняет архитектурную дыру: раньше isClosed мог
     * стать true ТОЛЬКО попаданием курсора в узкую зону магнита у startPoint —
     * при типичном fit-to-screen зуме это моторно сложная цель, и не было
     * вообще никакого другого пути замкнуть контур (см. отчёт диагностики
     * промпта «кнопка В 3D не срабатывает»).
     *
     * В отличие от closeContour (магнит), замыкающая сторона здесь считается
     * геометрически — от текущего якоря напрямую к startPoint, а не берётся
     * из draftEdge под курсором (пользователь мог кликнуть кнопку, когда
     * курсор вообще не над холстом).
     *
     * Самопересечение проверяется ПЕРЕД записью в fixedEdges: явная кнопка,
     * в отличие от магнита, готова замкнуть любой набор сторон, включая
     * зигзаг, где замыкающее ребро пересечёт уже нарисованные — такой полигон
     * невалиден для ядра (offset/миттеры дадут мусор на пересекающихся
     * рёбрах). При неудаче isClosed НЕ становится true, fixedEdges не меняются,
     * причина кладётся в closeContourError для UI (см. AdjustPanel).
     */
    closeContourExplicit: () => {
      const { fixedEdges, startPoint, isClosed } = get()
      if (isClosed) return
      if (fixedEdges.length < 3) {
        set({ closeContourError: 'tooFewEdges' })
        return
      }

      const anchor = computeCurrentAnchor(fixedEdges, startPoint)
      const gapToStartMm = distance(anchor, startPoint)

      let candidateEdges = fixedEdges
      if (gapToStartMm > MIN_EDGE_LENGTH_MM) {
        const angleToStartDeg = normalizeAngle(
          (Math.atan2(startPoint.y - anchor.y, startPoint.x - anchor.x) * 180) / Math.PI,
        )
        const closingEdge: FixedEdge = {
          id: `edge-${nextEdgeId++}`,
          from: anchor,
          to: startPoint,
          angleDeg: angleToStartDeg,
          lengthMm: gapToStartMm,
          closedByMagnet: true,
        }
        candidateEdges = [...fixedEdges, closingEdge]
      }

      if (!isSimplePolygon(toPolygon(candidateEdges))) {
        set({ closeContourError: 'selfIntersecting' })
        return
      }

      set({
        fixedEdges: candidateEdges,
        draftEdge: null,
        isClosed: true,
        closeContourError: null,
      })
    },

    commitDraftTyped: (override: DraftOverride) => {
      const { draftEdge } = get()
      if (!draftEdge) return
      const finalized = finalizeDraftEdge(draftEdge, override)
      const id = `edge-${nextEdgeId++}`
      const newEdge = buildFixedEdgeFromTypedDraft(finalized, id, override)
      set((s) => ({
        fixedEdges: [...s.fixedEdges, newEdge],
        draftEdge: null,
        // editingEdgeId намеренно НЕ трогаем — введённое число уже точное.
        isClosed: s.isClosed || draftEdge.closesContour === true,
        closeContourError: null,
      }))
    },

    updateEdgeLength: (id: string, mm: number) => {
      // Ниже MIN_EDGE_LENGTH_MM — числовой ввод, минующий MIN_COMMIT_LENGTH_PX,
      // создал бы вырожденную/почти-дубль вершину прямо на живом контуре (см.
      // комментарий у MIN_EDGE_LENGTH_MM). No-op, как и при id не найден —
      // сторона остаётся с прежней длиной, а не схлопывается.
      if (!(mm >= MIN_EDGE_LENGTH_MM)) return
      set((s) => {
        // measuredLengthMm = mm: пользователь только что подтвердил это число
        // явным вводом — с этого момента сторона учитывается в adjustContour
        // как измеренная (высокий вес), а не свободная.
        const rebuilt = applyEdgePatch(s.fixedEdges, s.startPoint, id, {
          lengthMm: mm,
          measuredLengthMm: mm,
        })
        return rebuilt ? { fixedEdges: rebuilt, closeContourError: null } : {}
      })
    },

    updateEdgeAngle: (id: string, deg: number) => {
      set((s) => {
        const rebuilt = applyEdgePatch(s.fixedEdges, s.startPoint, id, {
          angleDeg: deg,
          measuredAngleDeg: deg,
        })
        return rebuilt ? { fixedEdges: rebuilt, closeContourError: null } : {}
      })
    },

    setEdgeAttachedToWall: (id: string, attachedToWall: boolean) => {
      set((s) => {
        const idx = s.fixedEdges.findIndex((e) => e.id === id)
        if (idx === -1) return {}
        // Чисто пользовательский флаг, не геометрия — правим точечно, без
        // rebuildChain (from/to/lengthMm/angleDeg не меняются).
        const fixedEdges = s.fixedEdges.map((e, i) =>
          i === idx ? { ...e, attachedToWall } : e,
        )
        return { fixedEdges }
      })
    },

    openEditor: (id: string) => set({ editingEdgeId: id, draftEdge: null }),

    closeEditor: () => set({ editingEdgeId: null, draftEdge: null }),

    adjustAndClose: () => {
      const { fixedEdges, startPoint, isClosed } = get()
      if (fixedEdges.length === 0) return
      const result = adjustContour(fixedEdges, startPoint)
      set({
        fixedEdges: result.edges,
        isClosed: true,
        lastAdjustResult: result,
        preAdjustSnapshot: { edges: fixedEdges, isClosed },
      })
    },

    cancelAdjust: () => {
      const snapshot = get().preAdjustSnapshot
      if (!snapshot) return
      set({
        fixedEdges: snapshot.edges,
        isClosed: snapshot.isClosed,
        lastAdjustResult: null,
        preAdjustSnapshot: null,
      })
    },

    acceptAdjust: () => set({ preAdjustSnapshot: null }),
  }))
}

export const usePlanEditorStore = createPlanEditorStore()
