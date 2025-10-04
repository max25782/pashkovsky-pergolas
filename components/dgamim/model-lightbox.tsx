'use client'
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'

interface ModelLightboxProps {
  images: string[]
  open: boolean
  startIndex?: number
  onClose: () => void
  locale?: 'he' | 'ru' | 'en'
}

export function ModelLightbox({ images, open, startIndex = 0, onClose, locale = 'he' }: ModelLightboxProps){
  const t = (he:string, ru:string, en:string) => (locale==='he'?he: locale==='ru'?ru: en)
  const [index, setIndex] = useState(startIndex)

  useEffect(()=>{ setIndex(startIndex) }, [startIndex])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const next = useCallback(()=>{
    if (!images?.length) return
    setIndex(i => (i + 1) % images.length)
  }, [images])
  const prev = useCallback(()=>{
    if (!images?.length) return
    setIndex(i => (i - 1 + images.length) % images.length)
  }, [images])

  if (!open) return null

  const src = images[index]

  return (
    <div className="fixed inset-0 z-50 bg-black/90">
      <button aria-label={t('סגור', 'Закрыть', 'Close')} onClick={onClose} className="absolute z-50 top-4 right-4 text-white/90 hover:text-white text-xl">✕</button>
      <button aria-label={t('הבא', 'Далее', 'Next')} onClick={next} className="absolute z-50 left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-3xl">›</button>
      <button aria-label={t('הקודם', 'Назад', 'Prev')} onClick={prev} className="absolute z-50 right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-3xl">‹</button>
      <div className="absolute inset-0 z-10 grid place-items-center p-4">
        <div className="relative w-full h-full max-w-6xl max-h-[85vh]">
          {src && (
            <Image src={src} alt={`image-${index+1}`} fill className="object-contain" unoptimized sizes="100vw" />
          )}
        </div>
      </div>
      <div className="absolute z-50 bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">{t('תמונה', 'Изображение', 'Image')} {index+1} / {images.length}</div>
    </div>
  )
}


