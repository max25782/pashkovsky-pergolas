'use client'

import { ThemeProvider } from 'next-themes'
import { ToastProvider } from '@/components/ui/toast'

/**
 * Root layout already uses suppressHydrationWarning on <html>. Keep ThemeProvider unconditional
 * so server/client trees match; deferring it caused next-themes' script to mis-align with siblings.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
      </ThemeProvider>
    </ToastProvider>
  )
}


