import type { OfferDraft, OfferCalculation, QuickOfferProductType } from '@/types/offer'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'
import { calculateSuntufSheets, calculateSuntufPriceByArea } from '@/lib/calculations/suntuf-sheets'

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

export function calculateOffer(draft: OfferDraft): OfferCalculation {
  const productKind: QuickOfferProductType = draft.quickProduct ?? 'pergola'

  // Support multiple pergolas - use pergolas array if available, otherwise fall back to single pergola
  const pergolas = draft.pergolas || (draft.pergola ? [draft.pergola] : [])

  let railingsLineTotal: number | undefined
  let fenceLineTotal: number | undefined

  if (productKind === 'railings' && draft.quickRailings) {
    const qr = draft.quickRailings
    const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
    const p = quickOfferLinePerSqmLegacy(qr)
    railingsLineTotal = sqm * p
  } else if (productKind === 'fence' && draft.quickFence) {
    const qf = draft.quickFence
    const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
    const p = quickOfferLinePerSqmLegacy(qf)
    fenceLineTotal = sqm * p
  }

  // 1. Calculate total area from all pergolas (pergola product only)
  let pergolaArea = 0
  let pergolaTotal = 0

  if (productKind === 'pergola') {
    for (const pergola of pergolas) {
      if (pergola?.shape) {
        const singleArea = calculatePergolaArea(pergola.shape)
        pergolaArea += singleArea
        pergolaTotal += singleArea * pergola.pricePerSqm
      }
    }
  }
  
  // 2. Calculate santaf area (use pergola area if pergolas exist, otherwise use santaf dimensions)
  let santafArea = 0
  if (draft.santaf.enabled) {
    if (pergolaArea > 0) {
      // Use total pergola area if pergolas are included
      santafArea = pergolaArea
    } else if (draft.santaf.width && draft.santaf.length) {
      // Use santaf dimensions if pergola is not included
      santafArea = draft.santaf.width * draft.santaf.length
    }
  }
  
  // Use pergola area for general area calculation
  const area = pergolaArea || santafArea

  // 3. Pergola line total (pergola product only)
  const pergolaTotalFinal =
    productKind === 'pergola' && pergolas.length > 0 ? pergolaTotal : undefined

  const mainProductTotal =
    (pergolaTotalFinal ?? 0) + (railingsLineTotal ?? 0) + (fenceLineTotal ?? 0)
  
  // 4. Calculate santaf price (if enabled)
  // IMPORTANT: Suntuf sheets are priced by MATERIAL AREA (full sheet dimensions),
  // not pergola area, due to mandatory overlaps between sheets.
  // When multiple pergolas exist each one gets its own sheet calculation — sheets
  // cannot be shared across separate structures.
  let santafTotal = 0
  if (draft.santaf.enabled && santafArea > 0) {
    const santafPrice = draft.santaf.withStructure
      ? draft.santaf.pricePerSqmWithStructure
      : draft.santaf.pricePerSqmBasic

    const overlapType = draft.santaf.overlapType || 'double'
    let totalSuntufMaterialArea = 0

    if (pergolas.length > 0) {
      // Calculate suntuf sheets for EACH pergola independently and sum material areas.
      // Sheets cannot span multiple pergolas — each structure needs its own count.
      for (const pergola of pergolas) {
        if (!pergola?.shape) continue
        let w = 0
        let l = 0
        if (pergola.shape.type === 'rectangle') {
          w = pergola.shape.width
          l = pergola.shape.length
        } else {
          // For L/X/U shapes approximate as a square with the same area
          const singleArea = calculatePergolaArea(pergola.shape)
          const side = Math.sqrt(singleArea)
          w = side
          l = side
        }
        if (w > 0 && l > 0) {
          const suntufCalc = calculateSuntufSheets(w, l, overlapType)
          totalSuntufMaterialArea += suntufCalc.suntufMaterialArea
        }
      }
    } else if (draft.santaf.width && draft.santaf.length) {
      // Standalone santaf without pergolas
      const suntufCalc = calculateSuntufSheets(draft.santaf.width, draft.santaf.length, overlapType)
      totalSuntufMaterialArea = suntufCalc.suntufMaterialArea
    }

    if (totalSuntufMaterialArea > 0) {
      santafTotal = calculateSuntufPriceByArea(totalSuntufMaterialArea, santafPrice)
    } else {
      // Fallback: use pergola area if dimensions not available (legacy support)
      santafTotal = santafArea * santafPrice
    }
  }
  
  // 5. Calculate ZIP screen price (if enabled)
  let zipScreenTotal = 0
  if (draft.zipScreen.enabled && draft.zipScreen.type) {
    const zipPrice = draft.zipScreen.type === 'electric'
      ? draft.zipScreen.pricePerSqmElectric
      : draft.zipScreen.pricePerSqmManual

    const railFenceSqmForZip =
      productKind === 'railings' && draft.quickRailings
        ? quickOfferRailingsFenceAreaSqm(draft.quickRailings.metersTotal, draft.quickRailings.heightCm)
        : productKind === 'fence' && draft.quickFence
          ? quickOfferRailingsFenceAreaSqm(draft.quickFence.metersTotal, draft.quickFence.heightCm)
          : 0
    // Use running meters if set; else m² (pergola roof or railings/fence face) × ZIP ₪/m²
    const zipQty = draft.zipScreen.runningMeters || railFenceSqmForZip || area
    zipScreenTotal = zipQty * zipPrice
  }
  
  // 6. Calculate lighting price (if enabled)
  let lightingTotal = 0
  if (draft.lighting.enabled) {
    const meters = draft.lighting.runningMeters || 0
    lightingTotal = meters * draft.lighting.pricePerMeter
  }
  
  // 7. Calculate drainage price (if enabled)
  let drainageTotal = 0
  if (draft.drainage.enabled) {
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
    mainProductTotal + santafTotal + zipScreenTotal + lightingTotal + drainageTotal + winterClosureTotal
  
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
  const areaDisplay =
    productKind === 'railings' && draft.quickRailings
      ? quickOfferRailingsFenceAreaSqm(draft.quickRailings.metersTotal, draft.quickRailings.heightCm)
      : productKind === 'fence' && draft.quickFence
        ? quickOfferRailingsFenceAreaSqm(draft.quickFence.metersTotal, draft.quickFence.heightCm)
        : area

  return {
    area: areaDisplay,
    pergolaTotal: pergolaTotalFinal,
    railingsLineTotal,
    fenceLineTotal,
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

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}
