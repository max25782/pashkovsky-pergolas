export type {
  Point2D,
  Vector2D,
  PieceRole,
  CutPiece,
  PergolaSpec,
  ProfileDimensions,
  MiterAtVertex,
  ContourMiters,
  SupportType,
} from './types'

export {
  signedArea,
  isCCW,
  miterAtVertex,
  computeContourMiters,
} from './miter'

export {
  scanLineClip,
  cutAtEdge,
  longPointOffset,
  computeLamellas,
} from './lamellas'

export { computeSpanDivisionPointsMm } from './lamellaSpans'
export type { LamellaPatternEntry } from './lamellaPattern'
export { resolveLamellaPattern, patternMaxLamellaSpanMm, patternMaxVerticalThicknessMm } from './lamellaPattern'
export { computePurlins } from './purlins'
export { computeLedStripLengthMm, ledPurlinPieces } from './ledChannel'

export type { FrameResult } from './frame'
export { computeFrame } from './frame'

export type {
  StockPlanLine,
  StockLengthComparison,
  BarAssignment,
} from './stockLength'
export {
  splitContinuousRunMm,
  packPiecesIntoBars,
  compareStockLengthOptions,
} from './stockLength'

export type { StructuralIssue } from './validation'
export { validateLamellaSpans } from './validation'

export type { PieceAxis } from './pieceAxis'
export { pieceAxis } from './pieceAxis'

export type { AxialDimensionPoint, AxialDimensionChain, AxialEdgeRef } from './dimensionChains'
export { buildAxialDimensionChains, buildAxialDimensionChainsFromEdges } from './dimensionChains'

export type { VisturTolerances } from './visturTolerances'
export {
  DEFAULT_VISTUR_TOLERANCES,
  applyVisturBeamSegmentReductionMm,
  applyVisturLengthReductionMm,
} from './visturTolerances'

export type { PackedPieceRef, StockBar, StockPlan } from './packProfile'
export { packProfile, groupCutPiecesByBundle, effectiveKerfMm, DEFAULT_KERF_MM } from './packProfile'

export type { BeamSegmentationIssue, SegmentBeamsForStockResult } from './beamSegmentation'
export {
  segmentBeamsForStock,
  findRectangleWingBoundaries,
  snapBoundaryToExistingPost,
  DEFAULT_SNAP_TOLERANCE_MM,
} from './beamSegmentation'

export type { LedReversalIssue, LedPurlinReversalResult } from './ledPurlinReversal'
export { segmentLedPurlinsForStock } from './ledPurlinReversal'

export type { Rectangle, AxisGrid, ShapeGrid } from './rectangleDecomposition'
export {
  decomposeIntoRectangles,
  findWingBoundariesAlongSegment,
  buildShapeGrid,
  minPostSpacingMm,
  MIN_POST_SPACING_RATIO,
  DEFAULT_MIN_POST_SPACING_MM,
  isOrthogonalContour,
} from './rectangleDecomposition'

export { sanitizeContour, SANITIZE_EPS_MM } from './contourSanitize'
