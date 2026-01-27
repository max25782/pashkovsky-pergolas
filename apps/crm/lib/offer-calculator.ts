import type { OfferDraft, OfferCalculation } from '@/types/offer'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'

export function calculateOffer(draft: OfferDraft): OfferCalculation {
  // 1. Calculate area from shape (0 if no pergola)
  const area = draft.pergola?.shape ? calculatePergolaArea(draft.pergola.shape) : 0

  // 2. Calculate pergola price
  const pergolaTotal = draft.pergola ? area * draft.pergola.pricePerSqm : undefined
  
  // 3. Calculate santaf price (if enabled)
  let santafTotal = 0
  if (draft.santaf.enabled) {
    const santafPrice = draft.santaf.withStructure
      ? draft.santaf.pricePerSqmWithStructure
      : draft.santaf.pricePerSqmBasic
    santafTotal = area * santafPrice
  }
  
  // 4. Calculate ZIP screen price (if enabled)
  let zipScreenTotal = 0
  if (draft.zipScreen.enabled && draft.zipScreen.type) {
    const zipPrice = draft.zipScreen.type === 'electric'
      ? draft.zipScreen.pricePerSqmElectric
      : draft.zipScreen.pricePerSqmManual
    
    // Use runningMeters if specified, otherwise use area
    const meters = draft.zipScreen.runningMeters || area
    zipScreenTotal = meters * zipPrice
  }
  
  // 5. Calculate lighting price (if enabled)
  let lightingTotal = 0
  if (draft.lighting.enabled) {
    const meters = draft.lighting.runningMeters || 0
    lightingTotal = meters * draft.lighting.pricePerMeter
  }
  
  // 6. Calculate drainage price (if enabled)
  let drainageTotal = 0
  if (draft.drainage.enabled) {
    const meters = draft.drainage.runningMeters || 0
    drainageTotal = meters * draft.drainage.pricePerMeter
  }
  
  // 7. Calculate winter closure price (if enabled)
  let winterClosureTotal = 0
  if (draft.winterClosure.enabled && draft.winterClosure.items.length > 0) {
    winterClosureTotal = draft.winterClosure.items.reduce((sum, item) => {
      return sum + (item.area * item.pricePerSqm)
    }, 0)
  }
  
  // 8. Calculate total before VAT
  const totalBeforeVat = (pergolaTotal || 0) + santafTotal + zipScreenTotal + lightingTotal + drainageTotal + winterClosureTotal
  
  // 9. Calculate VAT (18%)
  const vatAmount = totalBeforeVat * 0.18
  
  // 10. Calculate price with VAT
  const priceWithVat = totalBeforeVat + vatAmount
  
  // 11. Calculate discount (APPLIED AFTER VAT - IMPORTANT!)
  const discountPercent = draft.discountPercent || 0
  const discountAmount = (priceWithVat * discountPercent) / 100
  
  // 11. Calculate final price
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
