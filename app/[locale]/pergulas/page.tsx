import type { Locale } from '@/lib/locales'
import { PergulaGallery } from '@/components/pergulas/pergula-gallery'
import ProjectsGallery from '@/components/pergulas/ProjectsGallery'

export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  return (
    <main className="container py-16">
      <PergulaGallery locale={locale} />
      <ProjectsGallery locale={locale} />
    </main>
  )
}

