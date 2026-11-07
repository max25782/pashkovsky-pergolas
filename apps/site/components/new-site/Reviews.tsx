'use client'

import { useState } from 'react'
import { siteContent } from '@/config/siteContent'
import { siteMedia } from '@/config/siteMedia'
import { mediaUrl } from '@/lib/new-site/media-url'
import { copy, t } from './i18n'
import { MediaImage } from './MediaImage'
import { useNewSite } from './NewSiteProvider'
import { Tilt } from './Tilt'

export function Reviews() {
  const { lang } = useNewSite()
  const [playing, setPlaying] = useState<number | null>(null)
  const sampleMark = siteContent.isSample ? ` ${t(copy.sample, lang)}` : ''

  return (
    <section id="reviews" className="ns-section ns-rev" aria-labelledby="ns-reviews-title">
      <div className="ns-wrap">
        <span className="ns-kick">{t(copy.reviews.kick, lang)}</span>
        <h2 id="ns-reviews-title" className="ns-h2">
          {t(copy.reviews.title, lang)}
        </h2>

        <div className="ns-vids">
          {siteMedia.reviewVideos.map((review, index) => {
            const videoUrl = mediaUrl(review.video)
            const name = t(review.name, lang)
            return (
              <Tilt key={review.meta} className="ns-vid" delay={index * 80}>
                {playing === index && videoUrl !== null ? (
                  // The video file is requested only after the visitor presses play.
                  <video src={videoUrl} poster={mediaUrl(review.poster) ?? undefined} controls autoPlay playsInline preload="auto" aria-label={name} />
                ) : (
                  <>
                    <MediaImage
                      src={mediaUrl(review.poster)}
                      alt=""
                      hue="200,35%,28%"
                      slot={`reviewVideos[${index}]`}
                      sizes="(max-width: 640px) 100vw, 400px"
                    />
                    <button
                      type="button"
                      className="ns-play"
                      disabled={videoUrl === null}
                      onClick={() => setPlaying(index)}
                      aria-label={`${t(videoUrl === null ? copy.reviews.noVideo : copy.reviews.play, lang)}: ${name}`}
                    >
                      <span aria-hidden="true">{'\u25B6'}</span>
                    </button>
                    <div className="ns-nm">
                      {name}
                      <small>{review.meta}</small>
                    </div>
                  </>
                )}
              </Tilt>
            )
          })}
        </div>

        <div className="ns-quotes">
          {siteContent.quotes.map((quote, index) => (
            // Sample quotes are identical, so the index is the only stable key.
            <Tilt key={index} className="ns-q" delay={index * 80}>
              <blockquote style={{ margin: 0 }}>
                <p>{t(quote.text, lang)}</p>
              </blockquote>
              <b>
                {t(quote.name, lang)}
                {sampleMark}
              </b>
              <small>{quote.meta}</small>
            </Tilt>
          ))}
        </div>
      </div>
    </section>
  )
}
