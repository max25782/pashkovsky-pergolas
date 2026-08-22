// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react'
import { usePlanEditorInput } from '../usePlanEditorInput'
import { usePlanEditorStore } from '../../model/store'
import { DEFAULT_SNAP_CONFIG } from '../../geometry/types'
import type { Point, Viewport } from '../../geometry/types'

/**
 * Хук использует singleton usePlanEditorStore напрямую (не принимает стор как
 * параметр) — сбрасываем релевантные поля перед каждым тестом, иначе тесты
 * в этом файле делили бы состояние между собой.
 */
function resetStore() {
  usePlanEditorStore.setState({
    draftEdge: null,
    fixedEdges: [],
    editingEdgeId: null,
    isClosed: false,
    viewport: { scale: 1, panX: 0, panY: 0 },
  })
}

const VIEWPORT: Viewport = { scale: 1, panX: 0, panY: 0 }
const START_POINT: Point = { x: 0, y: 0 }

function fakeSvgRef(): RefObject<SVGSVGElement> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.appendChild(el)
  // jsdom не считает layout — getBoundingClientRect всегда {0,0,0,0}, этого
  // достаточно: onPointerMove вычитает rect.left/top, с нулями это тождество.
  return { current: el }
}

/** Минимальный объект события — onPointerMove читает только эти четыре поля. */
function fakePointerEvent(clientX: number, clientY: number) {
  return { clientX, clientY, shiftKey: false, altKey: false } as unknown as ReactPointerEvent<SVGSVGElement>
}

describe('usePlanEditorInput — canDraw gate (шаг 3C, часть 0)', () => {
  beforeEach(resetStore)

  /**
   * canDraw — единый предикат, считается в PlanCanvas как
   * `!isClosed && editingEdgeId === null`. Хук сам не знает, ПОЧЕМУ рисование
   * заморожено — он получает уже готовый булев результат. Поэтому здесь явно
   * воспроизводим саму формулу для обоих исходных сценариев из живого бага
   * (isClosed=true И editingEdgeId!==null), а не просто передаём canDraw=false
   * с потолка — так тест реально привязан к предикату, а не к его следствию.
   */
  function canDrawFrom(isClosed: boolean, editingEdgeId: string | null): boolean {
    return !isClosed && editingEdgeId === null
  }

  it('canDraw=false: движение мыши не создаёт и не меняет draftEdge (сценарий isClosed=true)', () => {
    const svgRef = fakeSvgRef()
    const { result } = renderHook(() =>
      usePlanEditorInput({
        svgRef,
        from: START_POINT,
        viewport: VIEWPORT,
        snapConfig: DEFAULT_SNAP_CONFIG,
        startPoint: START_POINT,
        canClose: false,
        canDraw: canDrawFrom(true, null),
      }),
    )

    act(() => {
      result.current.onPointerMove(fakePointerEvent(100, 50))
    })

    expect(usePlanEditorStore.getState().draftEdge).toBeNull()
  })

  it('canDraw=false: движение мыши не создаёт и не меняет draftEdge (сценарий editingEdgeId!==null)', () => {
    const svgRef = fakeSvgRef()
    const { result } = renderHook(() =>
      usePlanEditorInput({
        svgRef,
        from: START_POINT,
        viewport: VIEWPORT,
        snapConfig: DEFAULT_SNAP_CONFIG,
        startPoint: START_POINT,
        canClose: false,
        canDraw: canDrawFrom(false, 'edge-6'),
      }),
    )

    act(() => {
      result.current.onPointerMove(fakePointerEvent(100, 50))
    })

    expect(usePlanEditorStore.getState().draftEdge).toBeNull()
  })

  it('canDraw=false: клик не коммитит сторону (ни commitDraft, ни closeContour)', () => {
    const svgRef = fakeSvgRef()
    // Курсор уже "на холсте" — типичный случай живого бага: резиновая линия
    // была последней позицией ДО замыкания/открытия редактора.
    usePlanEditorStore.setState({ draftEdge: null })
    const { result } = renderHook(() =>
      usePlanEditorInput({
        svgRef,
        from: START_POINT,
        viewport: VIEWPORT,
        snapConfig: DEFAULT_SNAP_CONFIG,
        startPoint: START_POINT,
        canClose: false,
        canDraw: false,
      }),
    )

    act(() => {
      // Даже если бы курсор был известен, canDraw=false гейтит buildCurrentDraftEdge
      // ДО обращения к стору — onClick должен быть чистым no-op.
      result.current.onClick()
    })

    const s = usePlanEditorStore.getState()
    expect(s.fixedEdges).toHaveLength(0)
    expect(s.draftEdge).toBeNull()
  })

  it('canDraw=true: движение мыши как обычно обновляет draftEdge', () => {
    const svgRef = fakeSvgRef()
    const { result } = renderHook(() =>
      usePlanEditorInput({
        svgRef,
        from: START_POINT,
        viewport: VIEWPORT,
        snapConfig: DEFAULT_SNAP_CONFIG,
        startPoint: START_POINT,
        canClose: false,
        canDraw: true,
      }),
    )

    act(() => {
      result.current.onPointerMove(fakePointerEvent(100, 50))
    })

    expect(usePlanEditorStore.getState().draftEdge).not.toBeNull()
  })

  it('рисование размораживается сразу, как только canDraw переключается обратно в true', () => {
    const svgRef = fakeSvgRef()
    const { result, rerender } = renderHook(
      (canDraw: boolean) =>
        usePlanEditorInput({
          svgRef,
          from: START_POINT,
          viewport: VIEWPORT,
          snapConfig: DEFAULT_SNAP_CONFIG,
          startPoint: START_POINT,
          canClose: false,
          canDraw,
        }),
      { initialProps: false },
    )

    act(() => {
      result.current.onPointerMove(fakePointerEvent(100, 50))
    })
    expect(usePlanEditorStore.getState().draftEdge).toBeNull()

    rerender(true)
    act(() => {
      result.current.onPointerMove(fakePointerEvent(120, 60))
    })
    expect(usePlanEditorStore.getState().draftEdge).not.toBeNull()
  })

  it('canDraw=false: буфер A1 игнорирует нажатия цифр целиком', () => {
    const svgRef = fakeSvgRef()
    const { result } = renderHook(() =>
      usePlanEditorInput({
        svgRef,
        from: START_POINT,
        viewport: VIEWPORT,
        snapConfig: DEFAULT_SNAP_CONFIG,
        startPoint: START_POINT,
        canClose: false,
        canDraw: false,
      }),
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true }))
    })

    expect(result.current.dynamicInputBuffer.lengthText).toBe('')
  })

  it('canDraw=true: цифры копятся в буфере A1', () => {
    const svgRef = fakeSvgRef()
    const { result } = renderHook(() =>
      usePlanEditorInput({
        svgRef,
        from: START_POINT,
        viewport: VIEWPORT,
        snapConfig: DEFAULT_SNAP_CONFIG,
        startPoint: START_POINT,
        canClose: false,
        canDraw: true,
      }),
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '8', bubbles: true, cancelable: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true, cancelable: true }))
    })

    expect(result.current.dynamicInputBuffer.lengthText).toBe('580')
  })
})
