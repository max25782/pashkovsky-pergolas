import type { Locale } from '@/lib/locales'
import { Suspense } from 'react'
import ProjectsGallery from '@/components/pergulas/ProjectsGallery'
import { DgamimCarousel } from '@/components/dgamim/dgamim-carousel'
import ContactSection from '@/components/contact-section'
import ArticleModal from '@/components/articleModal'

export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  return (
    <main className="container py-16">
      <ArticleModal articleSlug="pergolas-aluminum" lang={locale} />
      <Suspense fallback={<div className="mt-12 h-[60vh] w-full rounded-2xl bg-white/5 border border-white/10" />}> 
        <section className="mt-8 mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-8 text-center text-white">
            {locale === 'he' ? 'דגמי פרגולות' : locale === 'ru' ? 'Модели пергол' : 'Pergola Models'}
          </h2>
          <DgamimCarousel />
        </section>
      </Suspense>
      <Suspense fallback={<div className="mt-12 h-[80vh] w-full rounded-2xl bg-white/5 border border-white/10" />}> 
        <ProjectsGallery locale={locale} />
      </Suspense>
      <Suspense fallback={<div className="mt-12 h-[80vh] w-full rounded-2xl bg-white/5 border border-white/10" />}> 
        <ContactSection locale={locale} pageName="pergulas" />
      </Suspense>
    </main>
  )
}

