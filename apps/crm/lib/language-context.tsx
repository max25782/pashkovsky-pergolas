"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { fetchWithTimeout, DEFAULT_SUPABASE_TIMEOUT_MS } from '@/lib/supabase/fetch-with-timeout'
import heMessages from '../messages/he.json'
import ruMessages from '../messages/ru.json'
import enMessages from '../messages/en.json'
import srMessages from '../messages/sr.json'

export type Language = 'he' | 'ru' | 'en' | 'sr'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

interface IntlState {
  locale: Language
  messages: Record<string, unknown>
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const allMessages: Record<Language, Record<string, unknown>> = {
  he: heMessages as Record<string, unknown>,
  ru: ruMessages as Record<string, unknown>,
  en: enMessages as Record<string, unknown>,
  sr: srMessages as Record<string, unknown>,
}

function loadMessages(lang: Language): Record<string, unknown> {
  return allMessages[lang]
}

function applyDocumentLocale(lang: Language) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [intl, setIntl] = useState<IntlState>({
    locale: 'he',
    messages: heMessages as Record<string, unknown>,
  })

  useEffect(() => {
    let cancelled = false

    function apply(lang: Language) {
      if (cancelled) return
      applyDocumentLocale(lang)
      setIntl({ locale: lang, messages: loadMessages(lang) })
    }

    fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS)('/api/companies/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { language?: string } | null) => {
        const raw = data?.language
        const lang: Language = raw === 'ru' || raw === 'en' || raw === 'sr' || raw === 'he' ? raw : 'he'
        apply(lang)
      })
      .catch(() => apply('he'))

    return () => {
      cancelled = true
    }
  }, [])

  const setLanguage = (lang: Language) => {
    applyDocumentLocale(lang)
    setIntl({ locale: lang, messages: loadMessages(lang) })
    void fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS)('/api/companies/me', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang }),
    }).catch(() => {
      /* The screen already shows the chosen language. The next load reads the saved setting. */
    })
  }

  return (
    <LanguageContext.Provider value={{ language: intl.locale, setLanguage }}>
      <NextIntlClientProvider
        locale={intl.locale}
        messages={intl.messages}
        timeZone="Asia/Jerusalem"
      >
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
