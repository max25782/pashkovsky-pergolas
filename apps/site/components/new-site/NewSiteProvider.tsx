'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { Lang } from '@/config/siteTypes'

export type ThemeChoice = 'light' | 'dark'
export type View = 'home' | 'accessibility'

export interface A11yState {
  fontSize: number
  contrast: boolean
  underline: boolean
  still: boolean
}

interface NewSiteContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Effective theme (explicit choice, or the system preference). */
  theme: ThemeChoice
  toggleTheme: () => void
  a11y: A11yState
  updateA11y: (patch: Partial<A11yState> | ((prev: A11yState) => Partial<A11yState>)) => void
  /** True when the OS asks for reduced motion OR the visitor pressed "stop animations". */
  reduceMotion: boolean
  view: View
  chatOpen: boolean
  openChat: () => void
  closeChat: () => void
}

const STORAGE = { lang: 'ns-lang', theme: 'ns-theme', a11y: 'ns-a11y' } as const
export const FONT_SIZE = { min: 16, max: 26, step: 2, initial: 18 } as const

const DEFAULT_A11Y: A11yState = { fontSize: FONT_SIZE.initial, contrast: false, underline: false, still: false }

const NewSiteContext = createContext<NewSiteContextValue | null>(null)

export function useNewSite(): NewSiteContextValue {
  const ctx = useContext(NewSiteContext)
  if (ctx === null) throw new Error('useNewSite must be used inside <NewSiteProvider>')
  return ctx
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // storage can be blocked (private mode); the site then simply forgets choices
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // see readStorage
  }
}

function parseA11y(raw: string | null): A11yState {
  if (raw === null) return DEFAULT_A11Y
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_A11Y
    const p = parsed as Partial<A11yState>
    const size = typeof p.fontSize === 'number' ? p.fontSize : FONT_SIZE.initial
    return {
      fontSize: Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, size)),
      contrast: p.contrast === true,
      underline: p.underline === true,
      still: p.still === true,
    }
  } catch {
    return DEFAULT_A11Y
  }
}

function getView(): View {
  return window.location.hash === '#accessibility' ? 'accessibility' : 'home'
}

export function NewSiteProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('he')
  const [themeChoice, setThemeChoice] = useState<ThemeChoice | null>(null)
  const [systemDark, setSystemDark] = useState(false)
  const [a11y, setA11y] = useState<A11yState>(DEFAULT_A11Y)
  const [prefersReduced, setPrefersReduced] = useState(false)
  const [view, setView] = useState<View>('home')
  const [chatOpen, setChatOpen] = useState(false)

  // Restore saved choices after hydration (the server always renders he / system theme).
  useEffect(() => {
    const savedLang = readStorage(STORAGE.lang)
    if (savedLang === 'he' || savedLang === 'en') setLangState(savedLang)
    const savedTheme = readStorage(STORAGE.theme)
    if (savedTheme === 'light' || savedTheme === 'dark') setThemeChoice(savedTheme)
    setA11y(parseA11y(readStorage(STORAGE.a11y)))
    setView(getView())
  }, [])

  // System preferences.
  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    setSystemDark(dark.matches)
    setPrefersReduced(motion.matches)
    const onDark = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    const onMotion = (e: MediaQueryListEvent): void => setPrefersReduced(e.matches)
    dark.addEventListener('change', onDark)
    motion.addEventListener('change', onMotion)
    return () => {
      dark.removeEventListener('change', onDark)
      motion.removeEventListener('change', onMotion)
    }
  }, [])

  // #accessibility is a pseudo-route on the same page.
  useEffect(() => {
    const onHash = (): void => {
      setView(getView())
      if (getView() === 'accessibility') window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Language: <html lang dir> belongs to the shared root layout, so restore it on unmount.
  useEffect(() => {
    const el = document.documentElement
    const previous = { lang: el.lang, dir: el.dir }
    el.lang = lang
    el.dir = lang === 'he' ? 'rtl' : 'ltr'
    return () => {
      el.lang = previous.lang
      el.dir = previous.dir
    }
  }, [lang])

  const reduceMotion = prefersReduced || a11y.still

  // Smooth anchor scrolling only on this page and only if motion is allowed.
  useEffect(() => {
    const el = document.documentElement
    el.style.scrollBehavior = reduceMotion ? 'auto' : 'smooth'
    return () => {
      el.style.scrollBehavior = ''
    }
  }, [reduceMotion])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    writeStorage(STORAGE.lang, next)
  }, [])

  const theme: ThemeChoice = themeChoice ?? (systemDark ? 'dark' : 'light')

  const toggleTheme = useCallback(() => {
    const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark'
    setThemeChoice(next)
    writeStorage(STORAGE.theme, next)
  }, [theme])

  const updateA11y = useCallback((patch: Partial<A11yState> | ((prev: A11yState) => Partial<A11yState>)) => {
    setA11y((prev) => {
      const delta = typeof patch === 'function' ? patch(prev) : patch
      const next = { ...prev, ...delta }
      next.fontSize = Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, next.fontSize))
      writeStorage(STORAGE.a11y, JSON.stringify(next))
      return next
    })
  }, [])

  const openChat = useCallback(() => setChatOpen(true), [])
  const closeChat = useCallback(() => setChatOpen(false), [])

  const value = useMemo<NewSiteContextValue>(
    () => ({ lang, setLang, theme, toggleTheme, a11y, updateA11y, reduceMotion, view, chatOpen, openChat, closeChat }),
    [lang, setLang, theme, toggleTheme, a11y, updateA11y, reduceMotion, view, chatOpen, openChat, closeChat],
  )

  const classes = ['ns-root']
  if (a11y.contrast) classes.push('ns-contrast')
  if (a11y.underline) classes.push('ns-ul')
  if (reduceMotion) classes.push('ns-still')

  // data-theme is only set once the visitor chose; until then CSS follows the system.
  return (
    <NewSiteContext.Provider value={value}>
      <div
        className={classes.join(' ')}
        data-theme={themeChoice ?? undefined}
        lang={lang}
        dir={lang === 'he' ? 'rtl' : 'ltr'}
        style={{ '--fs': `${a11y.fontSize}px` } as CSSProperties}
      >
        {children}
      </div>
    </NewSiteContext.Provider>
  )
}
