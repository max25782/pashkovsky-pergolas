'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Profile } from '@/lib/api-client'
import { useCart } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'
import { cn } from '@/lib/cn'
import { ZoomIn, X } from 'lucide-react'

interface ProductCardProps {
  profile: Profile
  locale: Locale
  companyId?: string
}

export function ProductCard({ profile, locale, companyId }: ProductCardProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedLength, setSelectedLength] = useState(profile.available_lengths[0] || 6)
  const [imageZoomed, setImageZoomed] = useState(false)

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

  const categoryLabels: Record<string, Record<string, string>> = {
    pergulas:  { he: 'פרגולות',       ru: 'Перголы',   en: 'Pergolas' },
    fancy:     { he: 'גדר',           ru: 'Забор',     en: 'Fence' },
    railling:  { he: 'מעקות',         ru: 'Перила',    en: 'Railings' },
    concealed: { he: 'מסתורי כביסה',  ru: 'Скрытые',   en: 'Concealed' },
    window:    { he: 'חלונות',        ru: 'Окна',      en: 'Windows' },
  }
  const categoryLabel = profile.category
    ? (categoryLabels[profile.category]?.[locale] ?? categoryLabels[profile.category]?.he ?? profile.category)
    : null

  return (
    <div className={cn(
      'bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden',
      locale === 'he' && 'text-right'
    )}>
      {/* Top Section: Product Name + Code */}
      <div className="p-4 pb-2">
        <div className="text-right">
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">
            <Link href={`/${locale}/${profile.id}`} className="hover:text-primary transition-colors">
              {(locale === 'he' && profile.name_he) ||
               (locale === 'ru' && profile.name_ru) ||
               profile.name_en ||
               profile.name_he ||
               profile.name_ru ||
               profile.code}
            </Link>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{profile.code}</p>
        </div>
      </div>

      {/* Image Section with hover zoom */}
      <div className="px-4 pb-2">
        <div
          className="relative w-full h-24 bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center group cursor-zoom-in"
          onClick={(e) => {
            if (profile.image_url) { e.preventDefault(); e.stopPropagation(); setImageZoomed(true) }
          }}
        >
          {profile.image_url ? (
            <>
              <Image
                src={profile.image_url}
                alt={profile.code}
                fill
                className="object-contain transition-transform duration-200 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                priority
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
              </div>
            </>
          ) : (
            <Link href={`/${locale}/${profile.id}`} className="absolute inset-0" />
          )}
        </div>
      </div>

      {/* Zoom modal */}
      {imageZoomed && profile.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImageZoomed(false)}
        >
          <div className="relative max-w-2xl max-h-[80vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImageZoomed(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="relative w-full h-[70vh] bg-white rounded-xl overflow-hidden">
              <Image
                src={profile.image_url}
                alt={profile.code}
                fill
                className="object-contain p-4"
                sizes="800px"
              />
            </div>
            <p className="text-center text-white/70 text-sm mt-3 font-mono">{profile.code}</p>
          </div>
        </div>
      )}

      {/* Specifications */}
      <div className="px-4 py-2 space-y-1 text-sm border-t border-gray-100">
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
        {categoryLabel && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">קטגוריה:</span>
            <span className="text-gray-900 font-medium text-xs">{categoryLabel}</span>
          </div>
        )}
      </div>

      {/* Length selector + totals row — always visible */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {/* Dropdown only when multiple lengths */}
          {profile.available_lengths.length > 1 && (
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1 text-right">אורך (במטרים)</p>
              <select
                value={selectedLength}
                onChange={(e) => setSelectedLength(parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 font-semibold text-sm focus:outline-none focus:border-gray-400 bg-white"
              >
                {profile.available_lengths.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}
          {/* Totals — always shown */}
          <div className={profile.available_lengths.length > 1 ? 'text-right shrink-0' : 'w-full flex justify-between items-center'}>
            {profile.available_lengths.length === 1 && (
              <span className="text-xs text-gray-500">סה&quot;כ</span>
            )}
            {profile.available_lengths.length > 1 && (
              <p className="text-xs text-gray-500 mb-1">סה&quot;כ</p>
            )}
            <div className={profile.available_lengths.length === 1 ? 'text-right' : ''}>
              <p className="font-bold text-gray-900 text-sm leading-tight">
                {weightPerUnit.toFixed(2)}<span className="text-xs text-gray-500 font-normal"> kg</span>
              </p>
              <p className="text-xs text-gray-400">Length: {selectedLength % 1 === 0 ? selectedLength : selectedLength}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between gap-4">
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
          {locale === 'he' ? 'הצעת מחיר' : locale === 'ru' ? 'В смету' : 'Quote'}
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
