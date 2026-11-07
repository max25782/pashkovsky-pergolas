'use client'

import { siteContact } from '@/config/siteContact'
import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'

const LINKS = [
  { href: '#models', label: copy.nav.models },
  { href: '#works', label: copy.nav.works },
  { href: '#reviews', label: copy.nav.reviews },
  { href: '#contact', label: copy.nav.contact },
] as const

export function Header() {
  const { lang, setLang, theme, toggleTheme } = useNewSite()

  return (
    <header className="ns-nav">
      <div className="ns-wrap">
        <a className="ns-logo" href="#top">
          {siteContact.brand}
          <small>Group</small>
        </a>
        <nav className="ns-links" aria-label={t(copy.nav.main, lang)}>
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {t(link.label, lang)}
            </a>
          ))}
        </nav>
        <div className="ns-seg" role="group" aria-label={t(copy.nav.language, lang)}>
          <button type="button" lang="he" aria-label="עברית" aria-pressed={lang === 'he'} onClick={() => setLang('he')}>
            HE
          </button>
          <button type="button" lang="en" aria-label="English" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
        <button type="button" className="ns-tool" onClick={toggleTheme} aria-label={t(copy.nav.theme, lang)}>
          <span aria-hidden="true">{theme === 'dark' ? '\u2600' : '\u263E'}</span>
        </button>
        <a className="ns-tool ns-call" href={`tel:${siteContact.phoneTel}`} aria-label={`${t(copy.nav.call, lang)} ${siteContact.phoneDisplay}`}>
          <span aria-hidden="true">{'\u260E'}</span>
        </a>
      </div>
    </header>
  )
}
