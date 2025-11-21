'use client'

import { useThree } from '@react-three/fiber'
import type { Locale } from '@/lib/locales'
import type { PergolaParams } from './types'
import { getTranslations } from './translations'

export function useSaver(getParams: () => PergolaParams, locale: Locale) {
  const { gl } = useThree()
  const t = getTranslations(locale)
  
  async function save(): Promise<void> {
    const screenshot = gl.domElement.toDataURL('image/png', 0.92)
    const payload = { ...getParams(), screenshot }
    try {
      await fetch('/api/sendPergolaConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      alert(t.saveSuccess)
    } catch (e) {
      console.error(e)
      alert(t.saveFailed)
    }
  }
  
  return save
}

