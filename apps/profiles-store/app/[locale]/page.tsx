import { fetchProfiles } from '@/lib/api-client'
import { ProductGrid } from '@/components/catalog/ProductGrid'
import { FilterPanel } from '@/components/catalog/FilterPanel'
import { SearchBar } from '@/components/catalog/SearchBar'
import { Container } from '@/components/layout/Container'
import { getTranslation, type Locale } from '@/lib/locales'

interface CatalogPageProps {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ category?: string; search?: string; color?: string; company_id?: string }>
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { locale } = await params
  const search = await searchParams
  const companyId = search.company_id || process.env.NEXT_PUBLIC_COMPANY_ID

  let profiles: Awaited<ReturnType<typeof fetchProfiles>> = []
  let error: string | null = null

  try {
    profiles = await fetchProfiles({
      category: search.category === 'all' ? undefined : search.category,
      search: search.search,
      color: search.color,
      company_id: companyId,
    })
  } catch (err) {
    console.error('Failed to fetch profiles:', err)
    error = err instanceof Error ? err.message : 'Failed to load products'
  }

  return (
    <Container className="py-8">
      <div className="flex gap-8">
        <aside className="hidden lg:block">
          <FilterPanel locale={locale} />
        </aside>

        <main className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-white">
              {error ? '0' : profiles.length} {getTranslation(locale, 'catalog.products')}
            </h2>
            <SearchBar locale={locale} />
          </div>

          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
              <p className="text-red-400 font-medium mb-2">Error loading products</p>
              <p className="text-white/70 text-sm">{error}</p>
              <p className="text-white/50 text-xs mt-4">
                Make sure the Profiles API is running on port 3002
              </p>
            </div>
          ) : (
            <ProductGrid profiles={profiles} locale={locale} companyId={companyId} />
          )}
        </main>
      </div>
    </Container>
  )
}
