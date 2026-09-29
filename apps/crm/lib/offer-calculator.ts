import type { OfferDraft, OfferCalculation } from '@/types/offer'
import { gateUnitTotal } from '@/types/offer'
// calculateSuntufSheets is used ONLY in the cutting list (lib/cut-list/calculate-cut-list.ts),
// never for pricing. Price = covered area × rate, overlap waste is baked into the rate.
import { lineAmountFromBillableArea, pergolaAreaSqm } from '@/lib/pergolas/pergola-area-sqm'
// (suntuf-sheets import removed — sheet calc is for cut list only, not pricing)
import { resolveQuickOfferIncludes } from '@/lib/quick-offer-includes'

/** Face area m² for quick-offer railings/fence: length (m) × height (m). */
export function quickOfferRailingsFenceAreaSqm(
  metersTotal: number,
  heightCm: number | undefined,
): number {
  const len = Math.max(0, Number(metersTotal) || 0)
  const hM =
    heightCm != null && Number(heightCm) > 0 ? Math.max(0, Number(heightCm)) / 100 : 0
  if (len <= 0 || hM <= 0) return 0
  return Math.round(len * hM * 1000) / 1000
}

function quickOfferLinePerSqmLegacy(
  row: { pricePerSqm?: number; pricePerMeter?: number },
): number {
  return Math.max(0, Number(row.pricePerSqm ?? row.pricePerMeter) || 0)
}

const DEFAULT_VAT_PERCENT = 18

function normalizeVatPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_VAT_PERCENT
  return Math.min(100, Math.max(0, n))
}

/** Resolve the list of fences: prefer quickFences array, fall back to legacy quickFence. */
export function resolveQuickFences(draft: OfferDraft): import('@/types/offer').QuickOfferFenceDraft[] {
  if (draft.quickFences && draft.quickFences.length > 0) return draft.quickFences
  if (draft.quickFence) return [draft.quickFence]
  return []
}

function railFenceSqmForZip(draft: OfferDraft, inc: ReturnType<typeof resolveQuickOfferIncludes>): number {
  let sqm = 0
  if (inc.railings && draft.quickRailings) {
    sqm += quickOfferRailingsFenceAreaSqm(
      draft.quickRailings.metersTotal,
      draft.quickRailings.heightCm,
    )
  }
  if (inc.fence) {
    for (const qf of resolveQuickFences(draft)) {
      sqm += quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
    }
  }
  return sqm
}

export function calculateOffer(draft: OfferDraft): OfferCalculation {
  const inc = resolveQuickOfferIncludes(draft)

  // Support multiple pergolas - use pergolas array if available, otherwise fall back to single pergola
  const pergolas = draft.pergolas || (draft.pergola ? [draft.pergola] : [])

  let railingsLineTotal: number | undefined
  let fenceLineTotal: number | undefined
  let fenceLineTotals: number[] | undefined

  if (inc.railings && draft.quickRailings) {
    const qr = draft.quickRailings
    const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
    const p = quickOfferLinePerSqmLegacy(qr)
    railingsLineTotal = sqm * p
  }
  let fenceGateLineTotals: number[][] | undefined
  let fenceGateTotal: number | undefined

  if (inc.fence) {
    const fences = resolveQuickFences(draft)
    if (fences.length > 0) {
      fenceLineTotals = fences.map((qf) => {
        const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
        const p = quickOfferLinePerSqmLegacy(qf)
        return sqm * p
      })
      fenceLineTotal = fenceLineTotals.reduce((s, v) => s + v, 0)

      // Gate totals (per section, per gate)
      const perSectionGates = fences.map((qf) =>
        (qf.gates ?? []).map((g) => Math.round(gateUnitTotal(g) * 100) / 100),
      )
      const hasAnyGates = perSectionGates.some((sg) => sg.length > 0)
      if (hasAnyGates) {
        fenceGateLineTotals = perSectionGates
        fenceGateTotal = perSectionGates.flat().reduce((s, v) => s + v, 0)
      }
    }
  }

  // 1. Calculate total area from all pergolas (when pergola line is included)
  let pergolaArea = 0
  let pergolaTotal = 0

  if (inc.pergola) {
    for (const pergola of pergolas) {
      if (!pergola) continue
      const singleArea = pergolaAreaSqm(pergola)
      if (singleArea === null || singleArea <= 0) continue
      pergolaArea += singleArea
      pergolaTotal += lineAmountFromBillableArea(singleArea, pergola.pricePerSqm)
    }
  }
  
  // 2. Calculate santaf area (use pergola area if pergolas exist, otherwise use santaf dimensions)
  let santafArea = 0
  if (draft.santaf.enabled) {
    if (pergolaArea > 0) {
      santafArea = pergolaArea
    } else if (draft.santaf.width && draft.santaf.length) {
      santafArea = draft.santaf.width * draft.santaf.length
    }
  }
  
  // Use pergola area for general area calculation
  const area = pergolaArea || santafArea

  // 3. Pergola line total (when pergola is included)
  const pergolaTotalFinal = inc.pergola && pergolaTotal > 0 ? pergolaTotal : undefined

  const mainProductTotal =
    (pergolaTotalFinal ?? 0) + (railingsLineTotal ?? 0) + (fenceLineTotal ?? 0)

  // ── Determine whether this offer uses per-pergola addons ────────────────────
  // An offer "has per-pergola addons" if at least one pergola has an explicit
  // santaf/drainage/lighting field (even if disabled).  Old offers stored without
  // these fields fall back to the offer-level values (backward compat).
  const hasPerPergolaAddons =
    inc.pergola &&
    pergolas.some(
      (p) => p !== undefined && (p.santaf !== undefined || p.drainage !== undefined || p.lighting !== undefined),
    )

  // 4. Santaf
  let santafTotal = 0

  // Price = covered area × rate. Sheet overlap is baked into the rate, not into the area.
  // calculateSuntufSheets is used only in the cutting list (lib/cut-list), never here.
  if (hasPerPergolaAddons) {
    // Per-pergola mode: price = pergolaAreaSqm(pergola) × ps.pricePerSqm
    // Rectangle and polygon give the same pergolaAreaSqm — no divergence.
    for (const pergola of pergolas) {
      if (!pergola) continue
      const ps = pergola.santaf
      if (!ps?.enabled) continue
      const pgArea = pergolaAreaSqm(pergola) ?? 0
      if (pgArea <= 0) continue
      santafTotal += Math.round(pgArea * ps.pricePerSqm * 100) / 100
    }
  } else {
    // Legacy offer-level santaf (standalone or with untagged pergolas)
    if (draft.santaf.enabled && santafArea > 0) {
      const rate = draft.santaf.withStructure
        ? draft.santaf.pricePerSqmWithStructure
        : draft.santaf.pricePerSqmBasic
      santafTotal = Math.round(santafArea * rate * 100) / 100
    }
  }

  // 5. ZIP screen price (if enabled)
  let zipScreenTotal = 0
  if (draft.zipScreen.enabled && draft.zipScreen.type) {
    const zipPrice = draft.zipScreen.type === 'electric'
      ? draft.zipScreen.pricePerSqmElectric
      : draft.zipScreen.pricePerSqmManual

    const railFenceSqm = railFenceSqmForZip(draft, inc)
    const pergolaAreaForZip = pergolas.reduce(
      (sum, pergola) => sum + (pergola ? pergolaAreaSqm(pergola) ?? 0 : 0),
      0,
    )
    // Use running meters if set; else m² (pergola roof and/or railings/fence face) × ZIP ₪/m²
    const zipQty = draft.zipScreen.runningMeters || railFenceSqm || pergolaAreaForZip || area
    zipScreenTotal = zipQty * zipPrice
  }
  
  // 6. Lighting (LED)
  let lightingTotal = 0
  if (hasPerPergolaAddons) {
    for (const pergola of pergolas) {
      if (!pergola) continue
      const pl = pergola.lighting
      if (!pl?.enabled) continue
      const m = pl.runningMeters ?? 0
      lightingTotal += Math.round(m * pl.pricePerMeter * 100) / 100
    }
  } else if (draft.lighting.enabled) {
    const meters = draft.lighting.runningMeters || 0
    lightingTotal = meters * draft.lighting.pricePerMeter
  }

  // 7. Drainage (מרזב)
  let drainageTotal = 0
  if (hasPerPergolaAddons) {
    for (const pergola of pergolas) {
      if (!pergola) continue
      const pd = pergola.drainage
      if (!pd?.enabled) continue
      const m = pd.runningMeters ?? 0
      drainageTotal += Math.round(m * pd.pricePerMeter * 100) / 100
    }
  } else if (draft.drainage.enabled) {
    const meters = draft.drainage.runningMeters || 0
    drainageTotal = meters * draft.drainage.pricePerMeter
  }
  
  // 8. Calculate winter closure price (if enabled)
  let winterClosureTotal = 0
  if (draft.winterClosure.enabled && draft.winterClosure.items.length > 0) {
    winterClosureTotal = draft.winterClosure.items.reduce((sum, item) => {
      return sum + (item.area * item.pricePerSqm)
    }, 0)
  }
  
  // 9. Calculate total before VAT
  const totalBeforeVat =
    mainProductTotal + (fenceGateTotal ?? 0) + santafTotal + zipScreenTotal + lightingTotal + drainageTotal + winterClosureTotal
  
  // 10. VAT (% of total before VAT)
  const vatPct = normalizeVatPercent(draft.vatPercent)
  const vatAmount = totalBeforeVat * (vatPct / 100)

  // 11. Calculate price with VAT
  const priceWithVat = totalBeforeVat + vatAmount
  
  // 12. Calculate discount (APPLIED AFTER VAT - IMPORTANT!)
  const discountPercent = draft.discountPercent || 0
  const discountAmount = (priceWithVat * discountPercent) / 100
  
  // 13. Calculate final price
  const finalPrice = priceWithVat - discountAmount

  // Summary quantity: m² (pergola roof area, or railings/fence face area for ZIP fallback / AI)
  const railFenceOnlySqm = railFenceSqmForZip(draft, inc)
  const areaDisplay =
    inc.pergola && pergolaArea > 0
      ? pergolaArea
      : railFenceOnlySqm > 0
        ? railFenceOnlySqm
        : area

  return {
    area: areaDisplay,
    pergolaTotal: pergolaTotalFinal,
    railingsLineTotal,
    fenceLineTotal,
    fenceLineTotals,
    fenceGateLineTotals,
    fenceGateTotal,
    santafTotal,
    zipScreenTotal,
    lightingTotal,
    drainageTotal,
    winterClosureTotal,
    totalBeforeVat,
    vatPercent: vatPct,
    vatAmount,
    priceWithVat,
    discountPercent,
    discountAmount,
    finalPrice
  }
}

export const LANGUAGE_CURRENCY: Record<string, { code: string; locale: string }> = {
  he: { code: 'ILS', locale: 'he-IL' },
  en: { code: 'USD', locale: 'en-US' },
  ru: { code: 'RUB', locale: 'ru-RU' },
  sr: { code: 'RSD', locale: 'sr-RS' },
}

export function formatPrice(price: number, currencyCode = 'ILS', locale = 'he-IL'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}
