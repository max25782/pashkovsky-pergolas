'use client'

import { ACCESSIBILITY_COORDINATOR, ACCESSIBILITY_LAST_UPDATED } from '@/lib/accessibility'
import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'

/** The accessibility statement, shown in place of the home page when the URL hash is #accessibility. */
export function AccessibilityPage() {
  const { lang } = useNewSite()
  const page = copy.a11yPage

  return (
    <article className="ns-wrap ns-apage" aria-labelledby="ns-a11y-title">
      <a className="ns-back" href="#top">
        {t(page.back, lang)}
      </a>
      <h1 id="ns-a11y-title">{t(page.title, lang)}</h1>
      <p>{t(page.intro, lang)}</p>

      <h2>{t(page.doneTitle, lang)}</h2>
      <ul>
        {page.done.map((item) => (
          <li key={item.en}>{t(item, lang)}</li>
        ))}
      </ul>

      <h2>{t(page.standardTitle, lang)}</h2>
      <p>{t(page.standard, lang)}</p>

      <h2>{t(page.problemTitle, lang)}</h2>
      <p>
        {t(page.coordinator, lang)} {ACCESSIBILITY_COORDINATOR.name}
        {', '}
        <a href={`mailto:${ACCESSIBILITY_COORDINATOR.email}`}>{ACCESSIBILITY_COORDINATOR.email}</a>
        {', '}
        <a href={`tel:${ACCESSIBILITY_COORDINATOR.phone}`} style={{ unicodeBidi: 'isolate' }}>
          {ACCESSIBILITY_COORDINATOR.phone}
        </a>
      </p>
      <p>
        {t(page.updated, lang)} <span style={{ unicodeBidi: 'isolate' }}>{ACCESSIBILITY_LAST_UPDATED}</span>
      </p>
    </article>
  )
}
