'use client'

import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * When the canvas mounts inside a dialog or animated layout, R3F can measure
 * the container one frame too early (tiny drawing buffer → CSS-stretched, looks "blurry").
 * Re-apply setSize from getBoundingClientRect after paint.
 */
export function CanvasReflowOnMount(): null {
  const gl = useThree((s) => s.gl)
  const setSize = useThree((s) => s.setSize)
  const setDpr = useThree((s) => s.setDpr)
  const invalidate = useThree((s) => s.invalidate)

  useLayoutEffect(() => {
    let cancelled = false
    let innerRaf = 0

    const sync = () => {
      if (cancelled) return
      const parent = gl.domElement.parentElement
      if (!parent) return
      const r = parent.getBoundingClientRect()
      const w = Math.max(1, Math.floor(r.width))
      const h = Math.max(1, Math.floor(r.height))
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3)
      setDpr(dpr)
      setSize(w, h, true)
      invalidate()
    }

    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(sync)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
    }
  }, [gl, setSize, setDpr, invalidate])

  return null
}
