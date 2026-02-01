import type { OfferDraft, OfferCalculation } from '@/types/offer'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'
import { calculateSuntufSheets, calculateSuntufPriceByArea } from '@/lib/calculations/suntuf-sheets'

export function calculateOffer(draft: OfferDraft): OfferCalculation {
  // Support multiple pergolas - use pergolas array if available, otherwise fall back to single pergola
  const pergolas = draft.pergolas || (draft.pergola ? [draft.pergola] : [])
  
  // 1. Calculate total area from all pergolas
  let pergolaArea = 0
  let pergolaTotal = 0
  
  for (const pergola of pergolas) {
    if (pergola?.shape) {
      const singleArea = calculatePergolaArea(pergola.shape)
      pergolaArea += singleArea
      pergolaTotal += singleArea * pergola.pricePerSqm
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

  // 3. Set pergolaTotal (undefined if no pergolas, otherwise sum of all)
  const pergolaTotalFinal = pergolas.length > 0 ? pergolaTotal : undefined
  
  // 4. Calculate santaf price (if enabled)
  // IMPORTANT: Suntuf sheets are priced by MATERIAL AREA (full sheet dimensions),
  // not pergola area, due to mandatory overlaps between sheets
  let santafTotal = 0
  if (draft.santaf.enabled && santafArea > 0) {
    const santafPrice = draft.santaf.withStructure
      ? draft.santaf.pricePerSqmWithStructure
      : draft.santaf.pricePerSqmBasic
    
    // Extract width and length for Suntuf calculation
    let suntufWidth = 0
    let suntufLength = 0
    
    // Use first pergola for Suntuf calculation (or sum if multiple)
    if (pergolas.length > 0 && pergolas[0]?.shape) {
      const firstPergola = pergolas[0]
      if (firstPergola.shape.type === 'rectangle') {
        // For multiple pergolas, sum widths/lengths or use largest
        // For now, use first pergola dimensions as approximation
        suntufWidth = firstPergola.shape.width
        suntufLength = firstPergola.shape.length
      } else {
        // For complex shapes, use pergola area as approximation
        const sideLength = Math.sqrt(santafArea)
        suntufWidth = sideLength
        suntufLength = sideLength
      }
    } else if (draft.santaf.width && draft.santaf.length) {
      // Use Santaf dimensions directly
      suntufWidth = draft.santaf.width
      suntufLength = draft.santaf.length
    }
    
    // Calculate Suntuf sheets and material area using proper sheet calculation
    if (suntufWidth > 0 && suntufLength > 0) {
      const overlapType = draft.santaf.overlapType || 'double'
      const suntufCalc = calculateSuntufSheets(suntufWidth, suntufLength, overlapType)
      
      // Price based on MATERIAL AREA (full sheet dimensions), not pergola area
      // This ensures correct billing and legal transparency
      santafTotal = calculateSuntufPriceByArea(suntufCalc.suntufMaterialArea, santafPrice)
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
    
    // Use runningMeters if specified, otherwise use area
    const meters = draft.zipScreen.runningMeters || area
    zipScreenTotal = meters * zipPrice
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
  const totalBeforeVat = (pergolaTotalFinal || 0) + santafTotal + zipScreenTotal + lightingTotal + drainageTotal + winterClosureTotal
  
  // 10. Calculate VAT (18%)
  const vatAmount = totalBeforeVat * 0.18
  
  // 11. Calculate price with VAT
  const priceWithVat = totalBeforeVat + vatAmount
  
  // 12. Calculate discount (APPLIED AFTER VAT - IMPORTANT!)
  const discountPercent = draft.discountPercent || 0
  const discountAmount = (priceWithVat * discountPercent) / 100
  
  // 13. Calculate final price
  const finalPrice = priceWithVat - discountAmount
  
  return {
    area,
    pergolaTotal: pergolaTotalFinal,
    santafTotal,
    zipScreenTotal,
    lightingTotal,
    drainageTotal,
    winterClosureTotal,
    totalBeforeVat,
    vatPercent: 18,
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
