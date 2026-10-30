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

  const optimal = packFewestBars(withSlot, stockLengthMm)
  const firstFit = packFirstFit(withSlot, stockLengthMm)
  const around = packAroundDominant(withSlot, stockLengthMm)
  const heuristic = fewerBars(optimal ?? firstFit, optimal ? null : around)
  const packed = withSlot.length <= 25
    ? packExact(withSlot, stockLengthMm, heuristic)
    : consolidateRemnants(heuristic, stockLengthMm, kerfMm)
  return finishPlan(profileId, stockLengthMm, packed)
}

/** ceil((sum of piece slots, kerf included) / stock). The packer must not go under this. */
export function barPackLowerBound(slotMm: number[], stockLengthMm: number): number {
  if (!(stockLengthMm > 0) || slotMm.length === 0) return 0
  const sum = slotMm.reduce((total, slot) => total + slot, 0)
  return Math.max(1, Math.ceil((sum - 1e-6) / stockLengthMm))
}

function packScore(bars: StockBar[]): [number, number, number] {
  let remnantBars = 0
  let longestRemnant = 0
  for (const bar of bars) {
    if (bar.wasteMm > 1) remnantBars += 1
    if (bar.wasteMm > longestRemnant) longestRemnant = bar.wasteMm
  }
  return [bars.length, remnantBars, -longestRemnant]
}

function betterBars(candidate: StockBar[] | null, current: StockBar[]): boolean {
  if (!candidate || candidate.length === 0) return false
  const next = packScore(candidate.filter((bar) => bar.pieces.length > 0))
  const prev = packScore(current)
  for (let i = 0; i < 3; i++) {
    if (next[i] < prev[i] - 1e-4) return true
    if (next[i] > prev[i] + 1e-4) return false
  }
  return false
}

function packFirstFit(
  withSlot: Array<{ ref: PackedPieceRef; slotMm: number }>,
  stockLengthMm: number,
): StockBar[] {
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
  return bars
}

function fewerBars(current: StockBar[], candidate: StockBar[] | null): StockBar[] {
  return betterBars(candidate, current) ? candidate! : current
}

/**
 * Up to 25 pieces: branch-and-bound. Minimum bars, then waste gathered onto
 * as few bars as possible, then the longest single offcut is maximised.
 * The seed packing is kept when nothing scores better, so a first-fit
 * layout that is already best does not get reshuffled.
 */
function packExact(
  items: Array<{ ref: PackedPieceRef; slotMm: number }>,
  stockLengthMm: number,
  seed: StockBar[],
): StockBar[] {
  const ordered = [...items].sort((a, b) => b.slotMm - a.slotMm)
  const slots = ordered.map((item) => item.slotMm)
  const total = slots.reduce((sum, slot) => sum + slot, 0)
  const lower = barPackLowerBound(slots, stockLengthMm)
  const suffix = new Array<number>(slots.length + 1).fill(0)
  for (let i = slots.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + slots[i]

  let bestScore = packScore(seed)
  let bestAssign: number[] | null = null
  const used: number[] = []
  const assign = new Array<number>(ordered.length).fill(-1)
  let nodes = 0

  function consider() {
    const score: [number, number, number] = [used.length, 0, 0]
    let longest = 0
    let remnants = 0
    for (const amount of used) {
      const waste = stockLengthMm - amount
      if (waste > 1) remnants += 1
      if (waste > longest) longest = waste
    }
    score[1] = remnants
    score[2] = -longest
    for (let i = 0; i < 3; i++) {
      if (score[i] > bestScore[i] + 1e-4) return
      if (score[i] < bestScore[i] - 1e-4) {
        bestScore = score
        bestAssign = assign.slice()
        return
      }
    }
  }

  function dfs(index: number): void {
    if (nodes > 200_000) return
    nodes += 1
    if (index === ordered.length) {
      consider()
      return
    }
    const rest = suffix[index]
    const free = used.reduce((sum, amount) => sum + (stockLengthMm - amount), 0)
    const extra = Math.max(0, Math.ceil((rest - free - 1e-6) / stockLengthMm))
    if (used.length + extra > bestScore[0]) return
    if (used.length > lower && used.length >= bestScore[0] && extra > 0 && used.length + extra > lower) {
      // Still allowed when it can tie the best bar count.
    }

    const slot = slots[index]
    const seen = new Set<number>()
    for (let bin = 0; bin < used.length; bin++) {
      if (used[bin] + slot > stockLengthMm + 1e-6) continue
      const signature = Math.round(used[bin])
      if (seen.has(signature)) continue
      seen.add(signature)
      used[bin] += slot
      assign[index] = bin
      dfs(index + 1)
      used[bin] -= slot
      if (nodes > 200_000) return
    }
    if (used.length < bestScore[0]) {
      used.push(slot)
      assign[index] = used.length - 1
      dfs(index + 1)
      used.pop()
    }
  }

  dfs(0)
  if (!bestAssign) return seed
  const groups = new Map<number, PackedPieceRef[]>()
  bestAssign.forEach((bin, index) => {
    const list = groups.get(bin) ?? []
    list.push(ordered[index].ref)
    groups.set(bin, list)
  })
  return [...groups.values()].map((pieces) => {
    const sorted = [...pieces].sort((a, b) => b.lengthLongMm - a.lengthLongMm)
    const usedMm = sorted.reduce((sum, piece) => {
      const slot = ordered.find((item) => item.ref === piece)?.slotMm ?? piece.lengthLongMm
      return sum + slot
    }, 0)
    return { stockLengthMm, pieces: sorted, usedMm, wasteMm: stockLengthMm - usedMm }
  })
}

/** Move pieces between bars when that uses fewer bars or gathers the offcut. */
function consolidateRemnants(seed: StockBar[], stockLengthMm: number, kerfMm: number): StockBar[] {
  let current = seed.map((bar) => ({ ...bar, pieces: [...bar.pieces] }))
  const slotOf = (piece: PackedPieceRef) => piece.lengthLongMm + pieceKerfMm(piece, kerfMm)
  const materialise = (bars: StockBar[]): StockBar[] => bars
    .filter((bar) => bar.pieces.length > 0)
    .map((bar) => {
      const usedMm = bar.pieces.reduce((sum, piece) => sum + slotOf(piece), 0)
      return { ...bar, stockLengthMm, usedMm, wasteMm: stockLengthMm - usedMm }
    })

  for (let pass = 0; pass < 24; pass++) {
    let changed = false
    for (let from = 0; from < current.length && !changed; from++) {
      for (let pieceIndex = 0; pieceIndex < current[from].pieces.length && !changed; pieceIndex++) {
        const piece = current[from].pieces[pieceIndex]
        const need = slotOf(piece)
        for (let to = 0; to < current.length; to++) {
          if (from === to || current[to].usedMm + need > stockLengthMm + 1e-6) continue
          const next = current.map((bar) => ({ ...bar, pieces: [...bar.pieces] }))
          next[from].pieces.splice(pieceIndex, 1)
          next[to].pieces.push(piece)
          const packed = materialise(next)
          if (!betterBars(packed, current)) continue
          current = packed
          changed = true
          break
        }
      }
    }
    if (!changed) break
  }
  return current
}

/**
 * When one length dominates, fill each bar with as many of those as still
 * leave room for the offcuts. First-fit puts one long offcut beside three
 * 1393.2 mm lamellas and opens a new bar for the next, even when two shorts
 * (3×1393.2 + 2×897 + kerf ≤ 6000) fit together. Two equal lengths stay on
 * the exact solver above; this only replaces first-fit when it uses fewer bars.
 */
function packAroundDominant(
  withSlot: Array<{ ref: PackedPieceRef; slotMm: number }>,
  stockLengthMm: number,
): StockBar[] | null {
  const groups: Array<{ slotMm: number; items: PackedPieceRef[] }> = []
  for (const item of withSlot) {
    const found = groups.find((group) => Math.abs(group.slotMm - item.slotMm) < 0.05)
    if (found) found.items.push(item.ref)
    else groups.push({ slotMm: item.slotMm, items: [item.ref] })
  }
  if (groups.length < 2) return null
  groups.sort((a, b) => b.items.length - a.items.length)
  const dominant = groups[0]
  if (dominant.items.length < groups[1].items.length * 2 || dominant.items.length < 4) return null
  const maxPerBar = Math.floor((stockLengthMm + 1e-6) / dominant.slotMm)
  if (maxPerBar < 2) return null

  const extras = groups
    .slice(1)
    .flatMap((group) => group.items.map((ref) => ({ ref, slotMm: group.slotMm })))
    .sort((a, b) => b.slotMm - a.slotMm)
  const shelves: Array<{ dominants: number; used: number; extras: typeof extras }> = []
  for (const extra of extras) {
    let best: (typeof shelves)[number] | null = null
    for (const shelf of shelves) {
      if (shelf.used + extra.slotMm > stockLengthMm + 1e-6) continue
      if (best == null || shelf.dominants > best.dominants) best = shelf
    }
    if (best) {
      best.extras.push(extra)
      best.used += extra.slotMm
      continue
    }
    let reserved = maxPerBar
    while (reserved > 0 && reserved * dominant.slotMm + extra.slotMm > stockLengthMm + 1e-6) reserved -= 1
    if (reserved * dominant.slotMm + extra.slotMm > stockLengthMm + 1e-6) return null
    shelves.push({
      dominants: reserved,
      used: reserved * dominant.slotMm + extra.slotMm,
      extras: [extra],
    })
  }

  let left = dominant.items.length
  let cursor = 0
  const bars: StockBar[] = []
  for (const shelf of shelves) {
    const take = Math.min(shelf.dominants, left)
    const pieces = [...dominant.items.slice(cursor, cursor + take), ...shelf.extras.map((extra) => extra.ref)]
    cursor += take
    left -= take
    const used = take * dominant.slotMm + shelf.extras.reduce((sum, extra) => sum + extra.slotMm, 0)
    if (used > stockLengthMm + 1e-6) return null
    bars.push({ stockLengthMm, pieces, usedMm: used, wasteMm: stockLengthMm - used })
  }
  while (left > 0) {
    const take = Math.min(maxPerBar, left)
    const pieces = dominant.items.slice(cursor, cursor + take)
    cursor += take
    left -= take
    const used = take * dominant.slotMm
    bars.push({ stockLengthMm, pieces, usedMm: used, wasteMm: stockLengthMm - used })
  }
  const packed = bars.reduce((sum, bar) => sum + bar.pieces.length, 0)
  if (cursor !== dominant.items.length || packed !== withSlot.length) return null
  return bars
}

function finishPlan(profileId: string, stockLengthMm: number, bars: StockBar[]): StockPlan {
  const totalBars = bars.length
  const totalWasteMm = bars.reduce((sum, b) => sum + b.wasteMm, 0)
  const totalStockMm = totalBars * stockLengthMm
  const wastePct = totalStockMm > 0 ? (totalWasteMm / totalStockMm) * 100 : 0
  return { profileId, stockLengthMm, bars, totalBars, totalWasteMm, wastePct }
}

/**
 * Exact fewest-bars packing when there are one or two cut lengths.
 * First-fit leaves a gap on the 10000 plan (4×1359 fills a bar, and the
 * 632 mm offcuts need bars of their own). Falls back to null when the
 * lengths are too mixed for the state table.
 */
function packFewestBars(
  withSlot: Array<{ ref: PackedPieceRef; slotMm: number }>,
  stockLengthMm: number,
): StockBar[] | null {
  const groups: Array<{ slotMm: number; items: PackedPieceRef[] }> = []
  for (const item of withSlot) {
    const found = groups.find((group) => Math.abs(group.slotMm - item.slotMm) < 0.05)
    if (found) found.items.push(item.ref)
    else groups.push({ slotMm: item.slotMm, items: [item.ref] })
  }
  if (groups.length === 0 || groups.length > 2) return null
  const aCount = groups[0].items.length
  const bCount = groups[1]?.items.length ?? 0
  if ((aCount + 1) * (bCount + 1) > 2_000_000) return null

  const patterns: Array<{ a: number; b: number; used: number }> = []
  const maxA = Math.min(aCount, Math.floor(stockLengthMm / groups[0].slotMm))
  const maxB = groups[1] ? Math.min(bCount, Math.floor(stockLengthMm / groups[1].slotMm)) : 0
  for (let a = 0; a <= maxA; a++) {
    for (let b = 0; b <= maxB; b++) {
      if (a + b === 0) continue
      const used = a * groups[0].slotMm + b * (groups[1]?.slotMm ?? 0)
      if (used <= stockLengthMm + 1e-6) patterns.push({ a, b, used })
    }
  }

  const cols = bCount + 1
  const size = (aCount + 1) * cols
  const barsAt = new Float64Array(size).fill(Infinity)
  const wasteAt = new Float64Array(size).fill(Infinity)
  const prev = new Int32Array(size).fill(-1)
  const patternAt = new Int32Array(size).fill(-1)
  barsAt[0] = 0
  wasteAt[0] = 0

  for (let a = 0; a <= aCount; a++) {
    for (let b = 0; b <= bCount; b++) {
      const state = a * cols + b
      if (!Number.isFinite(barsAt[state])) continue
      for (let p = 0; p < patterns.length; p++) {
        const pattern = patterns[p]
        const na = a + pattern.a
        const nb = b + pattern.b
        if (na > aCount || nb > bCount) continue
        const next = na * cols + nb
        const nextBars = barsAt[state] + 1
        const nextWaste = wasteAt[state] + (stockLengthMm - pattern.used)
        if (nextBars < barsAt[next] || (nextBars === barsAt[next] && nextWaste < wasteAt[next])) {
          barsAt[next] = nextBars
          wasteAt[next] = nextWaste
          prev[next] = state
          patternAt[next] = p
        }
      }
    }
  }

  const goal = aCount * cols + bCount
  if (!Number.isFinite(barsAt[goal])) return null

  const takenA: number[] = []
  const takenB: number[] = []
  let cursor = goal
  while (cursor > 0) {
    const pattern = patterns[patternAt[cursor]]
    takenA.push(pattern.a)
    takenB.push(pattern.b)
    cursor = prev[cursor]
  }

  let ai = 0
  let bi = 0
  const bars: StockBar[] = []
  for (let i = takenA.length - 1; i >= 0; i--) {
    const pieces = [
      ...groups[0].items.slice(ai, ai + takenA[i]),
      ...(groups[1] ? groups[1].items.slice(bi, bi + takenB[i]) : []),
    ]
    ai += takenA[i]
    bi += takenB[i]
    const used = takenA[i] * groups[0].slotMm + takenB[i] * (groups[1]?.slotMm ?? 0)
    bars.push({
      stockLengthMm,
      pieces,
      usedMm: used,
      wasteMm: stockLengthMm - used,
    })
  }
  return bars
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
