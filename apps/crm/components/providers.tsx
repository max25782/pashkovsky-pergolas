'use client'

import { LanguageProvider } from '@/lib/language-context'
import { ToastProvider } from '@/components/ui/toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </LanguageProvider>
  )
}


