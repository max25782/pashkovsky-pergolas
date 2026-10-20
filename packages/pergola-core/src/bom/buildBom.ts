import { resolveProfile, stockLengthCm } from './catalog'
import { mergeNestSettings } from './defaults'
import { buildParts } from './buildParts'
import { fasteners } from './fasteners'
import { nest } from './nest'
import type {
  AluminumLine,
  BomModel,
  BomPrices,
  BomResult,
  FastenerRule,
  NestSettings,
} from './types'

function priceKg(prices: BomPrices | undefined, profileId: string): number | undefined {
  const table = prices?.aluminumIlsPerKg
  if (table == null) return undefined
  if (typeof table === 'number') return table
  return table[profileId]
}

export function buildBom(
  model: BomModel,
  settings?: Partial<NestSettings>,
  rules?: FastenerRule[],
  prices?: BomPrices,
): BomResult {
  const cfg = mergeNestSettings(settings)
  const parts = buildParts(model, cfg)
  const nestResult = nest(parts, cfg)
  const fastenerLines = fasteners(model, parts, rules).map((line) => {
    const override = prices?.fastenerIlsPerUnit?.[line.id]
    const pricePerUnit = override ?? line.pricePerUnit
    return {
      ...line,
      pricePerUnit,
      costIls: pricePerUnit != null ? line.total * pricePerUnit : undefined,
    }
  })

  const bundles = new Map<string, AluminumLine>()
  for (const bar of nestResult.bars) {
    const key = `${bar.profileId}::${bar.color}`
    const profile = resolveProfile(cfg.catalog, bar.profileId)
    const stockM = bar.stockLengthCm / 100
    const usedM = bar.cuts.reduce((s, c) => s + c.lengthCm, 0) / 100
    const existing = bundles.get(key)
    if (existing) {
      existing.bars += 1
      existing.stockMeters += stockM
      existing.usedMeters += usedM
    } else {
      bundles.set(key, {
        profileId: bar.profileId,
        section: profile.section,
        color: bar.color,
        bars: 1,
        stockLengthCm: stockLengthCm(cfg.catalog, bar.profileId, cfg.defaultStockLengthCm),
        stockMeters: stockM,
        usedMeters: usedM,
        usagePct: 0,
        weightKg: 0,
      })
    }
  }

  const aluminum: AluminumLine[] = [...bundles.values()].map((line) => {
    const profile = resolveProfile(cfg.catalog, line.profileId)
    const weightKg = line.stockMeters * profile.weightKgPerM
    const usagePct = line.stockMeters > 0 ? (line.usedMeters / line.stockMeters) * 100 : 0
    const ilsPerKg = priceKg(prices, line.profileId)
    return {
      ...line,
      usagePct,
      weightKg,
      costIls: ilsPerKg != null ? ilsPerKg * weightKg : undefined,
    }
  })

  const hardware = parts.filter((p) => p.kind === 'hardware')
  const weightKg = aluminum.reduce((s, l) => s + l.weightKg, 0)
  const aluminumCostIls = aluminum.every((l) => l.costIls != null)
    ? aluminum.reduce((s, l) => s + (l.costIls ?? 0), 0)
    : aluminum.some((l) => l.costIls != null)
      ? aluminum.reduce((s, l) => s + (l.costIls ?? 0), 0)
      : undefined
  const fastenerCostIls = fastenerLines.every((l) => l.costIls != null)
    ? fastenerLines.reduce((s, l) => s + (l.costIls ?? 0), 0)
    : fastenerLines.some((l) => l.costIls != null)
      ? fastenerLines.reduce((s, l) => s + (l.costIls ?? 0), 0)
      : undefined
  const totalCostIls =
    aluminumCostIls != null || fastenerCostIls != null
      ? (aluminumCostIls ?? 0) + (fastenerCostIls ?? 0)
      : undefined

  return {
    parts,
    nest: nestResult,
    aluminum,
    hardware,
    fasteners: fastenerLines,
    totals: {
      weightKg,
      wastePct: nestResult.totalWastePct,
      aluminumCostIls,
      fastenerCostIls,
      totalCostIls,
    },
  }
}
