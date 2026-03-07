'use client'

import { useThree } from '@react-three/fiber'
import type { Locale } from '@/lib/locales'
import type { PergolaParams } from './types'
import { getTranslations } from './translations'

interface SaverCallbacks {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function useSaver(
  getParams: () => PergolaParams,
  locale: Locale,
  { onSuccess, onError }: SaverCallbacks = {}
) {
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
      if (onSuccess !== undefined) {
        onSuccess(t.saveSuccess)
      } else {
        alert(t.saveSuccess)
      }
    } catch (e) {
      console.error(e)
      if (onError !== undefined) {
        onError(t.saveFailed)
      } else {
        alert(t.saveFailed)
      }
    }
  }

  return save
}
