'use client'

import { cn } from '@/lib/cn'
import { StockInfo } from '@/lib/api-client'

interface LengthSelectorProps {
  availableLengths: number[]
  selectedLength: number
  stock: StockInfo[]
  onSelectLength: (length: number) => void
}

export function LengthSelector({
  availableLengths,
  selectedLength,
  stock,
  onSelectLength,
}: LengthSelectorProps) {
  const getStockForLength = (length: number) => {
    return stock.find((s) => s.length_meters === length)?.qty_available || 0
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {availableLengths.map((length) => {
        const available = getStockForLength(length)
        const isSelected = selectedLength === length
        const isDisabled = available === 0

        return (
          <button
            key={length}
            onClick={() => !isDisabled && onSelectLength(length)}
            disabled={isDisabled}
            className={cn(
              'px-4 py-2 rounded-lg border-2 font-medium transition-colors',
              isSelected
                ? 'border-primary bg-blue-50 text-primary'
                : 'border-gray-100 hover:border-primary/50',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {length}m {available > 0 && `(${available})`}
          </button>
        )
      })}
    </div>
  )
}
