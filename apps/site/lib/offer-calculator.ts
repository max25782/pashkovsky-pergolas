/**
 * Format price to Hebrew locale with ₪ symbol
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Calculate VAT amount (18%)
 */
export function calculateVAT(amount: number): number {
  return amount * 0.18;
}

/**
 * Calculate price with VAT
 */
export function calculateWithVAT(amount: number): number {
  return amount * 1.18;
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(amount: number, discountPercent: number): number {
  return amount * (discountPercent / 100);
}

