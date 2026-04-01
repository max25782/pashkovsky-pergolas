/**
 * Winter Closure Pricing Configuration
 * מחירים לסגירת חורף (זכוכית)
 */

export const WINTER_CLOSURE_PRICES = {
  // חלונות
  windows7000: 950,    // ₪ למטר מרובע
  windows9000: 1050,   // ₪ למטר מרובע
  
  // זכוכית קבועה
  fixedGlass: 750,     // ₪ למטר מרובע
  
  // ויטרינה הזזה
  slidingShowcase7000: 1200,  // ₪ למטר מרובע
  slidingShowcase9000: 1800,  // ₪ למטר מרובע
  
  // זכוכית סליידר
  sliderGlass: 1650,   // ₪ למטר מרובע

  // זכוכית מתקפלת (מחיר ישן - לשמירה על תאימות)
  foldingGlass: 0,     // ₪ למטר מרובע - צריך להזין ידנית
} as const

export type WinterClosureType = keyof typeof WINTER_CLOSURE_PRICES

/**
 * Get price per square meter for winter closure type
 */
export function getWinterClosurePrice(type: WinterClosureType | undefined): number {
  if (!type) return 0
  return WINTER_CLOSURE_PRICES[type] || 0
}

/**
 * Calculate total winter closure price for a single item
 */
export function calculateWinterClosureItemTotal(
  type: WinterClosureType | undefined,
  area: number | undefined
): number {
  if (!type || !area) return 0
  const pricePerSqm = getWinterClosurePrice(type)
  return pricePerSqm * area
}

/**
 * Calculate total winter closure price for multiple items
 */
export function calculateWinterClosureTotalFromItems(
  items: Array<{ type: WinterClosureType; area: number; pricePerSqm: number }>
): number {
  return items.reduce((sum, item) => sum + (item.area * item.pricePerSqm), 0)
}

/**
 * Get display name for winter closure type
 */
export function getWinterClosureTypeName(type: WinterClosureType | undefined): string {
  const names: Record<WinterClosureType, string> = {
    foldingGlass: 'זכוכית מתקפלת',
    windows7000: 'חלונות 7000',
    windows9000: 'חלונות 9000',
    fixedGlass: 'זכוכית קבועה',
    slidingShowcase7000: 'ויטרינה הזזה דגם 7000',
    slidingShowcase9000: 'ויטרינה הזזה דגם 9000',
    sliderGlass: 'זכוכית סליידר',
  }
  return type ? names[type] : ''
}

/**
 * Get display name for glass type
 */
export function getGlassTypeName(glassType: string | undefined): string {
  const names: Record<string, string> = {
    tempered: 'מחוסם',
    triplex: 'טריפלקס',
    insulated: 'בידודית',
  }
  return glassType ? names[glassType] : ''
}

