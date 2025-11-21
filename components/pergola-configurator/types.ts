export interface PergolaParams {
  widthCm: number
  depthCm: number
  heightCm: number
  color: string
  lamellaAngleDeg: number
  attachedToWall: boolean
  lamellaGapCm: number
}

export interface ProfileMeta {
  id: string
  dimensions?: string
  [k: string]: any
}

export interface PergolaMeshProps {
  params: PergolaParams
  // profile-driven cross-sections (in cm)
  postSizeCm: number
  beamHeightCm: number
  beamDepthCm: number
  lamellaHeightCm: number
  lamellaDepthCm: number
}

