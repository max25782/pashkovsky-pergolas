'use client'

import { useEffect, useRef, useState } from 'react'
import { siteContent } from '@/config/siteContent'
import { siteMedia } from '@/config/siteMedia'
import { isLeadDemo } from '@/lib/new-site/lead-mode'
import { mediaUrl } from '@/lib/new-site/media-url'
import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'

export function Hero() {
  const { lang, reduceMotion } = useNewSite()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)

  const videoUrl = mediaUrl(siteMedia.hero.video)
  const posterUrl = mediaUrl(siteMedia.hero.poster)

  // Reduced motion (system setting or "stop animations") means the film must not run on its own.
  useEffect(() => {
    const video = videoRef.current
    if (video !== null && reduceMotion) video.pause()
  }, [reduceMotion])

  function togglePlay(): void {
    const video = videoRef.current
    if (video === null) return
    if (video.paused) {
      video.play().catch(() => setPaused(true)) // the browser can still refuse; stay in the paused state
    } else {
      video.pause()
    }
  }

  function toggleMute(): void {
    const video = videoRef.current
    if (video === null) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  return (
    <section id="top" className="ns-hero" aria-labelledby="ns-hero-title">
      {videoUrl !== null ? (
        <video
          ref={videoRef}
          className="ns-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={posterUrl ?? undefined}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : (
        <div className="ns-film" aria-hidden="true" />
      )}
      {videoUrl === null && isLeadDemo() && <span className="ns-slot-label">{t(copy.hero.slot, lang)}</span>}

      <div className="ns-wrap">
        <h1 id="ns-hero-title">{t(copy.hero.title, lang)}</h1>
        <p>{t(copy.hero.sub, lang)}</p>
        <div className="ns-cta">
          <a className="ns-btn ns-btn-a" href="#calc">
            {t(copy.hero.cta1, lang)}
          </a>
          <a className="ns-btn ns-btn-g" href="#works">
            {t(copy.hero.cta2, lang)}
          </a>
        </div>
      </div>

      {videoUrl !== null && (
        <div className="ns-vctl">
          <button type="button" className="ns-tool" onClick={togglePlay} aria-label={t(paused ? copy.hero.play : copy.hero.pause, lang)}>
            <span aria-hidden="true">{paused ? '\u25B6' : '\u275A\u275A'}</span>
          </button>
          <button type="button" className="ns-tool" onClick={toggleMute} aria-label={t(muted ? copy.hero.unmute : copy.hero.mute, lang)}>
            <span aria-hidden="true">{muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}</span>
          </button>
        </div>
      )}
    </section>
  )
}

export function Stats() {
  const { lang } = useNewSite()
  return (
    <section className="ns-stats">
      <div className="ns-wrap">
        {siteContent.stats.map((stat) => (
          <div key={stat.label.en}>
            <b>{stat.value}</b>
            <span>
              {t(stat.label, lang)}
              {siteContent.isSample && ` ${t(copy.sample, lang)}`}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
