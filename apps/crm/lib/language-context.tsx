"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import heMessages from '../messages/he.json'

export type Language = 'he' | 'ru' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const messageCache: Partial<Record<Language, Record<string, unknown>>> = {
  he: heMessages as Record<string, unknown>,
}

async function loadMessages(lang: Language): Promise<Record<string, unknown>> {
  if (messageCache[lang]) return messageCache[lang]!
  const mod = await import(`../messages/${lang}.json`)
  messageCache[lang] = mod.default
  return mod.default
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('he')
  const [messages, setMessages] = useState<Record<string, unknown>>(
    heMessages as Record<string, unknown>
  )

  useEffect(() => {
    const saved = localStorage.getItem('crm_language') as Language
    const initial = saved && ['he', 'ru', 'en'].includes(saved) ? saved : 'he'
    if (initial !== 'he') {
      setLanguageState(initial)
      loadMessages(initial).then(setMessages)
    }
    document.documentElement.lang = initial
    document.documentElement.dir = initial === 'he' ? 'rtl' : 'ltr'
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('crm_language', lang)
    loadMessages(lang).then(setMessages)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <NextIntlClientProvider locale={language} messages={messages}>
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
