'use client'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

interface RotatingImageProps {
  sources: string[]
  intervalMs?: number
  alt?: string
  priority?: boolean
}

export function RotatingImage({ sources, intervalMs = 2000, alt = 'Degem', priority = false }: RotatingImageProps){
  const [idx, setIdx] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const timer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!sources?.length) return
    if (!isActive){ if (timer.current) { clearInterval(timer.current); timer.current = null } ; return }
    timer.current = setInterval(() => {
      setIdx(prev => (prev + 1) % sources.length)
    }, intervalMs)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [sources, intervalMs, isActive])

  const src = sources?.[idx] ?? sources?.[0]

  return (
    <div
      className="relative w-full h-full cursor-pointer select-none"
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onTouchStart={() => setIsActive(true)}
      onTouchEnd={() => setIsActive(false)}
      onPointerCancel={() => setIsActive(false)}
    >
      {src && (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 90vw"
          quality={75}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAW9JTEQAAAABJRU5ErkJggg=="
        />
      )}
    </div>
  )
}


