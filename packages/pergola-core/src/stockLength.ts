/**
 * Stock-bar planning — pure functions over CutPiece lengths, decoupled from
 * any particular UI. Deliberately lives in pergola-core, NOT in
 * apps/crm/lib/cut-list/calculate-cut-list.ts: that file drives the OLD
 * parametric configurator (rectangle-only, straight cuts, Offer.configuratorMeta.params)
 * and is explicitly out of scope here (see prompt: "под сегментацию и косые
 * резы его придётся расширять или заменять — отдельная задача"). These
 * functions instead operate directly on CutPiece[] from computeFrame/
 * computeLamellas/computePurlins, so a future replacement of the legacy
 * packer can reuse them without depending on Offer/configurator types.
 */

const MIN_LENGTH_MM = 1e-6

/**
 * Split ONE continuous run (e.g. a lamella longer than any single stock bar)
 * into full-bar pieces butted end to end on site.
 *
 * Per spec: "ламель длиннее хлыста стыкуется встык, никакой стыковочной
 * детали нет" — maximum piece length is the FULL stock length, no kerf/
 * connector allowance subtracted (there is no connector to allow for), ends
 * are straight, joint position is free (unlike a purlin-driven segment,
 * whose boundary is fixed by the purlin — that split already happened
 * upstream in computeLamellas and produces separate CutPieces; this function
 * is for splitting a single CutPiece's length at CUTTING time, for the
 * purchasing/nesting step only — it does not change the 3D piece count).
 *
 * @param totalLengthMm  Length to split, mm (use lengthLongMm — the actual
 *                        bar-length requirement — not lengthAxisMm, so
 *                        angled cuts are never under-ordered).
 * @param stockLengthMm  Bar length available from the supplier, mm. Must be > 0.
 */
export function splitContinuousRunMm(totalLengthMm: number, stockLengthMm: number): number[] {
  if (!(stockLengthMm > 0)) {
    throw new Error(`stockLengthMm must be positive, got ${stockLengthMm}`)
  }
  if (totalLengthMm <= MIN_LENGTH_MM) return []
  if (totalLengthMm <= stockLengthMm) return [totalLengthMm]

  const pieceCount = Math.ceil(totalLengthMm / stockLengthMm)
  const pieces: number[] = []
  let remaining = totalLengthMm
  for (let i = 0; i < pieceCount; i++) {
    const len = Math.min(remaining, stockLengthMm)
    pieces.push(len)
    remaining -= len
  }
  return pieces
}

export interface BarAssignment {
  stockLengthMm: number
  piecesMm: number[]
  usedMm: number
  wasteMm: number
}

/**
 * First-fit-decreasing bin packing of cut lengths into stock bars.
 *
 * Sorting longest-first before first-fit (vs. plain first-fit in arrival
 * order) reliably uses fewer bars for the same input — the difference the
 * prompt calls out explicitly (real trapeze: 18 bars at 6.5m vs 15 at 7m;
 * a bad pack could hide or exaggerate that gap). Still a heuristic, not a
 * guaranteed-optimal bin packing (NP-hard) — good enough to compare
 * purchasing options, not a claim of the theoretical minimum.
 *
 * @param lengthsMm      Individual cut lengths, mm (already split to fit
 *                        within stockLengthMm — see splitContinuousRunMm).
 * @param stockLengthMm  Bar length, mm.
 * @param kerfMm         Material lost per saw cut, mm. Charged once per
 *                        piece placed (conservative: overestimates waste by
 *                        one kerf per bar, same simplification as the
 *                        existing calculate-cut-list.ts packer).
 */
export function packPiecesIntoBars(
  lengthsMm: number[],
  stockLengthMm: number,
  kerfMm = 0,
): BarAssignment[] {
  const sorted = [...lengthsMm].filter((l) => l > MIN_LENGTH_MM).sort((a, b) => b - a)
  const bars: BarAssignment[] = []

  for (const len of sorted) {
    const slotNeeded = len + kerfMm
    const fitBar = bars.find((b) => b.usedMm + slotNeeded <= stockLengthMm)
    if (fitBar) {
      fitBar.piecesMm.push(len)
      fitBar.usedMm += slotNeeded
      fitBar.wasteMm = stockLengthMm - fitBar.usedMm
    } else {
      bars.push({
        stockLengthMm,
        piecesMm: [len],
        usedMm: slotNeeded,
        wasteMm: stockLengthMm - slotNeeded,
      })
    }
  }

  return bars
}

export interface StockPlanLine {
  stockLengthMm: number
  barsUsed: number
  wasteMm: number
  wastePercent: number
}

export interface StockLengthComparison {
  options: StockPlanLine[]
  /** Fewest bars wins; ties broken by least total waste. null only if availableStockLengthsMm was empty. */
  bestStockLengthMm: number | null
}

/**
 * Compare every available stock length for one profile: bars needed and
 * waste at each. Per spec: "пользователь должен видеть цифру до заказа" —
 * this is the data behind that comparison table, UI-agnostic.
 *
 * Pieces longer than a given stockLengthMm are first split into full-bar
 * segments (splitContinuousRunMm) exactly as they will be cut on site, THEN
 * packed (packPiecesIntoBars) — so the comparison reflects real bars-to-buy,
 * not a naive "total length / stock length".
 *
 * @param pieces               Anything with lengthLongMm — pass CutPiece[]
 *                              filtered to one profileId. Long-point length
 *                              is used deliberately (not lengthAxisMm): at
 *                              an angled cut the bar must be at least this
 *                              long, so ordering by the axis length would
 *                              under-order material.
 * @param availableStockLengthsMm  Real supplier bar lengths for this profile
 *                                  (ProfileDimensions.availableStockLengthsMm)
 *                                  — never invent these.
 * @param kerfMm               Saw kerf, mm. Default 0 (caller decides).
 */
export function compareStockLengthOptions(
  pieces: Array<{ lengthLongMm: number }>,
  availableStockLengthsMm: number[],
  kerfMm = 0,
): StockLengthComparison {
  const options: StockPlanLine[] = availableStockLengthsMm.map((stockLengthMm) => {
    const allSegmentLengths = pieces.flatMap((p) => splitContinuousRunMm(p.lengthLongMm, stockLengthMm))
    const bars = packPiecesIntoBars(allSegmentLengths, stockLengthMm, kerfMm)
    const barsUsed = bars.length
    const wasteMm = bars.reduce((sum, b) => sum + b.wasteMm, 0)
    const totalStockMm = barsUsed * stockLengthMm
    const wastePercent = totalStockMm > 0 ? (wasteMm / totalStockMm) * 100 : 0
    return { stockLengthMm, barsUsed, wasteMm, wastePercent }
  })

  const bestStockLengthMm = options.reduce<StockPlanLine | null>((best, opt) => {
    if (!best) return opt
    if (opt.barsUsed < best.barsUsed) return opt
    if (opt.barsUsed === best.barsUsed && opt.wasteMm < best.wasteMm) return opt
    return best
  }, null)?.stockLengthMm ?? null

  return { options, bestStockLengthMm }
}
