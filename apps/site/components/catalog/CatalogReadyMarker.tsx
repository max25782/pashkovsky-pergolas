'use client'

import { useEffect } from 'react'

interface CatalogReadyMarkerProps {
  totalImages: number
}

/**
 * Signals Puppeteer when catalog images have loaded (or timeout) via documentElement attribute.
 */
export function CatalogReadyMarker({ totalImages }: CatalogReadyMarkerProps) {
  useEffect(() => {
    const el = document.documentElement
    let cancelled = false
    let fallbackId: number | undefined

    function markReady() {
      if (cancelled) return
      el.setAttribute('data-catalog-ready', 'true')
    }

    if (totalImages === 0) {
      markReady()
      return () => {
        cancelled = true
      }
    }

    let rafAttempts = 0
    const maxRafAttempts = 360

    function wireImages() {
      if (cancelled) return
      rafAttempts++
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-catalog-image]'))
      if (imgs.length === 0 && rafAttempts < maxRafAttempts) {
        window.requestAnimationFrame(wireImages)
        return
      }
      if (imgs.length === 0) {
        markReady()
        return
      }

      let settled = 0
      function onDone() {
        settled++
        if (settled >= imgs.length) markReady()
      }

      for (const img of imgs) {
        if (img.complete) onDone()
        else {
          img.addEventListener('load', onDone, { once: true })
          img.addEventListener('error', onDone, { once: true })
        }
      }

      fallbackId = window.setTimeout(markReady, 45_000)
    }

    const start = window.setTimeout(wireImages, 0)

    return () => {
      cancelled = true
      window.clearTimeout(start)
      if (fallbackId !== undefined) window.clearTimeout(fallbackId)
    }
  }, [totalImages])

  return null
}
