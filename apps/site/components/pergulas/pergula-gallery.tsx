'use client'
import type { Locale } from '@/lib/locales'

interface PergulaGalleryProps {
  locale: Locale
}

export function PergulaGallery({ locale }: PergulaGalleryProps){
  const title = locale === 'he' ? 'פרגולות שלנו' : locale === 'ru' ? 'Наши перголы' : 'Our Pergolas'

  return (
    <div className="mb-8">
      <h1 className="text-3xl md:text-4xl font-extrabold mb-6 text-center text-white">{title}</h1>
    </div>
  )
}
