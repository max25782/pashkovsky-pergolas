'use client'

import { useThree } from '@react-three/fiber'
import type { ConfiguratorLocale } from './locale'
import type { PergolaParams } from './types'
import { getTranslations } from './translations'
import { useConfiguratorRuntime } from './runtime-context'

interface SaverCallbacks {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
  linkToken?: string
}

export function useSaver(
  getParams: () => PergolaParams,
  locale: ConfiguratorLocale,
  { onSuccess, onError, linkToken }: SaverCallbacks = {},
) {
  const { gl } = useThree()
  const t = getTranslations(locale)
  const { resourceBaseUrl, onCustomSave } = useConfiguratorRuntime()

  async function save(): Promise<void> {
    const screenshot = gl.domElement.toDataURL('image/png', 0.92)
    const params = getParams()
    const payload = {
      ...params,
      screenshot,
      ...(linkToken !== undefined && linkToken !== '' ? { linkToken } : {}),
    }

    try {
      if (onCustomSave !== undefined) {
        await onCustomSave(payload)
      } else {
        const base = resourceBaseUrl
        const url = base ? `${base}/api/sendPergolaConfig` : '/api/sendPergolaConfig'
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
        }
      }
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
