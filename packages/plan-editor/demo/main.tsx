import { createRoot } from 'react-dom/client'
import { PlanCanvas } from '../src/view-svg/PlanCanvas'
import { usePlanEditorStore } from '../src/model/store'
import { worldToScreen } from '../src/geometry/coords'
import { closureGap } from '../src/geometry/closure'

function Hud() {
  const draftEdge = usePlanEditorStore((s) => s.draftEdge)
  const fixedEdges = usePlanEditorStore((s) => s.fixedEdges)
  const editingEdgeId = usePlanEditorStore((s) => s.editingEdgeId)
  const isClosed = usePlanEditorStore((s) => s.isClosed)
  const gap = closureGap(fixedEdges)
  return (
    <div
      id="hud"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        color: '#e5e7eb',
        fontFamily: 'monospace',
        fontSize: 13,
        pointerEvents: 'none',
        whiteSpace: 'pre',
        userSelect: 'none',
      }}
    >
      {draftEdge
        ? `angle=${draftEdge.dir.angleDeg.toFixed(2)}°  snapped=${draftEdge.dir.snapped}  snapAngle=${draftEdge.dir.snapAngle ?? '-'}  closesContour=${!!draftEdge.closesContour}`
        : 'draftEdge = null (курсор ещё не заходил на холст)'}
      {'\n'}
      {`fixedEdges=${fixedEdges.length}  editingEdgeId=${editingEdgeId ?? '-'}  isClosed=${isClosed}`}
      {'\n'}
      {`gap: dx=${gap.dx.toFixed(1)} dy=${gap.dy.toFixed(1)} dist=${gap.distMm.toFixed(1)}мм`}
    </div>
  )
}

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <PlanCanvas labels={{ closeContourTooltip: 'клик замкнёт контур' }} />
      <Hud />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)

/**
 * ── Тест-харнесс, только для этого dev-стенда ──────────────────────────
 * Не часть публичного API пакета (живёт в demo/, а не в src/).
 * Позволяет детерминированно проиграть pointermove/keydown/keyup/blur
 * через synthetic DOM events и прочитать точное состояние стора,
 * без стрельбы «на глаз» по пикселям экрана.
 */
function svgEl(): SVGSVGElement {
  const el = document.querySelector('svg')
  if (!el) throw new Error('svg еще не смонтирован')
  return el as SVGSVGElement
}

function moveTo(worldX: number, worldY: number, mods: { shiftKey?: boolean; altKey?: boolean } = {}) {
  const svg = svgEl()
  const rect = svg.getBoundingClientRect()
  const viewport = usePlanEditorStore.getState().viewport
  const screen = worldToScreen({ x: worldX, y: worldY }, viewport)
  const ev = new PointerEvent('pointermove', {
    clientX: rect.left + screen.x,
    clientY: rect.top + screen.y,
    shiftKey: !!mods.shiftKey,
    altKey: !!mods.altKey,
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
  })
  svg.dispatchEvent(ev)
}

function pressKey(key: 'Shift' | 'Alt', type: 'keydown' | 'keyup') {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }))
}

function windowBlur() {
  window.dispatchEvent(new Event('blur'))
}

/** Диспатчит настоящий DOM click на svg — так же, как настоящий клик мышью. */
function click() {
  const svg = svgEl()
  svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function closeContourExplicit() {
  usePlanEditorStore.getState().closeContourExplicit()
}

function updateEdgeLength(id: string, mm: number) {
  usePlanEditorStore.getState().updateEdgeLength(id, mm)
}

function updateEdgeAngle(id: string, deg: number) {
  usePlanEditorStore.getState().updateEdgeAngle(id, deg)
}

function adjustAndClose() {
  usePlanEditorStore.getState().adjustAndClose()
}

function state() {
  const s = usePlanEditorStore.getState()
  return {
    draftEdge: s.draftEdge,
    viewport: s.viewport,
    startPoint: s.startPoint,
    fixedEdges: s.fixedEdges,
    editingEdgeId: s.editingEdgeId,
    isClosed: s.isClosed,
    anchor: s.currentAnchor(),
    lastAdjustResult: s.lastAdjustResult,
    closeContourError: s.closeContourError,
  }
}

;(window as unknown as { __test: unknown }).__test = {
  moveTo,
  pressKey,
  windowBlur,
  click,
  updateEdgeLength,
  updateEdgeAngle,
  adjustAndClose,
  closeContourExplicit,
  state,
}
