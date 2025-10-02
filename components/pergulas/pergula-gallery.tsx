'use client'
import { useState, useEffect } from 'react'
import type { Locale } from '@/lib/locales'
import { DgamimCarousel } from '@/components/dgamim/dgamim-carousel'

interface PergulaGalleryProps {
  locale: Locale
}

export function PergulaGallery({ locale }: PergulaGalleryProps){
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const title = locale === 'he' ? 'פרגולות שלנו' : locale === 'ru' ? 'Наши перголы' : 'Our Pergolas'

  return (
    <div className="container py-16">
      <h1 className="text-3xl font-extrabold mb-6">{title}</h1>
      {mounted ? <DgamimCarousel /> : <div className="h-100vh w-full rounded-2xl border border-white/10 bg-white/5" />}
    </div>
  )
}
