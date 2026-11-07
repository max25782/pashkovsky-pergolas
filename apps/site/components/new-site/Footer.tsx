'use client'

import { siteContact } from '@/config/siteContact'
import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'

/** One horizontal row: brand, navigation, contact data, socials, legal. Wraps on narrow screens. */
export function Footer() {
  const { lang } = useNewSite()

  return (
    <footer className="ns-footer">
      <div className="ns-wrap ns-row-f">
        <a className="ns-logo" href="#top">
          {siteContact.brand}
          <small>Group</small>
        </a>
        <nav className="ns-info" aria-label={t(copy.footer.nav, lang)}>
          <a href="#models">{t(copy.nav.models, lang)}</a>
          <a href="#works">{t(copy.nav.works, lang)}</a>
          <a href="#reviews">{t(copy.nav.reviews, lang)}</a>
          <a href="#contact">{t(copy.nav.contact, lang)}</a>
        </nav>
        <div className="ns-info">
          <a className="ns-ltr" href={`tel:${siteContact.phoneTel}`}>
            {siteContact.phoneDisplay}
          </a>
          <a className="ns-ltr" href={`mailto:${siteContact.email}`}>
            {siteContact.email}
          </a>
          <span>{t(siteContact.address, lang)}</span>
          <span>{t(siteContact.hours, lang)}</span>
        </div>
        <nav className="ns-info" aria-label={t(copy.footer.social, lang)}>
          {siteContact.socials.map((social) => (
            <a key={social.name} href={social.href} target="_blank" rel="noopener noreferrer">
              {social.name}
            </a>
          ))}
        </nav>
        <nav className="ns-info" aria-label={t(copy.footer.legal, lang)}>
          <a href="#accessibility">{t(copy.footer.accessibility, lang)}</a>
          <a href={`/${lang}/legal/privacy`}>{t(copy.footer.privacy, lang)}</a>
        </nav>
      </div>
    </footer>
  )
}
