'use client'

import { siteMedia } from '@/config/siteMedia'
import { mediaUrl } from '@/lib/new-site/media-url'
import { copy, t } from './i18n'
import { MediaImage } from './MediaImage'
import { useNewSite } from './NewSiteProvider'

export function PartnersMarquee() {
  const { lang, reduceMotion } = useNewSite()

  return (
    <section id="partners" className="ns-section ns-flush" aria-labelledby="ns-partners-title">
      <div className="ns-wrap">
        <span className="ns-kick">{t(copy.partners.kick, lang)}</span>
        <h2 id="ns-partners-title" className="ns-h2">
          {t(copy.partners.title, lang)}
        </h2>
      </div>
      {/* With motion off the strip stops and becomes a scrollable region, so it must be reachable by keyboard. */}
      <div
        className="ns-logos"
        role="group"
        aria-label={t(copy.partners.region, lang)}
        tabIndex={reduceMotion ? 0 : undefined}
      >
        <div className="ns-ltrack">
          {[0, 1].map((copyIndex) =>
            siteMedia.partnersLogos.map((logo, i) => {
              const src = mediaUrl(logo.key)
              return (
                <div key={`${copyIndex}-${logo.alt}`} className="ns-lg" aria-hidden={copyIndex === 1 ? true : undefined}>
                  <MediaImage src={src} alt={logo.alt} hue="200,15%,40%" slot={`partnersLogos[${i}]`} sizes="190px" />
                  {src === null && <span>{logo.alt}</span>}
                </div>
              )
            }),
          )}
        </div>
      </div>
    </section>
  )
}
