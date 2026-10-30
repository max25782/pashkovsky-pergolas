export { MM_TO_M, mmToM } from './units'

export {
  buildCutPieceGeometry,
  buildCutPieceMaterial,
  buildCutPieceMesh,
  buildCutPieceMeshes,
  buildBatchedCutPieceMesh,
  buildLedStripMesh,
  buildLedStripMeshes,
} from './geometryBuilder'

export { PergolaCutPieceScene } from './PergolaCutPieceScene'
export type { PergolaCutPieceSceneProps, DividerEditProps } from './PergolaCutPieceScene'

export { PergolaCutPieceViewer } from './PergolaCutPieceViewer'
export type { PergolaCutPieceViewerProps } from './PergolaCutPieceViewer'

export { SceneBackdrop, SCENE_PRESETS } from './SceneBackdrop'
export type { SceneBackdropProps, ScenePreset, ScenePresetId } from './SceneBackdrop'

export { RAL_HEX, ralToHex, isHexColor } from './ral'
export { resolvePergolaFinish, buildPergolaMaterial, WOOD_PRESETS } from './materials'
export type { PergolaFinish, ResolvedPergolaFinish } from './materials'
