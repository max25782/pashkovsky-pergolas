'use client'

import { siteContact, whatsappUrl } from '@/config/siteContact'
import { copy, t } from './i18n'
import { LeadForm } from './LeadForm'
import { useNewSite } from './NewSiteProvider'

export function LeadSection() {
  const { lang, openChat } = useNewSite()

  return (
    <section id="contact" className="ns-section ns-lead" aria-labelledby="ns-lead-title">
      <div className="ns-wrap ns-lead-grid">
        <div>
          <span className="ns-kick" style={{ color: 'var(--accent)' }}>
            {t(copy.lead.kick, lang)}
          </span>
          <h2 id="ns-lead-title" className="ns-h2">
            {t(copy.lead.title, lang)}
          </h2>
          <p className="ns-sub">{t(copy.lead.sub, lang)}</p>
          <div className="ns-cta">
            <a className="ns-btn ns-btn-a" href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
              {t(copy.whatsapp, lang)}
            </a>
            <button type="button" className="ns-btn ns-btn-g" onClick={openChat}>
              {t(copy.lead.askAi, lang)}
            </button>
          </div>
          <div className="ns-lead-contacts">
            <a href={`tel:${siteContact.phoneTel}`}>{siteContact.phoneDisplay}</a>
            <a href={`mailto:${siteContact.email}`}>{siteContact.email}</a>
          </div>
        </div>
        <LeadForm />
      </div>
    </section>
  )
}
