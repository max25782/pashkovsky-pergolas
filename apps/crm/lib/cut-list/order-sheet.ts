import type { CutPiece, ProfileDimensions, StockBar, StockPlan } from '@pashkovsky/pergola-core'
import { groupCutPiecesByBundle, packProfile, DEFAULT_KERF_MM } from '@pashkovsky/pergola-core'

/**
 * Order sheet + cutting sheet data model (see prompt "ЧАСТЬ 2 — ЛИСТ
 * ЗАКАЗА" / "ЧАСТЬ 3 — ЛИСТ ПОРЕЗКИ"). Pure data, no UI — built on top of
 * `packProfile`/`groupCutPiecesByBundle` from `@pashkovsky/pergola-core`
 * (see that package's packProfile.ts for the actual packing algorithm;
 * this file only groups, compares stock-length options, and totals).
 *
 * Deliberately lives in the CRM app, NOT in pergola-core: this is business
 * logic (which stock length the user picks to lock in, how weight/totals
 * roll up for a purchase order), same split as the existing
 * apps/crm/lib/cut-list/calculate-cut-list.ts vs pergola-core/stockLength.ts
 * — the kernel stays generic, the CRM layer decides what a "sheet" is.
 */

/**
 * Re-exported from pergola-core (moved there — see packProfile.ts —
 * because beamSegmentation.ts now needs the SAME default too, not just this
 * CRM layer). Kept as a named export here so existing imports
 * (`from '../order-sheet'`) keep working unchanged.
 */
export { DEFAULT_KERF_MM }

export interface StockLengthOption {
  stockLengthMm: number
  /**
   * null iff packProfile() rejected this stock length for this bundle (see
   * `error`) — a real, expected outcome, NOT a bug to fix by catching
   * higher up. A profile can legitimately have one piece (e.g. a full-span
   * perimeter beam) longer than its shorter catalog stock length while
   * fitting a longer one; each stock length is evaluated independently so
   * one bad option never hides the others (see buildProfileBundlePlans).
   */
  plan: StockPlan | null
  /**
   * packProfile()'s own thrown message when this stock length can't fit at
   * least one piece in the bundle (piece longer than stockLengthMm+kerf) —
   * surfaced to the UI instead of letting the exception crash the whole
   * sheet (see prompt "двадцать тестов... лист порезки не открыл"). null
   * iff plan is non-null.
   */
  error: string | null
}

/** One row of the order sheet: everything for ONE (profile, color) purchasing bundle. */
export interface ProfileBundlePlan {
  /** "<profileId>::<color>" — see groupCutPiecesByBundle. Stable React key / lookup key for chosen-length state. */
  bundleKey: string
  profileId: string
  color: string
  pieceCount: number
  /** Sum of lengthLongMm across every piece in the bundle — the material actually required, angled cuts included. */
  totalLengthLongMm: number
  profileWidthMm: number | undefined
  profileHeightMm: number | undefined
  weightKgPerMeter: number | undefined
  /**
   * One packProfile() result per available stock length for this profile,
   * ascending by length. Empty when the profile has no
   * availableStockLengthsMm configured — the bundle still shows piece
   * count/total length, but the UI must show "no stock data" instead of
   * fabricating a bars-to-order number (see catalog dependency note in
   * pergola-core/packProfile.ts and the prompt's own closing paragraph:
   * "лист заказа посчитает не то количество" if the catalog is incomplete
   * — here we refuse to guess rather than posting a wrong count).
   */
  options: StockLengthOption[]
  /** Fewest bars wins, ties broken by least waste — same rule as compareStockLengthOptions. null iff options is empty. */
  recommendedStockLengthMm: number | null
  /**
   * Longest lamella in this bundle that does not fit the longest bar.
   * A warning, not a splice: lamellas are never joined automatically.
   */
  lamellaOversizeMm: number | null
}

/**
 * Build one ProfileBundlePlan per (profileId, color) bundle found in `pieces`.
 *
 * @param pieces   Full CutPiece[] for the pergola (beams + posts + lamellas
 *                   + purlins — role is irrelevant to bundling, see
 *                   groupCutPiecesByBundle).
 * @param profiles Catalog map — must be the SAME map used to compute
 *                   `pieces` (maxSpanMm etc.), so availableStockLengthsMm/
 *                   weightKgPerMeter come from one consistent source.
 * @param kerfMm   Saw kerf, mm. Default DEFAULT_KERF_MM.
 */
/** Edge index of a contour beam, including a stock segment `beam-4-seg0`. */
export function contourBeamEdgeIndex(pieceId: string): number | null {
  const match = /^beam-(\d+)(?:-seg\d+)?$/.exec(pieceId)
  return match ? Number(match[1]) : null
}

/**
 * Wall beams stay on the plan. They are not ordered and not cut.
 * `wallEdgeIndices` must count edges like the beam ids do (the frame's
 * counter-clockwise copy): pass `wallEdgeIndicesInFrameOrder(contour, walls)`.
 */
export function piecesForCutting(pieces: CutPiece[], wallEdgeIndices: readonly number[]): CutPiece[] {
  const walls = new Set(wallEdgeIndices)
  if (walls.size === 0) return pieces
  return pieces.filter((piece) => {
    if (piece.role !== 'beam') return true
    const edge = contourBeamEdgeIndex(piece.id)
    return edge == null || !walls.has(edge)
  })
}

export function buildProfileBundlePlans(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
  kerfMm: number = DEFAULT_KERF_MM,
): ProfileBundlePlan[] {
  const bundles = groupCutPiecesByBundle(pieces)
  const plans: ProfileBundlePlan[] = []

  for (const [bundleKey, bundlePieces] of bundles) {
    const profileId = bundlePieces[0].profileId
    const color = bundlePieces[0].color
    const profile = profiles.get(profileId)
    const availableStockLengthsMm = profile?.availableStockLengthsMm ?? []

    const options: StockLengthOption[] = [...availableStockLengthsMm]
      .sort((a, b) => a - b)
      .map((stockLengthMm) => {
        // packProfile() throws (by design — see its own docstring) when a
        // piece in this bundle is longer than stockLengthMm+kerf. That is a
        // per-OPTION failure, not a per-BUNDLE one: a real pergola can have
        // one beam that only fits the longer of two catalog lengths (e.g.
        // an 8.7m perimeter run against a [6000, 7000]mm catalog) — letting
        // it propagate would crash the whole Order/Cutting sheet (both read
        // this same function) and hide every OTHER option/bundle that would
        // have rendered fine, exactly the silent-looking-fine-until-you-
        // actually-open-the-tab failure this sheet exists to prevent.
        try {
          return { stockLengthMm, plan: packProfile(bundlePieces, stockLengthMm, kerfMm), error: null }
        } catch (err) {
          return { stockLengthMm, plan: null, error: err instanceof Error ? err.message : String(err) }
        }
      })

    const longestStock = availableStockLengthsMm.reduce((max, length) => Math.max(max, length), 0)
    const lamellaOversizeMm = bundlePieces.reduce((max, piece) => {
      if (piece.role !== 'lamella' || !(longestStock > 0) || piece.lengthLongMm <= longestStock + 0.5) return max
      return Math.max(max, piece.lengthLongMm)
    }, 0)

    const best = options.reduce<StockLengthOption | null>((acc, opt) => {
      if (opt.plan == null) return acc
      if (!acc || acc.plan == null) return opt
      if (opt.plan.totalWasteMm < acc.plan.totalWasteMm - 1) return opt
      if (acc.plan.totalWasteMm < opt.plan.totalWasteMm - 1) return acc
      if (opt.plan.totalBars < acc.plan.totalBars) return opt
      if (opt.plan.totalBars === acc.plan.totalBars) {
        const optLongest = Math.max(0, ...opt.plan.bars.map((bar) => bar.wasteMm))
        const accLongest = Math.max(0, ...acc.plan.bars.map((bar) => bar.wasteMm))
        if (optLongest > accLongest + 1) return opt
      }
      return acc
    }, null)

    plans.push({
      bundleKey,
      profileId,
      color,
      pieceCount: bundlePieces.length,
      totalLengthLongMm: bundlePieces.reduce((sum, p) => sum + p.lengthLongMm, 0),
      profileWidthMm: profile?.widthMm,
      profileHeightMm: profile?.heightMm,
      weightKgPerMeter: profile?.weightKgPerMeter,
      options,
      recommendedStockLengthMm: best?.stockLengthMm ?? null,
      lamellaOversizeMm: lamellaOversizeMm > 0 ? lamellaOversizeMm : null,
    })
  }

  return plans.sort((a, b) => a.bundleKey.localeCompare(b.bundleKey))
}

/**
 * Resolve which StockPlan is "in effect" for a bundle: the user's explicit
 * choice if one was made (see UI state in OrderSheet.tsx), else the
 * recommended length, else null (no stock data for this profile — the
 * cutting sheet has nothing to print for it, see prompt's catalog-dependency
 * caveat).
 */
export function getChosenPlan(
  bundle: ProfileBundlePlan,
  chosenLengths: ReadonlyMap<string, number>,
): StockPlan | null {
  const chosenLen = chosenLengths.get(bundle.bundleKey) ?? bundle.recommendedStockLengthMm
  if (chosenLen == null) return null
  return bundle.options.find((o) => o.stockLengthMm === chosenLen)?.plan ?? null
}

/**
 * Stock length shared by the order sheet and the cutting sheet.
 * An explicit choice is kept only when that length fits this bundle;
 * otherwise both sheets fall back to the same recommended length.
 */
export function chosenStockLengthMm(
  bundle: ProfileBundlePlan,
  chosenLengths: ReadonlyMap<string, number>,
): number | null {
  const fitting = fittingStockOptions(bundle)
  const stored = chosenLengths.get(bundle.bundleKey)
  if (stored != null && fitting.some((option) => option.stockLengthMm === stored)) return stored
  return bundle.recommendedStockLengthMm
}

export interface CuttingLayoutCut {
  count: number
  lengthMm: number
  /** Angle of each end. 90 is a square cut. Any other value is degrees off square. */
  cutStartDeg: number
  cutEndDeg: number
  /** Length is the long point because at least one end is not square. */
  longPoint: boolean
  /** Set when the cut is one stock piece of a spliced beam. */
  beamPart?: { part: number; total: number }
  /** 1-based beam number, same as the plan mark. Only on a spliced part. */
  beamIndex?: number
}

/** Square cut is stored as 0° off perpendicular and shown as 90°. */
export function displayCutDeg(miterFromSquareDeg: number): number {
  if (!(miterFromSquareDeg > 0.05)) return 90
  return Math.round(miterFromSquareDeg * 100) / 100
}

export function formatCutDeg(deg: number): string {
  return Number.isInteger(deg) ? String(deg) : String(deg)
}

export interface CuttingLayoutLine {
  count: number
  stockLengthMm: number
  cuts: CuttingLayoutCut[]
  wasteMm: number
}

/** `beam-3-seg0` is part 1 of however many `-seg` pieces share that beam. */
export function beamSegmentPart(
  pieceId: string,
  role: string,
  pieceIds: readonly string[],
): { part: number; total: number } | null {
  const match = pieceId.match(/^(.*)-seg(\d+)$/)
  if (!match || role !== 'beam') return null
  const prefix = `${match[1]}-seg`
  const total = pieceIds.filter((id) => id.startsWith(prefix)).length
  if (total < 2) return null
  return { part: Number(match[2]) + 1, total }
}

function beamNumber(pieceId: string): number | null {
  const match = /^beam-(\d+)/.exec(pieceId)
  return match ? Number(match[1]) + 1 : null
}

/** Identical bar layouts become one line. A layout that occurs once stays its own line. */
export function groupCuttingLayouts(bars: StockBar[]): CuttingLayoutLine[] {
  const groups: CuttingLayoutLine[] = []
  const index = new Map<string, number>()
  const pieceIds = bars.flatMap((bar) => bar.pieces.map((piece) => piece.pieceId))
  for (const bar of bars) {
    const lengths = new Map<string, CuttingLayoutCut>()
    for (const piece of bar.pieces) {
      const lengthMm = Math.round(piece.lengthLongMm)
      const cutStartDeg = displayCutDeg(piece.cutMiterStartDeg)
      const cutEndDeg = displayCutDeg(piece.cutMiterEndDeg)
      const longPoint = cutStartDeg !== 90 || cutEndDeg !== 90
      const beamPart = beamSegmentPart(piece.pieceId, piece.role, pieceIds)
      const beamIndex = beamPart ? beamNumber(piece.pieceId) : null
      const slot = `${lengthMm}|${cutStartDeg}|${cutEndDeg}|${beamPart?.part ?? ''}|${beamPart?.total ?? ''}|${beamIndex ?? ''}`
      const found = lengths.get(slot)
      if (found) found.count += 1
      else {
        lengths.set(slot, {
          lengthMm,
          count: 1,
          cutStartDeg,
          cutEndDeg,
          longPoint,
          ...(beamPart ? { beamPart } : {}),
          ...(beamIndex != null ? { beamIndex } : {}),
        })
      }
    }
    const cuts = [...lengths.values()].sort((a, b) => b.lengthMm - a.lengthMm || (a.beamPart?.part ?? 0) - (b.beamPart?.part ?? 0))
    const wasteMm = Math.round(bar.wasteMm)
    const key = `${bar.stockLengthMm}|${wasteMm}|${cuts.map((cut) => `${cut.count}x${cut.lengthMm}@${cut.cutStartDeg}/${cut.cutEndDeg}${cut.beamPart ? `p${cut.beamIndex ?? ''}:${cut.beamPart.part}/${cut.beamPart.total}` : ''}`).join('+')}`
    const found = index.get(key)
    if (found != null) groups[found].count += 1
    else {
      index.set(key, groups.length)
      groups.push({ count: 1, stockLengthMm: bar.stockLengthMm, cuts, wasteMm })
    }
  }
  return groups
}

/** Stock lengths that can actually hold every piece in the bundle. Shorter bars are omitted from the order sheet and from the order PDF. */
export function fittingStockOptions(bundle: ProfileBundlePlan): StockLengthOption[] {
  return bundle.options.filter((option) => option.plan != null)
}

export interface OrderSheetTotalRow {
  profileId: string
  totalBars: number
  /** Ordered metres: bars × chosen stock length. */
  totalMeters: number
  /**
   * null when ANY bundle of this profile is missing weightKgPerMeter or has
   * no resolved plan — a partial sum would look complete but silently
   * underclock the real order weight, which is worse than showing nothing.
   */
  totalWeightKg: number | null
}

/**
 * Roll bundle totals up to ONE row per profileId (summing across colors),
 * using each bundle's chosen (or recommended) stock length.
 */
export function buildOrderSheetTotals(
  plans: ProfileBundlePlan[],
  chosenLengths: ReadonlyMap<string, number>,
): OrderSheetTotalRow[] {
  interface Acc { totalBars: number; totalMeters: number; totalWeightKg: number; weightKnown: boolean }
  const byProfile = new Map<string, Acc>()

  for (const bundle of plans) {
    const plan = getChosenPlan(bundle, chosenLengths)
    const chosenStock = chosenLengths.get(bundle.bundleKey) ?? bundle.recommendedStockLengthMm

    const acc = byProfile.get(bundle.profileId) ?? { totalBars: 0, totalMeters: 0, totalWeightKg: 0, weightKnown: true }
    const orderedMeters = plan != null && chosenStock != null ? (plan.totalBars * chosenStock) / 1000 : 0
    acc.totalBars += plan?.totalBars ?? 0
    acc.totalMeters += orderedMeters

    if (plan != null && chosenStock != null && bundle.weightKgPerMeter != null) {
      acc.totalWeightKg += orderedMeters * bundle.weightKgPerMeter
    } else {
      // Once any bundle of this profile can't contribute a real weight,
      // the profile's total is incomplete forever — do NOT let a later
      // bundle's successful addition silently "revive" it into a number
      // that looks complete but understates the true total.
      acc.weightKnown = false
    }

    byProfile.set(bundle.profileId, acc)
  }

  return Array.from(byProfile.entries()).map(([profileId, acc]) => ({
    profileId,
    totalBars: acc.totalBars,
    totalMeters: acc.totalMeters,
    totalWeightKg: acc.weightKnown ? acc.totalWeightKg : null,
  }))
}
