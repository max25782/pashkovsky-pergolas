'use client'

import { StockInfo } from '@/lib/api-client'
import { cn } from '@/lib/cn'

interface ColorSelectorProps {
  colors: string[]
  selectedColor: string
  stock: StockInfo[]
  selectedLength: number
  onSelectColor: (color: string) => void
}

export function ColorSelector({
  colors,
  selectedColor,
  stock,
  selectedLength,
  onSelectColor,
}: ColorSelectorProps) {
  const getStockForColor = (color: string) => {
    return (
      stock.find((s) => s.color === color && s.length_meters === selectedLength)?.qty_available ||
      0
    )
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {colors.map((color) => {
        const available = getStockForColor(color)
        const isSelected = selectedColor === color
        const isDisabled = available === 0

        return (
          <button
            key={color}
            onClick={() => !isDisabled && onSelectColor(color)}
            disabled={isDisabled}
            className={cn(
              'px-4 py-2 rounded-lg border-2 font-medium transition-colors',
              isSelected
                ? 'border-primary bg-blue-50 text-primary'
                : 'border-gray-100 hover:border-primary/50',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {color} {available > 0 && `(${available})`}
          </button>
        )
      })}
    </div>
  )
}
