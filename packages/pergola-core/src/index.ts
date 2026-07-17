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
  computeLamellas,
} from './lamellas'

export type { FrameResult } from './frame'
export { computeFrame } from './frame'
