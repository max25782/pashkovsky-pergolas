'use client'

import { siteContent } from '@/config/siteContent'
import { siteMedia } from '@/config/siteMedia'
import { mediaUrl } from '@/lib/new-site/media-url'
import { copy, t } from './i18n'
import { MediaImage } from './MediaImage'
import { useNewSite } from './NewSiteProvider'
import { Tilt } from './Tilt'

export function Warranty() {
  const { lang } = useNewSite()
  const { warranty, isSample } = siteContent

  return (
    <section id="warranty" className="ns-section ns-flush" aria-labelledby="ns-warranty-title">
      <div className="ns-wrap">
        <span className="ns-kick">{t(copy.warranty.kick, lang)}</span>
        <h2 id="ns-warranty-title" className="ns-h2">
          {t(copy.warranty.title, lang)}
        </h2>
        {isSample && <p className="ns-sub">{t(copy.warranty.sampleSub, lang)}</p>}

        <div className="ns-wgrid">
          <Tilt className="ns-wc">
            <h3>{t(copy.warranty.period, lang)}</h3>
            <p className="ns-wbig">{warranty.period}</p>
            <p>{t(copy.warranty.periodText, lang)}</p>
          </Tilt>
          <Tilt className="ns-wc" delay={80}>
            <h3>{t(copy.warranty.covered, lang)}</h3>
            <ul>
              {warranty.covered.map((item) => (
                <li key={item.en}>{t(item, lang)}</li>
              ))}
            </ul>
          </Tilt>
          <Tilt className="ns-wc" delay={160}>
            <h3>{t(copy.warranty.notCovered, lang)}</h3>
            <ul>
              {warranty.notCovered.map((item) => (
                <li key={item.en}>{t(item, lang)}</li>
              ))}
            </ul>
          </Tilt>
        </div>

        <h3 style={{ marginTop: 34, fontSize: 22 }}>{t(copy.warranty.certs, lang)}</h3>
        <ul className="ns-certs">
          {siteMedia.certificates.map((cert, index) => {
            const src = mediaUrl(cert.key)
            return (
              <li key={cert.alt} className="ns-cert">
                <MediaImage src={src} alt={cert.alt} hue="200,20%,30%" slot={`certificates[${index}]`} sizes="128px" />
                {src === null && <span>{cert.alt}</span>}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
