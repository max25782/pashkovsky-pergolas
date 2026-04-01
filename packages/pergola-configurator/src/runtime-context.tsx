'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { PergolaParams } from './types'

/** Body passed to custom save (CRM) or default JSON POST to sendPergolaConfig */
export interface CustomSavePayload extends PergolaParams {
  screenshot: string
  linkToken?: string
}

interface ConfiguratorRuntimeValue {
  resourceBaseUrl: string
  /** Override profiles JSON URL (e.g. CRM `/api/configurator/profiles` server-proxy). */
  profilesJsonUrl?: string
  onCustomSave?: (payload: CustomSavePayload) => Promise<void>
}

const ConfiguratorRuntimeContext = createContext<ConfiguratorRuntimeValue>({
  resourceBaseUrl: '',
})

export function PergolaConfiguratorProvider({
  resourceBaseUrl = '',
  profilesJsonUrl,
  onCustomSave,
  children,
}: {
  resourceBaseUrl?: string
  profilesJsonUrl?: string
  onCustomSave?: (payload: CustomSavePayload) => Promise<void>
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      resourceBaseUrl: resourceBaseUrl.replace(/\/$/, ''),
      profilesJsonUrl: profilesJsonUrl?.trim() || undefined,
      onCustomSave,
    }),
    [resourceBaseUrl, profilesJsonUrl, onCustomSave],
  )
  return <ConfiguratorRuntimeContext.Provider value={value}>{children}</ConfiguratorRuntimeContext.Provider>
}

export function useConfiguratorRuntime(): ConfiguratorRuntimeValue {
  return useContext(ConfiguratorRuntimeContext)
}
