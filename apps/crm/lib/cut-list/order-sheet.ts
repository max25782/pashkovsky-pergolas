import type { CutPiece, ProfileDimensions, StockPlan } from '@pashkovsky/pergola-core'
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

    const best = options.reduce<StockLengthOption | null>((acc, opt) => {
      if (opt.plan == null) return acc
      if (!acc || acc.plan == null) return opt
      if (opt.plan.totalBars < acc.plan.totalBars) return opt
      if (opt.plan.totalBars === acc.plan.totalBars && opt.plan.totalWasteMm < acc.plan.totalWasteMm) return opt
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

export interface OrderSheetTotalRow {
  profileId: string
  totalBars: number
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
  interface Acc { totalBars: number; totalWeightKg: number; weightKnown: boolean }
  const byProfile = new Map<string, Acc>()

  for (const bundle of plans) {
    const plan = getChosenPlan(bundle, chosenLengths)
    const chosenStockLengthMm = chosenLengths.get(bundle.bundleKey) ?? bundle.recommendedStockLengthMm

    const acc = byProfile.get(bundle.profileId) ?? { totalBars: 0, totalWeightKg: 0, weightKnown: true }
    acc.totalBars += plan?.totalBars ?? 0

    if (plan != null && chosenStockLengthMm != null && bundle.weightKgPerMeter != null) {
      const orderedMeters = (plan.totalBars * chosenStockLengthMm) / 1000
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
    totalWeightKg: acc.weightKnown ? acc.totalWeightKg : null,
  }))
}
