"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import heMessages from '../messages/he.json'

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

const messageCache: Partial<Record<Language, Record<string, unknown>>> = {
  he: heMessages as Record<string, unknown>,
}

async function loadMessages(lang: Language): Promise<Record<string, unknown>> {
  if (messageCache[lang]) return messageCache[lang]!
  const mod = await import(`../messages/${lang}.json`)
  messageCache[lang] = mod.default as Record<string, unknown>
  return messageCache[lang]!
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
    const saved = localStorage.getItem('crm_language') as Language
    const initial = saved && ['he', 'ru', 'en'].includes(saved) ? saved : 'he'
    applyDocumentLocale(initial)
    if (initial !== 'he') {
      // Load messages first, then update locale and messages atomically
      loadMessages(initial).then((msgs) => {
        setIntl({ locale: initial, messages: msgs })
      })
    }
  }, [])

  const setLanguage = (lang: Language) => {
    localStorage.setItem('crm_language', lang)
    applyDocumentLocale(lang)
    loadMessages(lang).then((msgs) => {
      setIntl({ locale: lang, messages: msgs })
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
