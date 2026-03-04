'use client'

import { useState, useMemo } from 'react'
import { Profile, StockInfo } from '@/lib/api-client'
import { ProductImage } from '@/components/product/ProductImage'
import { LengthSelector } from '@/components/product/LengthSelector'
import { ColorSelector } from '@/components/product/ColorSelector'
import { QuantityInput } from '@/components/product/QuantityInput'
import { AddToCartButton } from '@/components/product/AddToCartButton'
import { type Locale } from '@/lib/locales'

interface ProductDetailClientProps {
  profile: Profile
  stock: StockInfo[]
  locale: Locale
  defaultLength: number
  defaultColor: string
  availableColors: string[]
}

export function ProductDetailClient({
  profile,
  stock,
  locale,
  defaultLength,
  defaultColor,
  availableColors,
}: ProductDetailClientProps) {
  const [selectedLength, setSelectedLength] = useState(defaultLength)
  const [selectedColor, setSelectedColor] = useState(defaultColor)
  const [quantity, setQuantity] = useState(1)

  const selectedStock = useMemo(() => {
    return stock.find(
      (s) => s.color === selectedColor && s.length_meters === selectedLength
    )
  }, [stock, selectedColor, selectedLength])

  const availableQuantity = selectedStock?.qty_available || 0

  const colorsForSelectedLength = useMemo(() => {
    return [...new Set(stock.filter((s) => s.length_meters === selectedLength).map((s) => s.color))]
  }, [stock, selectedLength])

  return (
    <div className="grid md:grid-cols-2 gap-12">
      <div>
        <ProductImage src={profile.image_url} alt={profile.code} />
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{profile.code}</h1>
        <p className="text-lg text-gray-600 mt-2">{profile.dimensions}</p>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Select Length
          </label>
          <LengthSelector
            availableLengths={profile.available_lengths}
            selectedLength={selectedLength}
            stock={stock}
            onSelectLength={setSelectedLength}
          />
        </div>

        {colorsForSelectedLength.length > 0 && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Color
            </label>
            <ColorSelector
              colors={colorsForSelectedLength}
              selectedColor={selectedColor}
              stock={stock}
              selectedLength={selectedLength}
              onSelectColor={setSelectedColor}
            />
          </div>
        )}

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Quantity
          </label>
          <QuantityInput
            value={quantity}
            max={availableQuantity}
            onChange={setQuantity}
          />
          {availableQuantity > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              {availableQuantity} available
            </p>
          )}
        </div>


        <AddToCartButton
          profile={profile}
          selectedLength={selectedLength}
          selectedColor={selectedColor}
          quantity={quantity}
          locale={locale}
          className="mt-6"
        />
      </div>
    </div>
  )
}
