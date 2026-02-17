'use client'

interface QuantityInputProps {
  value: number
  max: number
  onChange: (value: number) => void
}

export function QuantityInput({ value, max, onChange }: QuantityInputProps) {
  const handleDecrease = () => {
    if (value > 1) {
      onChange(value - 1)
    }
  }

  const handleIncrease = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDecrease}
        disabled={value <= 1}
        className="w-10 h-10 flex items-center justify-center border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        -
      </button>
      <input
        type="number"
        value={value}
        min={1}
        max={max}
        onChange={(e) => {
          const newValue = parseInt(e.target.value, 10)
          if (!isNaN(newValue) && newValue >= 1 && newValue <= max) {
            onChange(newValue)
          }
        }}
        className="w-20 text-center border border-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        onClick={handleIncrease}
        disabled={value >= max}
        className="w-10 h-10 flex items-center justify-center border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  )
}
