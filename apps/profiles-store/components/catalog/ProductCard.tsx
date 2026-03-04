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
  const [added, setAdded] = useState(false)

  const weightPerMeter = profile.weight_per_meter || 0
  const pricePerKg = profile.price_per_kg || 0
  const weightPerUnit = weightPerMeter * selectedLength
  const pricePerUnit = weightPerMeter * selectedLength * pricePerKg

  const getColorForLength = (length: number): string => {
    if (!profile.stock || Object.keys(profile.stock).length === 0) return 'default'
    const entry = Object.entries(profile.stock).find(
      ([k]) => Math.abs(parseFloat(k) - length) < 0.01
    )
    if (entry) return entry[1].color
    const first = Object.entries(profile.stock)[0]
    return first ? first[1].color : 'default'
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(
      {
        profileId: profile.id,
        code: profile.code,
        color: getColorForLength(selectedLength),
        length: selectedLength,
        pricePerPiece: pricePerUnit,
        imageUrl: profile.image_url,
      },
      quantity
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta))
  }

  const dims = (profile.dimensions || '').split('/')
  const thickness = dims[2] || null

  const isRtl = locale === 'he'

  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden flex flex-col',
        isRtl && 'text-right'
      )}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header: code + sku */}
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-base font-bold text-gray-900 leading-tight">
          <Link
            href={`/${locale}/${profile.id}`}
            className="hover:text-primary transition-colors"
          >
            {profile.code}
          </Link>
        </h3>
        {profile.sku && (
          <p className="text-xs text-gray-600 mt-0.5">
            {isRtl ? `מק"ט: ${profile.sku}` : `SKU: ${profile.sku}`}
          </p>
        )}
      </div>

      {/* Image */}
      <Link href={`/${locale}/${profile.id}`} className="block px-4 py-2">
        <div className="relative w-full h-28 bg-gray-50 rounded overflow-hidden flex items-center justify-center border border-gray-100">
          {profile.image_url ? (
            <Image
              src={profile.image_url}
              alt={profile.code}
              fill
              className="object-contain p-2"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <div className="text-gray-300 text-xs">No image</div>
          )}
        </div>
      </Link>

      {/* Specs */}
      <div className="px-4 py-1 space-y-1 text-xs flex-1">
        <div className="flex justify-between">
          <span className="text-gray-500">{isRtl ? 'משקל למטר:' : 'kg/m:'}</span>
          <span className="font-medium text-gray-800">
            {weightPerMeter > 0 ? weightPerMeter.toFixed(3) : '—'} kg
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{isRtl ? 'משקל ליחידה:' : 'kg/unit:'}</span>
          <span className="font-medium text-gray-800">{weightPerUnit.toFixed(3)} kg</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{isRtl ? 'מחיר ליחידה:' : 'price/unit:'}</span>
          <span className="font-medium text-gray-800">
            {pricePerUnit > 0 ? `₪${pricePerUnit.toFixed(2)}` : '—'}
          </span>
        </div>
        {thickness && (
          <div className="flex justify-between">
            <span className="text-gray-500">{isRtl ? 'עובי:' : 'thickness:'}</span>
            <span className="font-medium text-gray-800">{thickness} mm</span>
          </div>
        )}
        {profile.category && (
          <div className="flex justify-between">
            <span className="text-gray-500">{isRtl ? 'קטגוריה:' : 'category:'}</span>
            <span className="font-medium text-gray-800 truncate max-w-[120px]">{profile.category}</span>
          </div>
        )}
      </div>

      {/* Length selector — dropdown like in the reference */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {isRtl ? 'אורך (מ׳):' : 'Length (m):'}
          </span>
          {profile.available_lengths.length > 1 ? (
            <select
              value={selectedLength}
              onChange={(e) => setSelectedLength(parseFloat(e.target.value))}
              className="flex-1 text-sm font-semibold text-gray-900 bg-white border-2 border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              {profile.available_lengths.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-bold text-gray-900">
              {selectedLength}m
            </span>
          )}
        </div>
      </div>

      {/* Action bar — original site colors: dark bg + orange-400 top border */}
      <div className="bg-gray-800 border-t-2 border-orange-400 px-3 py-2.5 flex items-center gap-2">
        {/* Add to cart button */}
        <button
          type="button"
          onClick={handleAddToCart}
          className={cn(
            'flex-1 py-2 px-3 rounded-full text-sm font-bold transition-all duration-150 shadow',
            added
              ? 'bg-green-500 text-white'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          )}
        >
          {added
            ? (isRtl ? '✓ נוסף!' : '✓ Added!')
            : (isRtl ? 'הוסף להצעת המחיר' : getTranslation(locale, 'product.addToQuote'))}
        </button>

        {/* Quantity stepper */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-white text-xs whitespace-nowrap">
            {isRtl ? 'כמות' : 'Qty'}
          </span>
          <div className="flex items-center bg-gray-700 rounded-full border border-gray-600 overflow-hidden">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuantityChange(-1) }}
              className="w-7 h-7 flex items-center justify-center text-white hover:bg-gray-600 transition-colors text-base leading-none"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 1) setQuantity(v)
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-10 h-7 text-center text-white bg-transparent border-0 focus:outline-none text-sm font-medium"
            />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuantityChange(1) }}
              className="w-7 h-7 flex items-center justify-center text-white hover:bg-gray-600 transition-colors text-base leading-none"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
