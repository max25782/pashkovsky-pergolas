"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { defaultCrmLanguageForCompany } from '@/lib/company-default-language'
import heMessages from '../messages/he.json'
import ruMessages from '../messages/ru.json'
import enMessages from '../messages/en.json'

export type Language = 'he' | 'ru' | 'en'

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
    locale: 'en',
    messages: enMessages as Record<string, unknown>,
  })

  useEffect(() => {
    let cancelled = false

    function apply(lang: Language) {
      if (cancelled) return
      applyDocumentLocale(lang)
      setIntl({ locale: lang, messages: loadMessages(lang) })
    }

    const saved = localStorage.getItem('crm_language') as Language | null
    if (saved && ['he', 'ru', 'en'].includes(saved)) {
      apply(saved)
      return () => {
        cancelled = true
      }
    }

    fetch('/api/companies/me', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) return defaultCrmLanguageForCompany(null)
        return res.json().then((data: { company_name?: string }) =>
          defaultCrmLanguageForCompany(data.company_name),
        )
      })
      .catch(() => defaultCrmLanguageForCompany(null))
      .then((initial) => {
        apply(initial as Language)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const setLanguage = (lang: Language) => {
    localStorage.setItem('crm_language', lang)
    applyDocumentLocale(lang)
    setIntl({ locale: lang, messages: loadMessages(lang) })
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
