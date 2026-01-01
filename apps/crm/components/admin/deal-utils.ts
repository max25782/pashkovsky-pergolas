export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return dateStr.slice(0, 16).replace('T', ' ')
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount)
}

export function formatDimensions(width: number | null | undefined, depth: number | null | undefined): string {
  if (width && depth) return `${width}×${depth} см`
  if (width) return `${width}×? см`
  if (depth) return `?×${depth} см`
  return '-'
}

