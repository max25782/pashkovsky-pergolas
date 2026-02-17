'use client'

import { Profile } from '@/lib/api-client'
import { useCart } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'

interface AddToCartButtonProps {
  profile: Profile
  selectedLength: number
  selectedColor: string
  quantity: number
  locale: Locale
  className?: string
}

export function AddToCartButton({
  profile,
  selectedLength,
  selectedColor,
  quantity,
  locale,
  className,
}: AddToCartButtonProps) {
  const { addItem } = useCart()

  const handleAddToCart = () => {
    const pricePerPiece = profile.weight_per_meter * selectedLength * profile.price_per_kg

    addItem(
      {
        profileId: profile.id,
        code: profile.code,
        color: selectedColor,
        length: selectedLength,
        pricePerPiece,
        imageUrl: profile.image_url,
      },
      quantity
    )
  }

  return (
    <button
      onClick={handleAddToCart}
      className={`w-full px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors ${className || ''}`}
    >
      {getTranslation(locale, 'product.addToCart')}
    </button>
  )
}
