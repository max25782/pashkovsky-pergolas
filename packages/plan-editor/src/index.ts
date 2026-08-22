export type {
  Point,
  Modifiers,
  DirResult,
  SnapConfig,
  WorldBounds,
  CanvasSize,
  Viewport,
  DraftEdge,
  DraftOverride,
  FixedEdge,
  LengthUnit,
} from './geometry/types'
export { DEFAULT_SNAP_CONFIG } from './geometry/types'

export {
  worldToScreen,
  screenToWorld,
  projectOntoRay,
  computeFitToScreenViewport,
  dirFromAngle,
  distance,
} from './geometry/coords'

export { resolveDirection, angularDistance, normalizeAngle } from './geometry/snap'
export { buildDraftEdge, finalizeDraftEdge } from './geometry/draftEdge'
export { rebuildChain, currentAnchor, toPolygon, wallEdgeIndicesFromChain } from './geometry/chain'
export type { ClosureGap } from './geometry/closure'
export { closureGap, applyStartMagnet, DEFAULT_MAGNET_THRESHOLD_PX } from './geometry/closure'
export { isSimplePolygon } from './geometry/selfIntersection'

export type { EdgeResidual, AdjustContourResult, AdjustWeightsConfig } from './geometry/adjust'
export { adjustContour, DEFAULT_ADJUST_WEIGHTS } from './geometry/adjust'

export type { PlanEditorState } from './model/types'
export { usePlanEditorStore, createPlanEditorStore } from './model/store'

export { usePlanEditorInput } from './input/usePlanEditorInput'
export type {
  DynamicInputField,
  DynamicInputBufferState,
} from './input/dynamicInputBuffer'
export {
  EMPTY_DYNAMIC_INPUT_BUFFER,
  appendDigit,
  backspace,
  switchField,
  isBufferEmpty,
  parseBufferOverride,
  lengthUnitToMm,
  mmToLengthUnit,
} from './input/dynamicInputBuffer'

export { PlanCanvas } from './view-svg/PlanCanvas'
export type { PlanCanvasLabels } from './view-svg/PlanCanvas'
export { FixedEdges } from './view-svg/FixedEdges'
export { ClosureGapIndicator } from './view-svg/ClosureGapIndicator'
export { DynamicInputBadge } from './view-svg/DynamicInputBadge'
export { readableLabelAngleDeg } from './view-svg/textAngle'

export { EdgeEditor } from './view-html/EdgeEditor'
export type { EdgeEditorLabels } from './view-html/EdgeEditor'
export { AdjustPanel } from './view-html/AdjustPanel'
export type { AdjustPanelLabels } from './view-html/AdjustPanel'
export { SizesPanel } from './view-html/SizesPanel'
export type { SizesPanelLabels } from './view-html/SizesPanel'

export { PlanEditor } from './PlanEditor'
export type { PlanEditorLabels } from './PlanEditor'
