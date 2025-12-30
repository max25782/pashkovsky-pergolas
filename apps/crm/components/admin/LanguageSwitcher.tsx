"use client"

import { useLanguage } from '@/lib/language-context'
import { Languages } from 'lucide-react'

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  const languages = [
    { code: 'he' as const, label: 'עברית', flag: '🇮🇱' },
    { code: 'ru' as const, label: 'Русский', flag: '🇷🇺' },
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
  ]

  return (
    <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            language === lang.code
              ? 'bg-blue-600 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title={lang.label}
        >
          <span>{lang.flag}</span>
          <span className="hidden sm:inline">{lang.label}</span>
        </button>
      ))}
    </div>
  )
}

