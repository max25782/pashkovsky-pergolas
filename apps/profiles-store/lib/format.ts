export function formatPrice(price: number): string {
  return new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

export function formatWeight(weight: number): string {
  return `${weight.toFixed(2)} kg`
}
