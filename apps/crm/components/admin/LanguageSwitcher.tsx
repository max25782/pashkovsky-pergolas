"use client"

import { useLanguage } from '@/lib/language-context'

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  const languages = [
    { code: 'he' as const, label: 'he', flag: '🇮🇱' },
    { code: 'ru' as const, label: 'ru', flag: '🇷🇺' },
    { code: 'en' as const, label: 'en', flag: '🇬🇧' },
  ]

  return (
    <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-lg p-0.5 border border-white/20">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
            language === lang.code
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title={lang.label}
        >
          <span className="text-sm">{lang.flag}</span>
          <span className="uppercase">{lang.label}</span>
        </button>
      ))}
    </div>
  )
}

