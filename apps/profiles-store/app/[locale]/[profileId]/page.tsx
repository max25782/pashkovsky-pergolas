import { fetchProfile, fetchStock } from '@/lib/api-client'
import { ProductImage } from '@/components/product/ProductImage'
import { LengthSelector } from '@/components/product/LengthSelector'
import { ColorSelector } from '@/components/product/ColorSelector'
import { QuantityInput } from '@/components/product/QuantityInput'
import { AddToCartButton } from '@/components/product/AddToCartButton'
import { Container } from '@/components/layout/Container'
import { formatPrice } from '@/lib/format'
import { getTranslation, type Locale } from '@/lib/locales'
import { ProductDetailClient } from './ProductDetailClient'
import type { Metadata } from 'next'

interface ProductPageProps {
  params: Promise<{ locale: Locale; profileId: string }>
  searchParams: Promise<{ company_id?: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, profileId } = await params
  const companyId = process.env.NEXT_PUBLIC_COMPANY_ID

  try {
    const profile = await fetchProfile(profileId, companyId)

    return {
      title: `${profile.code} - ${profile.dimensions} Aluminum Profile`,
      description: `Buy ${profile.code} aluminum profile (${profile.dimensions}). Available in multiple lengths and colors. In stock, fast delivery.`,
      openGraph: {
        title: `${profile.code} Aluminum Profile`,
        description: `${profile.dimensions} - ${profile.available_lengths.join(', ')}m`,
        images: profile.image_url ? [{ url: profile.image_url }] : [],
      },
    }
  } catch {
    return {
      title: 'Product Not Found',
    }
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { locale, profileId } = await params
  const search = await searchParams
  const companyId = search.company_id || process.env.NEXT_PUBLIC_COMPANY_ID

  try {
    const profile = await fetchProfile(profileId, companyId)
    const stock = await fetchStock(profileId, companyId)

    const availableColors = stock.length > 0 ? [...new Set(stock.map((s) => s.color))] : []
    const defaultLength = profile.available_lengths[0] || 6
    const defaultColor = availableColors[0] || ''

    return (
      <Container className="py-12">
        <ProductDetailClient
          profile={profile}
          stock={stock}
          locale={locale}
          defaultLength={defaultLength}
          defaultColor={defaultColor}
          availableColors={availableColors}
        />
      </Container>
    )
  } catch (error) {
    return (
      <Container className="py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <p className="text-gray-600">The product you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </Container>
    )
  }
}
