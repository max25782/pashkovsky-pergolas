import type { OfferDraft, OfferCalculation } from '@/types/offer'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'
import { calculateSuntufSheets, calculateSuntufPriceByArea } from '@/lib/calculations/suntuf-sheets'

export function calculateOffer(draft: OfferDraft): OfferCalculation {
  // 1. Calculate area from shape (0 if no pergola)
  const pergolaArea = draft.pergola?.shape ? calculatePergolaArea(draft.pergola.shape) : 0
  
  // 2. Calculate santaf area (use pergola area if pergola exists, otherwise use santaf dimensions)
  let santafArea = 0
  if (draft.santaf.enabled) {
    if (draft.pergola?.shape) {
      // Use pergola area if pergola is included
      santafArea = pergolaArea
    } else if (draft.santaf.width && draft.santaf.length) {
      // Use santaf dimensions if pergola is not included
      santafArea = draft.santaf.width * draft.santaf.length
    }
  }
  
  // Use pergola area for general area calculation
  const area = pergolaArea || santafArea

  // 3. Calculate pergola price
  const pergolaTotal = draft.pergola ? pergolaArea * draft.pergola.pricePerSqm : undefined
  
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
    
    if (draft.pergola?.shape) {
      // Extract from pergola shape (for rectangle shapes)
      if (draft.pergola.shape.type === 'rectangle') {
        suntufWidth = draft.pergola.shape.width
        suntufLength = draft.pergola.shape.length
      } else {
        // For complex shapes, use pergola area as approximation
        // This is a fallback - ideally complex shapes should be broken down
        // For now, we'll use square root approximation for width/length
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
  const totalBeforeVat = (pergolaTotal || 0) + santafTotal + zipScreenTotal + lightingTotal + drainageTotal + winterClosureTotal
  
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
    pergolaTotal,
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
