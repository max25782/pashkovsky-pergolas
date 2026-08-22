import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react'
import { screenToWorld } from '../geometry/coords'
import { buildDraftEdge } from '../geometry/draftEdge'
import { applyStartMagnet, DEFAULT_MAGNET_THRESHOLD_PX } from '../geometry/closure'
import type { DraftEdge, Point, Modifiers, SnapConfig, Viewport } from '../geometry/types'
import { usePlanEditorStore } from '../model/store'
import {
  EMPTY_DYNAMIC_INPUT_BUFFER,
  appendDigit,
  backspace as backspaceBuffer,
  switchField,
  isBufferEmpty,
  parseBufferOverride,
  type DynamicInputBufferState,
} from './dynamicInputBuffer'

interface UsePlanEditorInputOptions {
  svgRef: RefObject<SVGSVGElement>
  /** Стартовая точка текущего чернового ребра (мм, мировые координаты). */
  from: Point
  viewport: Viewport
  snapConfig: SnapConfig
  /** Стартовая вершина всего контура (мм) — цель магнита замыкания. */
  startPoint: Point
  /**
   * Гейт магнита замыкания — обычно `fixedEdges.length >= 2 && !isClosed`.
   * Считается снаружи (у этого хука нет доступа к количеству сторон), чтобы
   * не размазывать правило "когда можно замыкать" по двум местам.
   */
  canClose: boolean
  /**
   * Единый предикат "разрешено ли сейчас рисование" — `!isClosed &&
   * editingEdgeId === null`. Считается СНАРУЖИ (см. PlanCanvas) РОВНО ОДИН
   * РАЗ и передаётся сюда — вместо того чтобы каждый обработчик в этом хуке
   * заново собирал те же два условия. Единая точка входа: `false` замораживает
   * И резиновую линию (recompute/onClick — ранний выход), И весь буфер
   * динамического ввода A1 (клавиши игнорируются целиком) — это чинит ровно
   * тот баг, что наблюдался живьём: isClosed=true/editingEdgeId!==null, а
   * резиновая линия продолжала крутиться за курсором.
   */
  canDraw: boolean
  /** Порог магнита, экранные px. По умолчанию DEFAULT_MAGNET_THRESHOLD_PX. */
  magnetThresholdPx?: number
}

interface UsePlanEditorInputResult {
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void
  /**
   * Клик по холсту фиксирует текущую резиновую линию — commitDraft() обычно,
   * closeContour() если она прилипла к startPoint магнитом замыкания. Решение
   * "какую из двух вызвать" считается заново от lastCursorWorldRef В МОМЕНТ
   * КЛИКА (см. buildCurrentDraftEdge) — НЕ от React-состояния draftEdge, которое
   * на один рендер позади реального DOM-события. No-op, если курсор ещё не
   * заходил на холст (buildCurrentDraftEdge вернёт null), а также если canDraw
   * сейчас false.
   */
  onClick: () => void
  /**
   * Текущий буфер A1 — реактивное зеркало ref-состояния, ИСКЛЮЧИТЕЛЬНО для
   * отрисовки бейджа у резиновой линии (см. view-svg/DynamicInputBadge.tsx).
   * Источник истины для коммита — сам ref внутри хука, не это значение
   * (оно всегда синхронизируется сразу после мутации рефа, см. setBuffer).
   */
  dynamicInputBuffer: DynamicInputBufferState
}

/**
 * Единственный источник истины для модификаторов — ref-флаги { lockOrtho, freeform },
 * которые ведутся из keydown/keyup/blur на window. onPointerMove их лишь
 * синхронизирует из e.shiftKey/e.altKey перед recompute() — это чинит
 * рассинхрон, если какой-то keyup потерялся (см. случай потери фокуса окна).
 *
 * Четыре граничных случая, обязательных для этого слоя:
 *   1. keydown/keyup — на window, а не на SVG (SVG часто не в фокусе).
 *   2. window blur с зажатым модификатором — сбрасываем оба флага в false.
 *   3. recompute() без известной позиции курсора — раннийвыход, никакого NaN.
 *   4. onPointerMove синхронизирует ref-флаги из события — событие всегда
 *      достовернее накопленного состояния (лечит случай 2, если что-то потерялось).
 *
 * Пятый — canDraw (шаг 3C, часть A0): единый предикат "рисование разрешено"
 * гейтит recompute/onClick И весь буфер A1 одним early-return — см. коммент
 * к UsePlanEditorInputOptions.canDraw.
 */
export function usePlanEditorInput({
  svgRef,
  from,
  viewport,
  snapConfig,
  startPoint,
  canClose,
  canDraw,
  magnetThresholdPx = DEFAULT_MAGNET_THRESHOLD_PX,
}: UsePlanEditorInputOptions): UsePlanEditorInputResult {
  const setDraftEdge = usePlanEditorStore((s) => s.setDraftEdge)
  const commitDraft = usePlanEditorStore((s) => s.commitDraft)
  const closeContour = usePlanEditorStore((s) => s.closeContour)
  const commitDraftTyped = usePlanEditorStore((s) => s.commitDraftTyped)
  const inputUnit = usePlanEditorStore((s) => s.inputUnit)

  const lastCursorWorldRef = useRef<Point | null>(null)
  const modsRef = useRef<Modifiers>({ lockOrtho: false, freeform: false })

  // Буфер A1 — ref — авторитетный источник для коммита (не отстаёт от событий
  // между рендерами), плюс параллельный useState — ИСКЛЮЧИТЕЛЬНО чтобы бейдж
  // у резиновой линии перерисовывался на каждое нажатие. Не в zustand: это
  // transient-состояние ввода конкретно этого хука, а не часть модели плана
  // (см. коммент к DraftOverride в geometry/types.ts).
  const bufferRef = useRef<DynamicInputBufferState>(EMPTY_DYNAMIC_INPUT_BUFFER)
  const [bufferDisplay, setBufferDisplay] = useState<DynamicInputBufferState>(EMPTY_DYNAMIC_INPUT_BUFFER)

  const setBuffer = useCallback((next: DynamicInputBufferState) => {
    bufferRef.current = next
    setBufferDisplay(next)
  }, [])

  const resetBuffer = useCallback(() => setBuffer(EMPTY_DYNAMIC_INPUT_BUFFER), [setBuffer])

  /**
   * Единая точка построения чернового ребра — от lastCursorWorldRef (актуальная
   * позиция курсора В МОМЕНТ ВЫЗОВА, а не замороженная в React-рендере), а не
   * от какого-либо селектора стора. recompute() и onClick вызывают ЭТУ ЖЕ
   * функцию — так угол резиновой линии и решение "замыкает ли клик контур"
   * считаются буквально одним и тем же путём, а не двумя параллельными,
   * которые могут разойтись по времени.
   */
  const buildCurrentDraftEdge = useCallback((): DraftEdge | null => {
    const cursor = lastCursorWorldRef.current
    // Случай 3: клавиша/клик раньше, чем курсор зашёл на холст —
    // ничего не резолвим, чтобы не получить NaN-угол из resolveDirection(from, null, ...).
    if (cursor == null) return null
    const rawEdge = buildDraftEdge(from, cursor, modsRef.current, snapConfig)
    return applyStartMagnet(rawEdge, startPoint, viewport, canClose, magnetThresholdPx)
  }, [from, snapConfig, startPoint, viewport, canClose, magnetThresholdPx])

  const recompute = useCallback(() => {
    // canDraw=false — рисование заморожено (открыт A2 или контур уже замкнут):
    // ни резиновая линия, ни буфер A1 не должны реагировать на курсор/клавиши.
    if (!canDraw) return
    const edge = buildCurrentDraftEdge()
    if (edge) setDraftEdge(edge)
  }, [canDraw, buildCurrentDraftEdge, setDraftEdge])

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      lastCursorWorldRef.current = screenToWorld(screenPt, viewport)

      // Случай 4: move несёт правду — синхронизируем флаги из события.
      // Если keyup потерялся (случай 2 произошёл, но blur почему-то не сработал —
      // например, окно не терявшее фокус, а просто keyup ушёл в другой элемент),
      // любое движение мыши восстанавливает корректное состояние модификаторов.
      modsRef.current = { lockOrtho: e.shiftKey, freeform: e.altKey }

      recompute()
    },
    [svgRef, viewport, recompute],
  )

  // Клик: пересчитываем ребро ТЕМ ЖЕ способом, что recompute() — от рефа,
  // а не читаем draftEdge из React-состояния. React-состояние обновляется через
  // setDraftEdge из recompute(), но САМ РЕНДЕР компонента (и пересборка этого
  // onClick с новым замыканием) — асинхронен относительно DOM-событий; при двух
  // синтетических событиях подряд без паузы (или просто по неудачному таймингу
  // рендера) можно кликнуть ПОСЛЕ того, как курсор фактически вошёл в магнит-зону,
  // но ДО того, как React перерисовал этот хук с обновлённым draftEdge —
  // тогда `draftEdge?.closesContour` в замыкании onClick был бы ещё false,
  // и клик уходил бы в commitDraft() вместо closeContour(). lastCursorWorldRef —
  // обычный mutable-реф, не React-состояние, поэтому у него нет этой задержки:
  // он всегда отражает то же самое "сейчас", что видел последний pointermove.
  //
  // setDraftEdge(edge) здесь — не дублирование recompute на всякий случай, а
  // гарантия: commitDraft/closeContour ниже читают draftEdge из стора через
  // get(), и эта строка гарантирует, что там окажется именно то ребро, решение
  // по которому мы только что приняли — без неявного (хоть и обычно верного)
  // предположения, что более ранний recompute() уже успел записать то же самое.
  const onClick = useCallback(() => {
    if (!canDraw) return
    const edge = buildCurrentDraftEdge()
    if (!edge) return
    setDraftEdge(edge)
    if (edge.closesContour) closeContour()
    else commitDraft()
    // Мышиный клик — это НЕ печать числа: если буфер A1 что-то накопил, но
    // пользователь кликнул мимо (например Shift+клик для орто), клик всё
    // равно коммитит по-старому (мышиной длиной/углом), а недопечатанный
    // буфер сбрасываем — иначе он молча "прилипнет" к следующей стороне.
    resetBuffer()
  }, [canDraw, buildCurrentDraftEdge, setDraftEdge, closeContour, commitDraft, resetBuffer])

  // A1 — Enter: коммитит текущий draftEdge с оверрайдом из буфера (если он не
  // пуст). Полностью пустой буфер — no-op: Enter без единой напечатанной
  // цифры не подменяет обычный клик, это намеренно два разных действия
  // (см. UsePlanEditorInputResult.onClick).
  const commitTyped = useCallback(() => {
    if (!canDraw) return
    if (isBufferEmpty(bufferRef.current)) return
    const edge = buildCurrentDraftEdge()
    if (!edge) return
    const override = parseBufferOverride(bufferRef.current, inputUnit)
    setDraftEdge(edge)
    commitDraftTyped(override)
    resetBuffer()
  }, [canDraw, buildCurrentDraftEdge, setDraftEdge, commitDraftTyped, inputUnit, resetBuffer])

  useEffect(() => {
    // Случай 1: слушатели на window, не на SVG-узле. SVG часто не в фокусе
    // (кликнули мимо, ушли в поле ввода и вернулись) — keydown на самом узле
    // в этом случае просто не сработает, и привязка Shift будет работать через раз.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Shift') {
        modsRef.current.lockOrtho = true
        recompute()
        return
      }
      if (e.key === 'Alt') {
        modsRef.current.freeform = true
        recompute()
        return
      }

      // Буфер A1 — только когда рисование разрешено. Это и есть развод
      // клавиатуры с A2 (см. коммент к canDraw): пока открыто поле правки
      // стороны, canDraw===false, и ни один из кейсов ниже даже не смотрит
      // на event.target — HTML-инпут A2 получает эти же нажатия параллельно
      // (bubbling до window), но здесь они целиком игнорируются.
      if (!canDraw) return

      if (e.key === 'Enter') {
        e.preventDefault()
        commitTyped()
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        setBuffer(switchField(bufferRef.current))
        return
      }
      if (e.key === 'Escape') {
        if (isBufferEmpty(bufferRef.current)) return
        e.preventDefault()
        resetBuffer()
        return
      }
      if (e.key === 'Backspace') {
        if (isBufferEmpty(bufferRef.current)) return
        e.preventDefault()
        setBuffer(backspaceBuffer(bufferRef.current))
        return
      }
      if (e.key.length === 1 && /[0-9.,-]/.test(e.key)) {
        const next = appendDigit(bufferRef.current, e.key === ',' ? ',' : e.key)
        if (next !== bufferRef.current) {
          e.preventDefault()
          setBuffer(next)
        }
        return
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') modsRef.current.lockOrtho = false
      else if (e.key === 'Alt') modsRef.current.freeform = false
      else return
      recompute()
    }

    // Случай 2: пользователь зажал Shift, переключил окно (Alt-Tab) и отпустил
    // Shift там — keyup в это окно не придёт, флаг завис бы в true навсегда.
    // На потерю фокуса окна сбрасываем оба модификатора и пересчитываем.
    function onWindowBlur() {
      modsRef.current = { lockOrtho: false, freeform: false }
      recompute()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [canDraw, recompute, commitTyped, setBuffer, resetBuffer])

  // canDraw переключился в false (например A2 открылся сразу после commit,
  // см. commitDraft/closeContour) — недопечатанный буфер A1 не должен дожить
  // до следующего сеанса рисования.
  useEffect(() => {
    if (!canDraw) resetBuffer()
  }, [canDraw, resetBuffer])

  return { onPointerMove, onClick, dynamicInputBuffer: bufferDisplay }
}
