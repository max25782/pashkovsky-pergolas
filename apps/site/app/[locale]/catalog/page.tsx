import type { Metadata } from 'next'
import '@fontsource/heebo/400.css'
import '@fontsource/heebo/700.css'
import '@fontsource/heebo/900.css'
import { CatalogCover } from '@/components/catalog/CatalogCover'
import { CatalogSection } from '@/components/catalog/CatalogSection'
import { CatalogFooter } from '@/components/catalog/CatalogFooter'
import { CatalogDownloadPdfButton } from '@/components/catalog/CatalogDownloadPdfButton'
import { CatalogReadyMarker } from '@/components/catalog/CatalogReadyMarker'
import { fetchCatalogPayload } from '@/lib/catalog/get-catalog-data'
import {
  CATALOG_COMPANY_NAME,
  CATALOG_CTA_LABEL_HE,
  CATALOG_INTRO_HE,
  CATALOG_PHONE_DISPLAY,
  CATALOG_PHONE_TEL,
  CATALOG_SECTIONS,
  CATALOG_SUBTITLE_HE,
  CATALOG_WEBSITE_URL,
  CATALOG_WHY_US_HE,
} from '@/lib/catalog/catalog-config'
import type { Locale } from '@/lib/locales'

export const metadata: Metadata = {
  title: 'קטלוג מוצרים',
  description:
    'קטלוג פרגולות, פרגולות דמוי עץ, חיפוי קיר, חיפוי קיר דמוי עץ, גדרות, מעקות ומסתורי כביסה — Pashkovsky Group',
}

function getSectionsParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value
  return undefined
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: { locale: Locale }
  searchParams: Record<string, string | string[] | undefined>
}) {
  const locale = params.locale
  const isPdf = searchParams.pdf === '1'
  const sectionsParam = getSectionsParam(searchParams.sections)

  let payload = null as Awaited<ReturnType<typeof fetchCatalogPayload>> | null
  let loadError: string | null = null

  try {
    payload = await fetchCatalogPayload({ sections: sectionsParam ?? null })
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'שגיאת טעינה'
    console.error('[catalog page]', e)
  }

  const totalImages = payload?.sections.reduce((n, s) => n + s.images.length, 0) ?? 0

  const ctaHref = `/${locale}/contact`

  return (
    <main
      className="catalog-root min-h-screen bg-[#faf8f5] pb-16 pt-6 text-neutral-900 sm:pb-24 sm:pt-10"
      style={{ fontFamily: '"Heebo", system-ui, sans-serif' }}
      dir="rtl"
      translate="no"
    >
      <CatalogReadyMarker totalImages={totalImages} />
      <div className="container max-w-5xl space-y-10 sm:space-y-14">
        {!isPdf ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm font-medium text-neutral-500">קטלוג מתיקיות S3 (images/…)</p>
            <CatalogDownloadPdfButton />
          </div>
        ) : null}

        {loadError && !isPdf ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            לא ניתן לטעון את הקטלוג: {loadError}
          </div>
        ) : null}

        {payload ? (
          <>
            <CatalogCover companyName={payload.companyName} subtitleHe={payload.subtitleHe} />

            <section className="catalog-section-card rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm sm:p-8 print:border-neutral-300">
              <h2 className="text-xl font-black text-neutral-900 sm:text-2xl">למה אנחנו</h2>
              <p className="mt-3 text-base leading-relaxed text-neutral-600 sm:text-lg">{payload.introHe}</p>
              <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">{payload.whyUsHe}</p>
            </section>

            <div className="space-y-10 sm:space-y-12">
              {payload.sections.map((sec) => (
                <CatalogSection
                  key={sec.id}
                  sectionId={sec.id}
                  titleHe={sec.titleHe}
                  descriptionHe={sec.descriptionHe}
                  images={sec.images}
                />
              ))}
            </div>
          </>
        ) : loadError ? (
          <>
            <CatalogCover companyName={CATALOG_COMPANY_NAME} subtitleHe={CATALOG_SUBTITLE_HE} />
            <section className="catalog-section-card rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm sm:p-8 print:border-neutral-300">
              <h2 className="text-xl font-black text-neutral-900 sm:text-2xl">למה אנחנו</h2>
              <p className="mt-3 text-base leading-relaxed text-neutral-600 sm:text-lg">{CATALOG_INTRO_HE}</p>
              <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">{CATALOG_WHY_US_HE}</p>
            </section>
            <div className="space-y-10 sm:space-y-12">
              {CATALOG_SECTIONS.map((sec) => (
                <CatalogSection
                  key={sec.id}
                  sectionId={sec.id}
                  titleHe={sec.titleHe}
                  descriptionHe={sec.descriptionHe}
                  images={[]}
                />
              ))}
            </div>
          </>
        ) : null}

        <CatalogFooter
          phoneDisplay={CATALOG_PHONE_DISPLAY}
          phoneTel={CATALOG_PHONE_TEL}
          websiteUrl={CATALOG_WEBSITE_URL}
          ctaLabel={CATALOG_CTA_LABEL_HE}
          ctaHref={ctaHref}
        />
      </div>
    </main>
  )
}
