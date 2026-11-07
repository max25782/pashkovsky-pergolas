'use client'

import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { useNewSite } from './NewSiteProvider'

interface TiltProps {
  children: ReactNode
  className?: string
  /** Entrance delay in ms (staggers sibling cards). */
  delay?: number
}

/**
 * 3D card: rises into place when it scrolls into view and tilts toward a mouse pointer.
 * Touch and pen input never tilt, and reduced motion removes both effects (see .ns-still).
 */
export function Tilt({ children, className = '', delay = 0 }: TiltProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { reduceMotion } = useNewSite()

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('ns-in')
      return
    }
    let timer: number | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          el.classList.add('ns-in')
          observer.unobserve(el)
          // The stagger delay must not slow down the hover tilt afterwards.
          timer = window.setTimeout(() => {
            el.style.transitionDelay = ''
          }, delay + 700)
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [delay])

  function onMove(event: PointerEvent<HTMLDivElement>): void {
    const el = ref.current
    if (el === null || reduceMotion || event.pointerType !== 'mouse') return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 10).toFixed(2)}deg) rotateY(${((px - 0.5) * 12).toFixed(2)}deg) translateZ(8px)`
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
  }

  function onLeave(): void {
    const el = ref.current
    if (el !== null) el.style.transform = ''
  }

  return (
    <div
      ref={ref}
      className={`ns-tilt ns-d3 ${className}`}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
      <span className="ns-glare" aria-hidden="true" />
    </div>
  )
}
