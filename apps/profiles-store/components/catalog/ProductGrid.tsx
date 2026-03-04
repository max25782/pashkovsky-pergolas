import { Profile } from '@/lib/api-client'
import { ProductCard } from './ProductCard'
import { type Locale } from '@/lib/locales'

interface ProductGridProps {
  profiles: Profile[]
  locale: Locale
  companyId?: string
}

export function ProductGrid({ profiles, locale, companyId }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {profiles.map((profile) => (
        <ProductCard key={profile.id} profile={profile} locale={locale} companyId={companyId} />
      ))}
    </div>
  )
}
