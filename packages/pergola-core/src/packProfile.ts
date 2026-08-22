import type { CutPiece, PieceRole } from './types'

const MIN_LENGTH_MM = 1e-6
const RAD = Math.PI / 180

/**
 * Saw kerf assumption, mm — shared default for both packProfile (CRM order
 * sheet) and beamSegmentation (deciding where a too-long beam/purlin may be
 * spliced — see prompt "керф на стыке балки": a spliced segment must fit
 * stock WITH kerf, the same arithmetic packProfile itself enforces, or a
 * segment sized exactly to stockLengthMm hits the same "не влезает" packing
 * throws as an un-segmented piece would). Same value as the legacy
 * KERF_CM=0.5 in the old apps/crm/lib/cut-list/calculate-cut-list.ts packer.
 */
export const DEFAULT_KERF_MM = 5

/**
 * Minimum value the combined miter×bevel cosine is allowed to shrink to
 * before we clamp it. Guards against a compound angle approaching 90°
 * (cosine → 0 → kerf → ∞) blowing up the packer instead of failing with a
 * clear "profile/angle combination not supported" error upstream. In
 * practice cutMiterDeg/cutBevelDeg never get this close to 90° for real
 * pergola geometry (see types.ts CutPiece derivation), so this is a safety
 * clamp, not a real code path.
 */
const MIN_COS_PRODUCT = 0.05

/**
 * One piece as packed into a bar — everything a saw operator needs (see
 * Part 3 "лист порезки"), copied verbatim from the source CutPiece so the
 * cut sheet can never disagree with the 3D scene / cut list (same
 * single-source-of-truth rule as pieceAxis.ts / dimensionChains.ts).
 * Deliberately carries BOTH cutMiterDeg and cutBevelDeg per end (not a
 * single "angle") — a tilted lamella needs the blade-tilt setting too, not
 * just the table-rotation, or the operator cuts the wrong compound angle.
 */
export interface PackedPieceRef {
  pieceId: string
  role: PieceRole
  /** Long-point length, mm — what the packer actually reserves out of the bar. */
  lengthLongMm: number
  /** Centerline length, mm — for reference/labelling only, not used for packing. */
  lengthAxisMm: number

  cutMiterStartDeg: number
  cutBevelStartDeg: number
  cutHandStart: 'L' | 'R' | 'straight'

  cutMiterEndDeg: number
  cutBevelEndDeg: number
  cutHandEnd: 'L' | 'R' | 'straight'
}

export interface StockBar {
  stockLengthMm: number
  /** Pieces in cutting order (longest-first — see packProfile FFD ordering). */
  pieces: PackedPieceRef[]
  usedMm: number
  wasteMm: number
}

export interface StockPlan {
  profileId: string
  stockLengthMm: number
  bars: StockBar[]
  totalBars: number
  totalWasteMm: number
  wastePct: number
}

function toPackedPieceRef(piece: CutPiece): PackedPieceRef {
  return {
    pieceId: piece.id,
    role: piece.role,
    lengthLongMm: piece.lengthLongMm,
    lengthAxisMm: piece.lengthAxisMm,
    cutMiterStartDeg: piece.cutMiterStartDeg,
    cutBevelStartDeg: piece.cutBevelStartDeg,
    cutHandStart: piece.cutHandStart,
    cutMiterEndDeg: piece.cutMiterEndDeg,
    cutBevelEndDeg: piece.cutBevelEndDeg,
    cutHandEnd: piece.cutHandEnd,
  }
}

/**
 * Effective kerf for ONE cut made at a compound angle (miter + bevel), mm.
 *
 * A straight cross-cut (miter=bevel=0) removes exactly kerfMm of bar length.
 * An angled cut sweeps the blade across a longer path through the profile,
 * so it consumes MORE bar length than a straight cut of the same nominal
 * kerf width — per spec: "Пропил под углом длиннее прямого."
 *
 * Exact formula requested: kerf_эфф = kerfMm / cos(угол_реза) for a single
 * cut angle. With two independent saw axes (table rotation = miter, blade
 * tilt = bevel — see types.ts CutPiece docstring) we compound both
 * corrections multiplicatively: kerf_эфф = kerfMm / (cos(miter)·cos(bevel)).
 * This reduces to the exact requested formula whenever only one of the two
 * angles is nonzero (the common case: beams/flat lamellas have bevel=0,
 * only tilted lamellas have bevel≠0), and is a reasonable, conservative
 * approximation for the compound case — deliberately not a full 3D
 * cut-plane derivation (out of scope: "не писать сложную метаэвристику"
 * applies to formula complexity here too, not just the bin-packing
 * algorithm below).
 */
export function effectiveKerfMm(kerfMm: number, miterDeg: number, bevelDeg: number): number {
  if (kerfMm <= 0) return 0
  const cosProduct = Math.cos(miterDeg * RAD) * Math.cos(bevelDeg * RAD)
  return kerfMm / Math.max(cosProduct, MIN_COS_PRODUCT)
}

/**
 * Effective kerf charged for ONE piece placed in a bar, mm.
 *
 * Each piece sits between two saw cuts (its start end and its end end), but
 * — matching the existing simplification in stockLength.ts's
 * packPiecesIntoBars ("charged once per piece placed") — only one kerf
 * allowance is charged per piece, not two. We take the LARGER of the two
 * ends' effective kerf so material is never under-ordered (same "never
 * under-order" principle as splitContinuousRunMm/compareStockLengthOptions).
 */
function pieceKerfMm(ref: PackedPieceRef, kerfMm: number): number {
  if (kerfMm <= 0) return 0
  const startKerf = effectiveKerfMm(kerfMm, ref.cutMiterStartDeg, ref.cutBevelStartDeg)
  const endKerf = effectiveKerfMm(kerfMm, ref.cutMiterEndDeg, ref.cutBevelEndDeg)
  return Math.max(startKerf, endKerf)
}

/**
 * Pack CutPieces of ONE profile+color+stock-length bundle into stock bars.
 *
 * Rules (see prompt "ЧАСТЬ 1 — НОВЫЙ ПАКОВЩИК"):
 *   1. Packs by lengthLongMm, NOT lengthAxisMm — an angled cut extends the
 *      physical bar requirement beyond the centerline length; packing by
 *      the axis length would under-order material and jam the saw at the
 *      end of the bar.
 *   2. Kerf is angle-adjusted per piece (effectiveKerfMm/pieceKerfMm above),
 *      not a flat kerfMm — an angled cut consumes more bar length per pass.
 *   3. First-Fit-Decreasing: sort pieces by lengthLongMm descending, place
 *      each into the first bar with room, else open a new bar. A heuristic
 *      (bin packing is NP-hard), not a guaranteed optimum — good enough to
 *      compare purchasing options, matching the existing
 *      packPiecesIntoBars/compareStockLengthOptions convention.
 *   4. Offcut reuse across bars is explicitly OUT of scope here — every
 *      piece gets its own slot, leftover bar length is waste. See
 *      groupCutPiecesByBundle below for the extension point a future
 *      offcut-matching pass would slot into (per bundle, before packing).
 *
 * Grouping (profile + color + chosen stock length) is the CALLER's
 * responsibility — this function assumes `pieces` already belongs to one
 * such bundle (see groupCutPiecesByBundle) and throws if it detects a
 * mixed profileId, to catch that mistake loudly instead of silently
 * producing a wrong order.
 *
 * @param pieces         CutPieces of a single profileId (mixed roles OK —
 *                          e.g. beam segments and posts of the same profile
 *                          pack together; role is preserved per-piece for
 *                          the cut sheet, not used for grouping here).
 * @param stockLengthMm  Bar length to pack into, mm. Must be > 0.
 * @param kerfMm         Nominal (straight-cut) saw kerf, mm. Default 0.
 */
export function packProfile(
  pieces: CutPiece[],
  stockLengthMm: number,
  kerfMm = 0,
): StockPlan {
  if (!(stockLengthMm > 0)) {
    throw new Error(`packProfile: stockLengthMm must be positive, got ${stockLengthMm}`)
  }

  if (pieces.length === 0) {
    return { profileId: '', stockLengthMm, bars: [], totalBars: 0, totalWasteMm: 0, wastePct: 0 }
  }

  const profileId = pieces[0].profileId
  for (const p of pieces) {
    if (p.profileId !== profileId) {
      throw new Error(
        `packProfile: mixed profileId in input ("${profileId}" vs "${p.profileId}", piece "${p.id}") — ` +
        `group pieces by profile+color (see groupCutPiecesByBundle) before calling packProfile`,
      )
    }
  }

  const refs = pieces.map(toPackedPieceRef).filter((r) => r.lengthLongMm > MIN_LENGTH_MM)

  const withSlot = refs.map((ref) => ({ ref, slotMm: ref.lengthLongMm + pieceKerfMm(ref, kerfMm) }))

  for (const { ref, slotMm } of withSlot) {
    if (slotMm > stockLengthMm) {
      throw new Error(
        `packProfile: piece "${ref.pieceId}" needs ${slotMm.toFixed(1)}mm (long-point ${ref.lengthLongMm.toFixed(1)}mm + kerf) ` +
        `but stock length is only ${stockLengthMm}mm — choose a longer stock length, or re-segment this piece upstream ` +
        `(it cannot be spliced: it has definite angled end cuts, unlike a raw continuous run)`,
      )
    }
  }

  const sorted = [...withSlot].sort((a, b) => b.slotMm - a.slotMm)
  const bars: StockBar[] = []

  for (const { ref, slotMm } of sorted) {
    const fitBar = bars.find((b) => b.usedMm + slotMm <= b.stockLengthMm)
    if (fitBar) {
      fitBar.pieces.push(ref)
      fitBar.usedMm += slotMm
      fitBar.wasteMm = fitBar.stockLengthMm - fitBar.usedMm
    } else {
      bars.push({ stockLengthMm, pieces: [ref], usedMm: slotMm, wasteMm: stockLengthMm - slotMm })
    }
  }

  const totalBars = bars.length
  const totalWasteMm = bars.reduce((sum, b) => sum + b.wasteMm, 0)
  const totalStockMm = totalBars * stockLengthMm
  const wastePct = totalStockMm > 0 ? (totalWasteMm / totalStockMm) * 100 : 0

  return { profileId, stockLengthMm, bars, totalBars, totalWasteMm, wastePct }
}

/**
 * Group CutPieces into purchasing/cutting bundles by (profileId, color) —
 * the mandatory grouping axis per spec: "Балки f10040 антрацит и f10040
 * белый — разные заказы, в один хлыст не идут." Stock length is
 * deliberately NOT part of the key — the caller (order sheet, Part 2)
 * chooses/compares stock length PER bundle and calls packProfile once per
 * candidate length; baking stockLength into the grouping key here would
 * force one comparison pass per length instead of one packProfile call
 * per length on the same bundle.
 *
 * Key format "<profileId>::<color>" is an internal bundle id, not meant to
 * be parsed by callers — iterate the map's values (and split the key back
 * out via the first piece's own profileId/color fields if a label is
 * needed).
 */
export function groupCutPiecesByBundle(pieces: CutPiece[]): Map<string, CutPiece[]> {
  const groups = new Map<string, CutPiece[]>()
  for (const piece of pieces) {
    const key = `${piece.profileId}::${piece.color}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(piece)
    else groups.set(key, [piece])
  }
  return groups
}
