'use client'
import type { Locale } from '@/lib/locales'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const DgamimCarousel = dynamic(() => import('@/components/dgamim/dgamim-carousel').then(m => m.DgamimCarousel), { ssr: false })

interface GallerySectionProps {
  locale: Locale
}

export function GallerySection({ locale }: GallerySectionProps){
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <section id="gallery" className="container py-12 md:py-16">
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-extrabold">{
          locale==='he'?'פרגולות שלנו': locale==='ru'?'Наши проекты':'Our Pergolas'
        }</h2>
      </div>
      {mounted ? (
        <DgamimCarousel />
      ) : (
        <div className="h-56 w-full rounded-2xl border border-white/10 bg-white/5" />
      )}
    </section>
  )
}


