interface StockBadgeProps {
  count: number
  className?: string
}

export function StockBadge({ count, className }: StockBadgeProps) {
  if (count === 0) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 ${className || ''}`}
    >
      In Stock
    </span>
  )
}
