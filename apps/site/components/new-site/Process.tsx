'use client'

import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'

export function Process() {
  const { lang } = useNewSite()
  return (
    <section id="process" className="ns-section" aria-labelledby="ns-process-title">
      <div className="ns-wrap">
        <span className="ns-kick">{t(copy.process.kick, lang)}</span>
        <h2 id="ns-process-title" className="ns-h2">
          {t(copy.process.title, lang)}
        </h2>
        <ol className="ns-steps" style={{ listStyle: 'none', padding: 0, margin: '36px 0 0' }}>
          {copy.process.steps.map((step, index) => (
            <li key={step.title.en} className="ns-step">
              <span className="ns-kick" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{t(step.title, lang)}</h3>
              <p>{t(step.text, lang)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
