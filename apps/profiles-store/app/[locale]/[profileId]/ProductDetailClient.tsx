'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Profile, StockInfo } from '@/lib/api-client'
import { useCart } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'
import { cn } from '@/lib/cn'

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
  locale,
  defaultLength,
  defaultColor,
}: ProductDetailClientProps) {
  const { addItem } = useCart()
  const [selectedLength, setSelectedLength] = useState(defaultLength)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const isRtl = locale === 'he'
  const weightPerMeter = profile.weight_per_meter || 0
  const weightPerUnit = weightPerMeter * selectedLength
  const totalWeight = weightPerUnit * quantity

  const dims = (profile.dimensions || '').split('/')
  const thickness = dims[2] || null

  const categoryLabels: Record<string, string> = {
    pergulas: isRtl ? 'פרגולות' : 'Pergolas',
    fancy:    isRtl ? 'גדר' : 'Fence',
    railling: isRtl ? 'מעקות' : 'Railings',
    concealed: isRtl ? 'מסתורי כביסה' : 'Concealed',
    window:   isRtl ? 'חלונות' : 'Windows',
  }

  const displayName =
    (locale === 'he' && profile.name_he) ||
    (locale === 'ru' && profile.name_ru) ||
    profile.name_en ||
    profile.name_he ||
    profile.name_ru ||
    profile.code

  function handleAddToCart() {
    const color = defaultColor || 'default'
    addItem(
      {
        profileId: profile.id,
        code: profile.code,
        nameHe: profile.name_he,
        nameRu: profile.name_ru,
        nameEn: profile.name_en,
        color,
        length: selectedLength,
        pricePerPiece: 0,
        weightPerPiece: weightPerUnit,
        imageUrl: profile.image_url,
      },
      quantity
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-card overflow-hidden max-w-sm mx-auto',
        isRtl && 'text-right'
      )}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Name + SKU */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900 leading-tight">{displayName}</h1>
        {profile.sku && (
          <p className="text-sm font-semibold text-gray-700 mt-0.5">
            {isRtl ? `מק"ט: ${profile.sku}` : `SKU: ${profile.sku}`}
          </p>
        )}
        {displayName !== profile.code && (
          <p className="text-xs text-gray-400 font-mono mt-0.5">{profile.code}</p>
        )}
      </div>

      {/* Image */}
      <div className="px-6 py-3 flex items-center justify-center bg-gray-50 border-y border-gray-100">
        <div className="relative w-48 h-36">
          {profile.image_url ? (
            <Image
              src={profile.image_url}
              alt={profile.code}
              fill
              className="object-contain"
              sizes="192px"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              {isRtl ? 'אין תמונה' : 'No image'}
            </div>
          )}
        </div>
      </div>

      {/* Specs */}
      <div className="px-4 py-3 space-y-1.5 text-sm border-b border-gray-100">
        <div className="flex justify-between">
          <span className="text-gray-500">{isRtl ? 'אורך:' : 'Length:'}</span>
          <span className="font-medium text-gray-900">{selectedLength} m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{isRtl ? 'משקל למטר:' : 'Weight/m:'}</span>
          <span className="font-medium text-gray-900">{weightPerMeter.toFixed(1)} kg</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{isRtl ? 'משקל ליחידה:' : 'Weight/unit:'}</span>
          <span className="font-medium text-gray-900">{weightPerUnit.toFixed(1)} kg</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{isRtl ? 'עובי פרופיל:' : 'Profile thickness:'}</span>
          <span className="font-medium text-gray-900">{thickness ? `${thickness} mm` : '—'}</span>
        </div>
        {profile.category && (
          <div className="flex justify-between">
            <span className="text-gray-500">{isRtl ? 'קטגוריה:' : 'Category:'}</span>
            <span className="font-medium text-gray-900 text-xs">
              {categoryLabels[profile.category] || profile.category}
            </span>
          </div>
        )}
      </div>

      {/* Length selector + total weight */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">{isRtl ? 'אורך (במטרים)' : 'Length (m)'}</p>
            {profile.available_lengths.length > 1 ? (
              <select
                value={selectedLength}
                onChange={(e) => setSelectedLength(parseFloat(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-gray-900 font-semibold text-sm focus:outline-none focus:border-gray-400 bg-white"
              >
                {profile.available_lengths.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            ) : (
              <div className="border-2 border-gray-200 rounded-lg px-3 py-2 text-gray-900 font-semibold text-sm">
                {selectedLength}
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">{isRtl ? 'סה"כ' : 'Total'}</p>
            <div className="font-bold text-gray-900 text-sm">
              {totalWeight.toFixed(2)}<span className="text-xs text-gray-500 font-normal"> kg</span>
            </div>
            <div className="text-xs text-gray-400">{(selectedLength * quantity).toFixed(2)} m</div>
          </div>
        </div>
      </div>

      {/* Action bar — dark bg matching site theme */}
      <div className="bg-gray-800 px-4 py-3 flex items-center gap-3">
        {/* Add to quote button */}
        <button
          type="button"
          onClick={handleAddToCart}
          className={cn(
            'flex-1 py-2.5 px-4 rounded-full text-sm font-bold transition-all duration-150 shadow',
            added
              ? 'bg-green-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          )}
        >
          {added
            ? (isRtl ? '✓ נוסף!' : '✓ Added!')
            : (isRtl ? 'הוסף להצעת המחיר' : getTranslation(locale, 'product.addToQuote'))}
        </button>

        {/* Quantity stepper */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-gray-700 rounded-full border border-gray-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-600 transition-colors text-base leading-none"
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
              className="w-10 h-8 text-center text-white bg-transparent border-0 focus:outline-none text-sm font-medium"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-600 transition-colors text-base leading-none"
            >
              +
            </button>
          </div>
          <span className="text-white text-xs">{isRtl ? 'כמות' : 'Qty'}</span>
        </div>
      </div>
    </div>
  )
}
