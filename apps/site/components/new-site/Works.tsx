'use client'

import { useState } from 'react'
import { siteMedia, type WorkType } from '@/config/siteMedia'
import { mediaUrl } from '@/lib/new-site/media-url'
import { copy, t, type Localized } from './i18n'
import { MediaImage } from './MediaImage'
import { useNewSite } from './NewSiteProvider'
import { Tilt } from './Tilt'

type Filter = 'all' | WorkType

const FILTERS: { id: Filter; label: Localized }[] = [
  { id: 'all', label: copy.works.all },
  { id: 'pergola', label: copy.works.pergola },
  { id: 'rail', label: copy.works.rail },
  { id: 'fence', label: copy.works.fence },
  { id: 'glass', label: copy.works.glass },
]

export function Works() {
  const { lang } = useNewSite()
  const [filter, setFilter] = useState<Filter>('all')
  const visible = siteMedia.works.map((work, index) => ({ work, index })).filter(({ work }) => filter === 'all' || work.type === filter)

  return (
    <section id="works" className="ns-section" aria-labelledby="ns-works-title">
      <div className="ns-wrap">
        <span className="ns-kick">{t(copy.works.kick, lang)}</span>
        <h2 id="ns-works-title" className="ns-h2">
          {t(copy.works.title, lang)}
        </h2>

        <div className="ns-chips" role="group" aria-label={t(copy.works.filter, lang)}>
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className="ns-chip" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
              {t(item.label, lang)}
            </button>
          ))}
        </div>

        <div className="ns-works">
          {visible.map(({ work, index }, position) => {
            const title = t(work.title, lang)
            return (
              <Tilt key={`${filter}-${index}`} className={`ns-work${work.tall === true ? ' ns-tall' : ''}`} delay={(position % 3) * 80}>
                <MediaImage
                  src={mediaUrl(work.key)}
                  alt={title}
                  hue={work.hue}
                  slot={`works[${index}] ${work.type}`}
                  sizes="(max-width: 640px) 100vw, (max-width: 1240px) 50vw, 400px"
                />
                <div className="ns-work-text">
                  <b>{title}</b>
                  <span>{work.size}</span>
                </div>
              </Tilt>
            )
          })}
        </div>
      </div>
    </section>
  )
}
