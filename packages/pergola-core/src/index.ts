export type {
  Point2D,
  Vector2D,
  PieceRole,
  CutPiece,
  PergolaSpec,
  ProfileDimensions,
  PurlinDividerMode,
  PlanPurlinDividerLine,
  PlanPurlinDividers,
  PieceWarningType,
  PieceWarning,
  MiterAtVertex,
  ContourMiters,
  SupportType,
  LamellaAngleDeg,
  SlopeMode,
  RoofSlope,
} from './types'

export {
  signedArea,
  isCCW,
  miterAtVertex,
  computeContourMiters,
  DEFAULT_RIGHT_ANGLE_SNAP_DEG,
} from './miter'
export type { MiterOptions } from './miter'

export type { FrameEdgePart } from './frameParts'
export { buildFrameEdgeParts, piecesWeightKg } from './frameParts'

export {
  CLOSURE_GAP_TOLERANCE_MM,
  HOUSE_CONTOUR_MM,
  HOUSE_WALL_EDGE_INDICES,
  HOUSE_FREE_EDGE_INDICES,
  HOUSE_RAL_1013_HEX,
  contourClosureGapMm,
  houseContourWithGhCm,
  houseSpec,
  houseSpecInput,
  houseConstructionParams,
} from './acceptance/houseContour'

export {
  scanLineClip,
  cutAtEdge,
  longPointOffset,
  computeLamellas,
} from './lamellas'

export {
  computeSpanDivisionPointsMm,
  resolvePurlinPositionsMm,
  contourRangeAlongLamellaDir,
  planPointToDividerPositionMm,
  beginManualPurlinDividers,
  autoPurlinSpanCount,
  computeMaxEqualPurlinClearGapMm,
  computeEqualPurlinClearMm,
  dividerPositionsForMaxEqualClears,
  formatPurlinClearLabelMm,
  measuredOuterAlongLamellas,
  purlinEndInsetMm,
  resolvePurlinEndInsetMm,
  axisToInnerFaceMm,
  contourVerticesAreOuterFaces,
  resolveContourReference,
  PURLIN_CLEAR_LAYOUT_VERSION,
} from './lamellaSpans'
export type { ContourReference, ContourReferenceResolution, ResolvedPurlinPosition } from './lamellaSpans'
export {
  resolvePlanPurlinLines,
  beamProfileChangePatch,
  movePlanDivider,
  removePlanDivider,
  addPlanDivider,
  setManualPurlinLines,
} from './dividerEdits'
export {
  buildDividerPickPieces,
  diagnoseDividerPicking,
  logDividerPickingDiagnostics,
  uniqueDividerIdsWithPickZones,
  MIN_DIVIDER_PICK_LENGTH_MM,
} from './dividerPickPieces'
export type { DividerPickDiagnostic } from './dividerPickPieces'
export type { LamellaPatternEntry } from './lamellaPattern'
export { resolveLamellaPattern, patternMaxLamellaSpanMm, patternMaxVerticalThicknessMm } from './lamellaPattern'
export { computePurlins } from './purlins'
export { computeLedStripLengthMm, ledPurlinPieces } from './ledChannel'

export type { FrameResult } from './frame'
export { computeFrame, wallEdgeIndicesInFrameOrder } from './frame'

export type { CanonicalSupportType } from './support'
export {
  resolveSupportType,
  specColorHex,
  clampLamellaAngleDeg,
  isFreeStanding,
  HANGER_LENGTH_MM,
} from './support'

export type { BuiltPieces, SpecFromPlanInput } from './buildPieces'
export { specFromPlan, buildPieces, buildPiecesFromPlan, planSupportType } from './buildPieces'

export type { LamellaPatternPreset } from './lamellaPresets'
export { LAMELLA_PATTERN_PRESETS, resolveLamellaPatternIds } from './lamellaPresets'

export type { LamellaWallThicknessMm } from './pergolaProfiles'
export {
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPergolaConstructionProfiles,
  applyLamellaWallThickness,
  parseLamellaWallThicknessMm,
  formatConstructionProfileLabel,
  CONSTRUCTION_LAMELLA_IDS,
  CONSTRUCTION_BEAM_IDS,
  CONSTRUCTION_POST_IDS,
  CONSTRUCTION_PURLIN_IDS,
  PLAIN_PURLIN_PROFILE_IDS,
  LAMELLA_70_08_ID,
  LAMELLA_40_09_ID,
  LAMELLA_70_16_ID,
  LAMELLA_70_10_ID,
  ALUMINUM_DENSITY_KG_PER_M3,
  RETIRED_PROFILE_IDS,
  LEGACY_DOUBLE_T_120_ID,
  DEFAULT_LED_PURLIN_ID,
  isRetiredProfileId,
  PROFILE_ID_ALIASES,
  canonicalProfileId,
  hollowRectWeightKgPerM,
} from './pergolaProfiles'
export type { FrameEndJoint, FrameEndKind, SkewWallFreeCorner } from './frameJoints'
export {
  FRAME_JOINT_VERSION,
  frameEndJoint,
  beamCutLengths,
  skewWallFreeCorners,
  isRightAngleInterior,
} from './frameJoints'

export type { PandaAlumProfile, PergolaCatalogSlot } from './supplier/pandaAlum'
export {
  PANDA_ALUM_CATALOG_URL,
  PANDA_ALUM_PROFILES,
  findPandaAlumBySku,
  pandaAlumLabel,
  pergolaCatalogSlot,
  parseCatalogNameDims,
  pandaAlumPergolaRows,
} from './supplier/pandaAlum'

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

export type {
  VertexInteriorAngle,
  TopPlanDimensionModel,
  SideClearConsistencyResult,
} from './topPlanDimensions'
export type { BeamPlanWidthSource } from './types'
export {
  DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
  BEAM_PLAN_WIDTH_FALLBACK_MM,
  BEAM_PLAN_WIDTH_MISSING_WARNING,
  isDoubleTBeamPlanWidthOverride,
  resolveBeamPlanWidth,
  attachBeamPlanWidth,
  beamPlanWidthForDrawing,
  listConstructionBeamPlanWidths,
  WALL_BEAM_PLAN_WIDTH_MM,
  WALL_BEAM_WIDTH_VERSION,
  WALL_BEAM_PROFILE_IDS,
  DEFAULT_WALL_BEAM_PROFILE_ID,
  supportProfileOptions,
  DEFAULT_SUPPORT_PROFILE_ID,
  isAllowedSupportProfileId,
  supportProfileNeedsChoice,
  profileSectionLabel,
  planFrameAsideRows,
  isWallBeamWidthV1,
  isAllowedWallBeamProfileId,
  sideBeamProfileId,
  sidePlanWidthMm,
  contourSideWidthMm,
  innerFaceClearMm,
  wingShelfFlushBandMm,
  lamellaRunEndEdgeIndices,
  lamellaRunEndWidthsMm,
} from './beamPlanWidth'
export {
  PURLIN_DIVIDER_CLEARANCE_WIDTH_MM,
  profilePlanWidthMm,
  formatInteriorAngleDeg,
  interiorAngleDegAtVertex,
  interiorAngleFromHeadingsDeg,
  expectedInteriorAngleSumDeg,
  vertexAnglesForContour,
  ANGLE_CLOSURE_WARNING,
  buildVertexInteriorAngles,
  outerFaceLengthOnSide,
  outerVertexAtContourIndex,
  matchContourEdgeIndex,
  contourEdgeOutward,
  buildTopPlanDimensionModel,
  buildOuterPerimeterDimensionChains,
  computePurlinClearGapsMm,
  verifyPurlinClearsAgainstMaxRule,
  buildPurlinClearDimensionChain,
  verifyPurlinClearSpanConsistency,
  diagnosePurlinClearsOnPrimarySide,
} from './topPlanDimensions'
export type { MaxPurlinClearGapVerification, PurlinClearDisplaySummary, PurlinClearSideDiagnosis } from './topPlanDimensions'
export {
  buildPlanEditorOverlayModel,
  findWingShelfSpanSegment,
  findWingShelfSpanSegments,
  outerLengthToAxisLengthMm,
  resolveWingShelfSupport,
  resolveAllWingShelfSupports,
  WING_SHELF_SPAN_DIVIDER_ID,
  DEFAULT_WING_SHELF_PROFILE_ID,
  LONG_DIVIDER_WITHOUT_SUPPORT_MM,
  hasLongDividerWithoutSupport,
} from './planEditorDimensions'
export {
  axisLengthsFromOuterLengthsMm,
  buildOuterAxisClosureReport,
  contourAxesMatchEnteredOuters,
  displayOuterLengthMm,
  outerDeltaMmOnContourSideVertexRule,
  outerHalfDeltaAtVertex,
  rebuildContourForEnteredOuters,
  treatContourAsClosedForOuterDelta,
  vertexCornerKindCCW,
} from './planEditorOuterAxis'
export type {
  ContourBeamWidthMatch,
  OuterAxisClosureReport,
  OuterAxisEdgeReport,
  OuterAxisVertexReport,
} from './planEditorOuterAxis'
export type {
  PlanEditorOverlayModel,
  PlanEditorSideDimensions,
  PlanEditorDividerOverlayLine,
  WingShelfSupport,
} from './planEditorDimensions'

export type { VisturTolerances } from './visturTolerances'
export {
  DEFAULT_VISTUR_TOLERANCES,
  applyVisturBeamSegmentReductionMm,
  applyVisturLengthReductionMm,
} from './visturTolerances'

export type { PackedPieceRef, StockBar, StockPlan } from './packProfile'
export { packProfile, groupCutPiecesByBundle, effectiveKerfMm, DEFAULT_KERF_MM, barPackLowerBound } from './packProfile'
export { ANGLE_30_PROFILE_ID, ANGLE_STOCK_MM, angleLengthMm, angleProfileDimensions, buildAngleCutPieces } from './angleStock'

export type { BeamSegmentationIssue, SegmentBeamsForStockResult, StockJoint } from './beamSegmentation'
export {
  segmentBeamsForStock,
  segmentRunPiecesForStock,
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

export type { RoofPlane, RoofResidual, SupportPoint } from './roof'
export {
  DEFAULT_ROOF_SLOPE,
  ROOF_PLANE_RESIDUAL_WARN_MM,
  roofPlane,
  heightOnPlane,
  postHeightMm,
  slopedAxisLengthMm,
  isFlatRoofSpec,
  isHorizontalPlane,
  horizontalRoofPlane,
  placeOnRoof,
} from './roof'

export type { PlanPointMm } from './simplePolygon'
export { isSimplePolygon } from './simplePolygon'
export { polygonAreaM2 } from './polygonArea'

export type {
  LamellaSection,
  LamellaTrapezoid,
  LamellaSectionLayoutVersion,
  LamellaSectionFace,
  LamellaSectionReportRow,
  ColumnHeightChecksum,
  LamellaSectionTypeGroup,
  LamellaSectionSchedule,
  LamellaSectionSupportLine,
  BuildLamellaSectionsOptions,
} from './lamellaSections'
export {
  LAMELLA_SECTION_CLEARANCE_W_MM,
  LAMELLA_SECTION_CLEARANCE_H_MM,
  factorySectionSizeMm,
  sectionOpeningForDividerSpan,
  LAMELLA_SECTION_LAYOUT_VERSION,
  LAMELLA_SECTION_LABEL_TOLERANCE_MM,
  isLamellaSectionLayoutV1,
  wingShelfPlanWidthMm,
  supportLineObstacleWidthMm,
  formatLamellaSectionSizeMm,
  formatTrapezoidSectionSizeMm,
  floorLamellaLengthMm,
  floorShownMm,
  countedLamellaRows,
  LAMELLA_TIP_MIN_LENGTH_MM,
  DEFAULT_LAMELLA_LENGTH_STEP_MM,
  sectionDrawnSizeMm,
  sectionLabelMatchesDrawn,
  describeLamellaSectionFaces,
  reportLamellaSections,
  columnHeightChecksums,
  LAMELLA_SECTION_TYPE_TOLERANCE_MM,
  lamellaSectionTypeLetter,
  groupLamellaSectionTypes,
  rebuildTrapezoidCornersFromWidths,
  trapezoidCornersNeedRebuild,
  lamellaSectionTypeById,
  buildLamellaSections,
  computeLamellasFromSections,
} from './lamellaSections'


export type { PlanConstructionParams } from './planDefaults'
export {
  PERGOLA_PLAN_SCHEMA_VERSION,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  parseMeasuredOuterLengthMmByEdgeIndex,
  paramsFromStoredPlan,
} from './planDefaults'

export type {
  StraightSupportBeam,
  StraightSupportBeamStart,
  StraightSupportBeamEnd,
  SupportBeamsDocument,
  SupportBeamPurlinFace,
  ResolvedStraightSupportBeam,
} from './supportBeams'
export {
  SUPPORT_BEAMS_FORMAT_VERSION,
  parseSupportBeamsDocument,
  supportBeamsEqual,
  hasPlanSupportBeams,
  supportLineFromPlanBeams,
  resolveStraightSupportBeams,
  applyStraightSupportBeamsToPieces,
  diagnoseSupportBeams,
  purlinLinesOverMaxSpanMm,
  makeStraightSupportBeam,
  supportBeamAxisFromSideMm,
  straightSideStackExtreme,
} from './supportBeams'
export type { SupportBeamWarning, SupportBeamWarningCode } from './supportBeams'

export {
  PERGOLA_PLAN_KNOWN_KEYS,
  pickPergolaPlanExtras,
  mergePergolaPlanDocument,
  serializePergolaPlan,
} from './pergolaPlanDocument'
export type { PergolaPlanExtras, PergolaPlanCoreFields } from './pergolaPlanDocument'
