export interface PergolaParams {
  widthCm: number
  depthCm: number
  heightCm: number
  color: string
  lamellaAngleDeg: number
  attachedToWall: boolean
  lamellaGapCm: number
  beamLed: boolean
  lamellaStanding: boolean
  lamellaAlongWidth: boolean
  postProfileId: string | null
  beamProfileId: string | null
  /** חוצץ פנימי — intermediate/divider beam profile */
  dividerProfileId: string | null
  /** הצללה — shading lamella profile */
  lamellaProfileId: string | null
}

export interface ProfileMeta {
  id: string
  dimensions?: string
  [key: string]: unknown
}

export interface PergolaMeshProps {
  params: PergolaParams
  postSizeCm: number
  beamHeightCm: number
  beamDepthCm: number
  lamellaHeightCm: number
  lamellaDepthCm: number
}
