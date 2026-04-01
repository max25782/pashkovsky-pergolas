'use client'
import type { Locale } from '@/lib/locales'
import dynamic from 'next/dynamic'

const DgamimCarousel = dynamic(() => import('@/components/dgamim/dgamim-carousel'), {
    ssr: false,
    loading: () => (
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-56 h-64 rounded-2xl bg-white/5 border border-white/10 animate-pulse"
          />
        ))}
      </div>
    ),
  },
)

interface GallerySectionProps {
  locale: Locale
}

export function GallerySection({ locale }: GallerySectionProps) {
  return (
    <section id="gallery" className="container py-12 md:py-16">
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-extrabold">{
          locale === 'he' ? 'פרגולות שלנו' : locale === 'ru' ? 'Наши проекты' : 'Our Pergolas'
        }</h2>
      </div>
      <DgamimCarousel />
    </section>
  )
}


