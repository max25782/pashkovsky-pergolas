/** Linear dimensions in centimetres unless noted. */

export type PartKind = 'frame' | 'division' | 'shade' | 'angle' | 'hardware'

export type FrameMethod = 'builtin_kant' | 'plain_plus_angle'
export type FrameSplit = 'equal' | 'economical'
export type HiddenAngles = 'whole' | 'pieces'

export interface BomProfile {
  id: string
  /** Human section label, e.g. "12x4". */
  section: string
  /** Installed width used for inner-span math (the 4 in 12x4). */
  widthCm: number
  heightCm: number
  weightKgPerM: number
  stockLengthCm: number
}

export type BomCatalog = Record<string, BomProfile>

export interface BomModel {
  /** Outer length — shade runs this way (acceptance: 600). */
  lengthCm: number
  /** Outer width — division beams span this way (acceptance: 400). */
  widthCm: number
  color: string
  frame: { profileId: string; color?: string }
  divisions: { count: number; profileId?: string; color?: string }
  shade: { count: number; profileId: string; color?: string }
  angles?: { profileId: string; color?: string }
  posts?: { count: number; profileId: string; lengthCm: number; color?: string }
}

export interface NestSettings {
  kerfCm: number
  minReusableOffcutCm: number
  minRemainderCm: number
  frameMethod: FrameMethod
  frameSplit: FrameSplit
  hiddenAngles: HiddenAngles
  defaultStockLengthCm: number
  catalog: BomCatalog
}

export interface BomPart {
  id: string
  kind: PartKind
  profileId: string
  color: string
  lengthCm: number
  miterStartDeg?: number
  miterEndDeg?: number
  lengthLongCm?: number
  lengthShortCm?: number
}

export interface NestCut {
  partId: string
  originPartId: string
  lengthCm: number
}

export interface NestedBar {
  profileId: string
  color: string
  stockLengthCm: number
  cuts: NestCut[]
  remainderCm: number
  wastePct: number
  reusable: boolean
}

export interface NestResult {
  bars: NestedBar[]
  totalWastePct: number
  explanations: string[]
}

export type FastenerKind = 'shade_screws' | 'construction_screws' | 'angle_screws'

export interface FastenerRule {
  id: string
  name: string
  kind: FastenerKind
  sparePct: number
  unit: string
  pricePerUnit?: number
  /** Shade: frames the slats bear on. Default 2 (the two width-side rails). */
  shadeBearingFrameCount?: number
  /** Construction: screws at each division end. Default 2. */
  screwsPerDivisionEnd?: number
  /** Construction: screws at each frame corner joint. Default 4. */
  screwsPerFrameCorner?: number
  /** Construction: screws per hanging/post element. Default 3. */
  screwsPerHanger?: number
  /** Override hanger count; default is posts.count or 4. */
  hangerCount?: number
  /** Angle: spacing along the angle. Default 40 cm. */
  spacingCm?: number
  /** Angle: include a screw at each end (L/spacing + 1). Default true. */
  includeEnds?: boolean
}

export interface FastenerLine {
  id: string
  name: string
  formula: string
  quantity: number
  sparePct: number
  total: number
  unit: string
  pricePerUnit?: number
  costIls?: number
}

export interface BomPrices {
  /** ₪/kg for purchased stock bars. One number for all, or per profileId. */
  aluminumIlsPerKg?: number | Record<string, number>
  /** ₪ per piece for fastener lines, keyed by rule id. */
  fastenerIlsPerUnit?: Record<string, number>
}

export interface AluminumLine {
  profileId: string
  section: string
  color: string
  bars: number
  stockLengthCm: number
  stockMeters: number
  usedMeters: number
  usagePct: number
  weightKg: number
  costIls?: number
}

export interface BomResult {
  parts: BomPart[]
  nest: NestResult
  aluminum: AluminumLine[]
  hardware: BomPart[]
  fasteners: FastenerLine[]
  totals: {
    weightKg: number
    wastePct: number
    aluminumCostIls?: number
    fastenerCostIls?: number
    totalCostIls?: number
  }
}
