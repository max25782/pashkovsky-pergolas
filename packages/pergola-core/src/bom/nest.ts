import { stockLengthCm } from './catalog'
import { mergeNestSettings } from './defaults'
import { nestLengthCm } from './buildParts'
import type { BomPart, NestedBar, NestCut, NestResult, NestSettings } from './types'

const EPS = 1e-9

export interface SplitSegment {
  partId: string
  originPartId: string
  lengthCm: number
  kind: BomPart['kind']
  profileId: string
  color: string
}

/**
 * Split a length longer than stock.
 * equal: n equal pieces, n = ceil(L / stock).
 * economical: as many full bars as possible; remainder ≥ minRemainder
 * (borrow from the last full bar if the leftover would be shorter).
 */
export function splitForStock(
  lengthCm: number,
  stockLengthCmValue: number,
  method: NestSettings['frameSplit'],
  minRemainderCm: number,
): number[] {
  if (lengthCm <= 0) return []
  if (lengthCm <= stockLengthCmValue) return [lengthCm]

  if (method === 'equal') {
    const n = Math.ceil(lengthCm / stockLengthCmValue)
    const piece = lengthCm / n
    return Array.from({ length: n }, () => piece)
  }

  const full = Math.floor(lengthCm / stockLengthCmValue)
  const rem = lengthCm - full * stockLengthCmValue
  if (rem === 0) return Array.from({ length: full }, () => stockLengthCmValue)
  if (rem >= minRemainderCm) {
    return [...Array.from({ length: full }, () => stockLengthCmValue), rem]
  }
  if (full >= 1) {
    const borrow = minRemainderCm - rem
    const shortened = stockLengthCmValue - borrow
    const pieces = Array.from({ length: full - 1 }, () => stockLengthCmValue)
    pieces.push(shortened, minRemainderCm)
    return pieces
  }
  return [lengthCm]
}

function usedOnBar(cuts: NestCut[], kerfCm: number): number {
  if (cuts.length === 0) return 0
  const lengths = cuts.reduce((sum, c) => sum + c.lengthCm, 0)
  return lengths + kerfCm * (cuts.length - 1)
}

function finalizeBar(bar: NestedBar, kerfCm: number, minReusableOffcutCm: number): NestedBar {
  const used = usedOnBar(bar.cuts, kerfCm)
  const remainderCm = Math.max(0, bar.stockLengthCm - used)
  const wastePct = bar.stockLengthCm > 0 ? (remainderCm / bar.stockLengthCm) * 100 : 0
  return {
    ...bar,
    remainderCm,
    wastePct,
    reusable: remainderCm + EPS >= minReusableOffcutCm,
  }
}

function canPlace(bar: NestedBar, lengthCm: number, kerfCm: number): boolean {
  const used = usedOnBar(bar.cuts, kerfCm)
  const extra = bar.cuts.length === 0 ? lengthCm : lengthCm + kerfCm
  return used + extra <= bar.stockLengthCm + EPS
}

function openBar(profileId: string, color: string, stock: number): NestedBar {
  return {
    profileId,
    color,
    stockLengthCm: stock,
    cuts: [],
    remainderCm: stock,
    wastePct: 100,
    reusable: true,
  }
}

function placeOnFirstFit(
  bars: NestedBar[],
  cut: NestCut,
  profileId: string,
  color: string,
  stock: number,
  kerfCm: number,
): void {
  const fit = bars.find((b) => canPlace(b, cut.lengthCm, kerfCm))
  if (fit) {
    fit.cuts.push(cut)
    return
  }
  const bar = openBar(profileId, color, stock)
  bar.cuts.push(cut)
  bars.push(bar)
}

function bundleKey(profileId: string, color: string): string {
  return `${profileId}::${color}`
}

function explainSplit(origin: BomPart, pieces: number[]): string | null {
  if (pieces.length <= 1) return null
  const kindLabel = origin.kind === 'frame' ? 'рамная балка' : origin.kind === 'angle' ? 'уголок' : origin.kind
  const detail = pieces.map((p) => (Math.abs(p - Math.round(p)) < 1e-6 ? String(Math.round(p)) : p.toFixed(1))).join(' + ')
  return `${kindLabel} ${origin.lengthCm} см: ${detail}`
}

/**
 * Cover `lengthCm` with pieces no shorter than minPiece (except a leftover
 * shorter than minPiece when the whole run is that short). Prefer leftover
 * room on existing bars of the same bundle, then new stock.
 */
function coverWithPieces(
  lengthCm: number,
  minPieceCm: number,
  stock: number,
  bars: NestedBar[],
  kerfCm: number,
): number[] {
  const pieces: number[] = []
  let remaining = lengthCm
  while (remaining > EPS) {
    const leftoverBars = bars
      .map((b) => ({ bar: b, room: b.stockLengthCm - usedOnBar(b.cuts, kerfCm) - (b.cuts.length > 0 ? kerfCm : 0) }))
      .filter((x) => x.room >= Math.min(remaining, minPieceCm) - EPS)
      .sort((a, b) => a.room - b.room)

    const room = leftoverBars[0]?.room ?? stock
    const take = Math.min(remaining, room, stock)
    if (take <= EPS) break
    if (take + EPS < minPieceCm && remaining + EPS >= minPieceCm) {
      pieces.push(minPieceCm)
      remaining -= minPieceCm
      continue
    }
    pieces.push(take)
    remaining -= take
  }
  return pieces
}

export function nest(parts: BomPart[], settings?: Partial<NestSettings>): NestResult {
  const cfg = mergeNestSettings(settings)
  const explanations: string[] = []

  const structural = parts.filter((p) => p.kind !== 'angle' && nestLengthCm(p) > 0)
  const angles = parts.filter((p) => p.kind === 'angle' && nestLengthCm(p) > 0)

  const segments: SplitSegment[] = []

  for (const part of structural) {
    const stock = stockLengthCm(cfg.catalog, part.profileId, cfg.defaultStockLengthCm)
    const raw = nestLengthCm(part)
    const pieces = raw > stock
      ? splitForStock(raw, stock, part.kind === 'frame' ? cfg.frameSplit : 'economical', cfg.minRemainderCm)
      : [raw]
    const note = explainSplit(part, pieces)
    if (note) {
      const stockNote = pieces[0] === stock && pieces.length === 2
        ? `хлыст ${stock} + остаток ${pieces[1]}`
        : pieces.join(' + ')
      explanations.push(
        part.kind === 'frame' && raw > stock
          ? `рамная балка ${raw} см: ${stockNote}`
          : note,
      )
    }
    pieces.forEach((lengthCm, i) => {
      segments.push({
        partId: pieces.length === 1 ? part.id : `${part.id}#${i}`,
        originPartId: part.id,
        lengthCm,
        kind: part.kind,
        profileId: part.profileId,
        color: part.color,
      })
    })
  }

  const barsByBundle = new Map<string, NestedBar[]>()

  const sorted = [...segments].sort((a, b) => b.lengthCm - a.lengthCm || a.partId.localeCompare(b.partId))
  for (const seg of sorted) {
    const stock = stockLengthCm(cfg.catalog, seg.profileId, cfg.defaultStockLengthCm)
    const key = bundleKey(seg.profileId, seg.color)
    const bars = barsByBundle.get(key) ?? []
    placeOnFirstFit(
      bars,
      { partId: seg.partId, originPartId: seg.originPartId, lengthCm: seg.lengthCm },
      seg.profileId,
      seg.color,
      stock,
      cfg.kerfCm,
    )
    barsByBundle.set(key, bars)
  }

  for (const part of angles) {
    const stock = stockLengthCm(cfg.catalog, part.profileId, cfg.defaultStockLengthCm)
    const key = bundleKey(part.profileId, part.color)
    const bars = barsByBundle.get(key) ?? []
    const raw = nestLengthCm(part)

    let pieces: number[]
    if (cfg.hiddenAngles === 'pieces' && raw > cfg.minReusableOffcutCm) {
      pieces = coverWithPieces(raw, cfg.minReusableOffcutCm, stock, bars, cfg.kerfCm)
      if (pieces.length > 1) {
        explanations.push(`уголок ${raw} см (сборный): ${pieces.map((p) => roundLabel(p)).join(' + ')}`)
      }
    } else if (raw > stock) {
      pieces = splitForStock(raw, stock, cfg.frameSplit, cfg.minRemainderCm)
      const note = explainSplit(part, pieces)
      if (note) explanations.push(note)
    } else {
      pieces = [raw]
    }

    pieces.forEach((lengthCm, i) => {
      placeOnFirstFit(
        bars,
        {
          partId: pieces.length === 1 ? part.id : `${part.id}#${i}`,
          originPartId: part.id,
          lengthCm,
        },
        part.profileId,
        part.color,
        stock,
        cfg.kerfCm,
      )
    })
    barsByBundle.set(key, bars)
  }

  const bars: NestedBar[] = []
  for (const bundleBars of barsByBundle.values()) {
    for (const bar of bundleBars) {
      bars.push(finalizeBar(bar, cfg.kerfCm, cfg.minReusableOffcutCm))
    }
  }

  const totalStock = bars.reduce((s, b) => s + b.stockLengthCm, 0)
  const totalRemainder = bars.reduce((s, b) => s + b.remainderCm, 0)
  const totalWastePct = totalStock > 0 ? (totalRemainder / totalStock) * 100 : 0

  return { bars, totalWastePct, explanations }
}

function roundLabel(n: number): string {
  return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(1)
}

export function barUsedCm(bar: NestedBar, kerfCm: number): number {
  return usedOnBar(bar.cuts, kerfCm)
}
