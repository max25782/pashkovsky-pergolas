import type { Locale } from '@/lib/locales'
import { Suspense } from 'react'
import { PergulaGallery } from '@/components/pergulas/pergula-gallery'
import ProjectsGallery from '@/components/pergulas/ProjectsGallery'

export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  return (
    <main className="container py-16">
      <Suspense fallback={<div className="mb-16 h-[60vh] w-full rounded-2xl bg-white/5 border border-white/10" />}> 
        <PergulaGallery locale={locale} />
      </Suspense>
      <Suspense fallback={<div className="mt-12 h-[80vh] w-full rounded-2xl bg-white/5 border border-white/10" />}> 
        <ProjectsGallery locale={locale} />
      </Suspense>
    </main>
  )
}

