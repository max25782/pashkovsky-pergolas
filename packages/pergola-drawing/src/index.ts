export { beamFootprintCorners, postFootprintCorners, lamellaFootprintCorners } from './geometry/footprints'
export { outwardNormal, buildDimensionLineLayout } from './geometry/dimensionLayout'
export type {
  DimensionExtensionLine,
  DimensionSegmentLayout,
  DimensionLineLayout,
} from './geometry/dimensionLayout'

export type { LamellaRow, LamellaRhythmSegment, LamellaRhythm } from './geometry/lamellaRhythm'
export { groupLamellaRows, buildLamellaRhythm } from './geometry/lamellaRhythm'

export type { CellFrameGeometry } from './geometry/cellFrame'
export { buildCellFrameGeometry, pickRepresentativeLamella } from './geometry/cellFrame'

export { DimensionChainSvg } from './DimensionChainSvg'
export { InteriorAngleSvg } from './InteriorAngleSvg'
export { PlanEditorCanvasOverlay } from './PlanEditorCanvasOverlay'
export type { PlanEditorCanvasOverlayProps } from './PlanEditorCanvasOverlay'
export { beamSplicePoints, groupBeamsIntoGeometricSides } from './geometry/beamRuns'
export type { GeometricSide } from './geometry/beamRuns'
export { renderPlanDimensionsSvg, collectPlanDimensionWorldPoints } from './planDimensionsSvg'
export type { PlanDimensionsSvgInput } from './planDimensionsSvg'
export { TopPlanSheet, purlinEndsMeetFrame } from './TopPlanSheet'
export { LamellaLayoutSheet } from './LamellaLayoutSheet'
export { LamellaSectionsSheet, layoutSectionTypeCards, cardsOverlap } from './LamellaSectionsSheet'
export type { LamellaSectionsSheetLabels, SectionTypeCard } from './LamellaSectionsSheet'
export { CellFrameSheet } from './CellFrameSheet'
