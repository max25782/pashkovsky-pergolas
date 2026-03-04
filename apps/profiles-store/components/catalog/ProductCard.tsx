'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Profile } from '@/lib/api-client'
import { useCart } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'
import { cn } from '@/lib/cn'

interface ProductCardProps {
  profile: Profile
  locale: Locale
  companyId?: string
}

export function ProductCard({ profile, locale, companyId }: ProductCardProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedLength, setSelectedLength] = useState(profile.available_lengths[0] || 6)

  const weightPerMeter = profile.weight_per_meter || 0
  const weightPerUnit = weightPerMeter * selectedLength

  const handleAddToQuote = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const defaultColor = 'default'
    let color = defaultColor
    if (profile.stock && Object.keys(profile.stock).length > 0) {
      const stockEntry = Object.entries(profile.stock).find(
        ([lengthStr]) => Math.abs(parseFloat(lengthStr) - selectedLength) < 0.01
      )
      if (stockEntry) {
        color = stockEntry[1].color
      } else {
        const firstStock = Object.entries(profile.stock)[0]
        if (firstStock) color = firstStock[1].color
      }
    }

    addItem(
      {
        profileId: profile.id,
        code: profile.code,
        color,
        length: selectedLength,
        pricePerPiece: 0,
        weightPerPiece: (profile.weight_per_meter || 0) * selectedLength,
        imageUrl: profile.image_url,
      },
      quantity
    )
  }

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta))
  }

  const parseDimensions = (dims: string) => {
    const parts = dims.split('/')
    return { height: parts[0] || '', width: parts[1] || '', thickness: parts[2] || '' }
  }

  const dims = parseDimensions(profile.dimensions || '')

  const getColorForLength = (length: number): string | null => {
    if (!profile.stock || Object.keys(profile.stock).length === 0) return null
    const stockEntry = Object.entries(profile.stock).find(
      ([lengthStr]) => Math.abs(parseFloat(lengthStr) - length) < 0.01
    )
    if (stockEntry) return stockEntry[1].color !== 'default' ? stockEntry[1].color : null
    const firstStock = Object.entries(profile.stock)[0]
    if (firstStock) return firstStock[1].color !== 'default' ? firstStock[1].color : null
    return null
  }

  const selectedColor = getColorForLength(selectedLength)

  return (
    <div className={cn(
      'bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden',
      locale === 'he' && 'text-right'
    )}>
      {/* Top Section: Product Code & SKU */}
      <div className="p-4 pb-2">
        <div className="text-right">
          <h3 className="text-lg font-semibold text-gray-900">
            <Link href={`/${locale}/${profile.id}`} className="hover:text-primary transition-colors">
              {profile.code}
            </Link>
          </h3>
          {profile.sku && (
            <p className="text-sm text-gray-600 mt-1">
              {profile.sku} :מק&quot;ט
            </p>
          )}
        </div>
      </div>

      {/* Image Section */}
      <div className="px-4 pb-2">
        <Link href={`/${locale}/${profile.id}`} className="block">
          <div className="relative w-full h-24 bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
            {profile.image_url ? (
              <Image
                src={profile.image_url}
                alt={profile.code}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority
              />
            ) : null}
          </div>
        </Link>
      </div>

      {/* Length Selector */}
      {profile.available_lengths.length > 1 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <div className="flex flex-wrap gap-2">
            {profile.available_lengths.map((length) => (
              <button
                key={length}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedLength(length)
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-colors',
                  selectedLength === length
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-gray-200 hover:border-primary/50 text-gray-700'
                )}
              >
                {length}m
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Specifications Section */}
      <div className="px-4 py-2 space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">משקל למטר:</span>
          <span className="text-gray-900 font-medium">{weightPerMeter > 0 ? weightPerMeter.toFixed(3) : '0.000'} kg</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">משקל ליחידה:</span>
          <span className="text-gray-900 font-medium">{weightPerUnit.toFixed(3)} kg</span>
        </div>
        {dims.thickness && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">עובי:</span>
            <span className="text-gray-900 font-medium">{dims.thickness} mm</span>
          </div>
        )}
        {selectedColor && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">צבע:</span>
            <span className="text-gray-900 font-medium text-xs">{selectedColor}</span>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="bg-gray-800 border-t-2 border-orange-400 px-4 py-3 flex items-center justify-between gap-4">
        {/* Add to Quote Button */}
        <button
          type="button"
          onClick={handleAddToQuote}
          className={cn(
            'flex-1 px-6 py-3 rounded-full font-medium text-white text-sm transition-all',
            'bg-gray-600 hover:bg-gray-700',
            'shadow-lg cursor-pointer',
            locale === 'he' && 'text-right'
          )}
        >
          {locale === 'he' ? 'הוסף להצעת המחיר' : getTranslation(locale, 'product.addToQuote')}
        </button>

        {/* Quantity Control */}
        <div className="flex items-center gap-2">
          <span className="text-white text-sm whitespace-nowrap">כמות</span>
          <div className="flex items-center bg-gray-700 rounded-full border border-gray-600">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuantityChange(-1) }}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-600 rounded-l-full transition-colors"
            >
              <span className="text-lg leading-none">−</span>
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1) setQuantity(val)
              }}
              className="w-12 h-8 text-center text-white bg-transparent border-0 focus:outline-none text-sm"
            />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuantityChange(1) }}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-600 rounded-r-full transition-colors"
            >
              <span className="text-lg leading-none">+</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
