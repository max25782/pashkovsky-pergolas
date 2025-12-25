'use client'
import { useEffect } from 'react'
import type { Locale } from '@/lib/locales'
import { DgamimCarousel } from '@/components/dgamim/dgamim-carousel'
import { observer } from 'mobx-react-lite'
import { uiStore } from '@/stores/ui-store'

interface PergulaGalleryProps {
  locale: Locale
}

function PergulaGalleryImpl({ locale }: PergulaGalleryProps){
  useEffect(() => { uiStore.setPergulaMounted(true); }, [])

  const title = locale === 'he' ? 'פרגולות שלנו' : locale === 'ru' ? 'Наши перголы' : 'Our Pergolas'

  return (
    <div className="container py-16">
      <h1 className="text-3xl font-extrabold mb-6">{title}</h1>
      {uiStore.pergulaMounted ? <DgamimCarousel /> : <div className="h-100vh w-full rounded-2xl border border-white/10 bg-white/5" />}
    </div>
  )
}

export const PergulaGallery = observer(PergulaGalleryImpl)
