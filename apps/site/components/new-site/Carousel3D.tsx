'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { siteMedia } from '@/config/siteMedia'
import { mediaUrl } from '@/lib/new-site/media-url'
import { copy, t } from './i18n'
import { MediaImage } from './MediaImage'
import { useNewSite } from './NewSiteProvider'

/** px per second of automatic movement, kick impulse of an arrow press (px/s) and its decay rate (1/s). */
const AUTO_SPEED = 42
const KICK = 900
const KICK_DECAY = 3
/** Distance an arrow moves when motion is reduced (no animation, instant step). */
const STEP = 300
const DRAG_THRESHOLD = 6
/** After a state change the panels animate their width for ~0.55s; keep redrawing for that long. */
const SETTLE_MS = 900
const MAX_COPIES = 8

interface Engine {
  pos: number
  kick: number
  userPaused: boolean
  reduce: boolean
  /** A panel is hovered or focused by keyboard. */
  active: boolean
  /** A panel is pinned open (tap or Enter). */
  open: boolean
  down: boolean
  drag: boolean
  startX: number
  startPos: number
  lastX: number
  lastT: number
  vel: number
  suppressClick: boolean
  dirtyUntil: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isKeyboardFocus(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    return true // old engines without :focus-visible: treat every focus as keyboard focus
  }
}

export function Carousel3D() {
  const { lang, reduceMotion } = useNewSite()
  const slots = siteMedia.carousel
  const [copies, setCopies] = useState(3)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [userPaused, setUserPaused] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine>({
    pos: 0,
    kick: 0,
    userPaused: false,
    reduce: false,
    active: false,
    open: false,
    down: false,
    drag: false,
    startX: 0,
    startPos: 0,
    lastX: 0,
    lastT: 0,
    vel: 0,
    suppressClick: false,
    dirtyUntil: 0,
  })

  const expandedIdx = activeIdx ?? openIdx

  // Mirror React state into the engine and ask for a redraw while the widths animate.
  useEffect(() => {
    const s = engine.current
    s.active = activeIdx !== null
    s.open = openIdx !== null
    s.userPaused = userPaused
    s.reduce = reduceMotion
    s.dirtyUntil = performance.now() + SETTLE_MS
  }, [activeIdx, openIdx, userPaused, reduceMotion])

  // The animation loop. Runs only while the carousel is on screen; writes to the DOM only when
  // something moves or a width transition is still settling; reads layout before writing.
  useEffect(() => {
    const viewportEl = viewportRef.current
    const trackEl = trackRef.current
    if (viewportEl === null || trackEl === null) return
    // Re-bound as non-null constants: narrowing does not survive into the closures below.
    const viewport: HTMLDivElement = viewportEl
    const track: HTMLDivElement = trackEl
    const s = engine.current
    const count = slots.length
    let raf = 0
    let last = 0

    const panels = (): HTMLElement[] => Array.from(track.children) as HTMLElement[]

    function setWidth(items: HTMLElement[]): number {
      return items.length > count ? items[count].offsetLeft - items[0].offsetLeft : 0
    }

    function frame(now: number): void {
      raf = requestAnimationFrame(frame)
      const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000)
      last = now

      // read
      const items = panels()
      const sw = setWidth(items)
      const vw = viewport.clientWidth
      const auto = !s.userPaused && !s.reduce && !s.active && !s.open && !s.drag
      let delta = 0
      if (auto) delta += AUTO_SPEED * dt
      if (Math.abs(s.kick) > 1) {
        delta += s.kick * dt
        s.kick *= Math.exp(-KICK_DECAY * dt)
      } else {
        s.kick = 0
      }
      s.pos += delta
      if (sw > 0) {
        while (s.pos >= sw) s.pos -= sw
        while (s.pos < 0) s.pos += sw
      }
      if (delta === 0 && !s.drag && now > s.dirtyUntil) return

      const centers = items.map((el) => el.offsetLeft + el.offsetWidth / 2 - s.pos)

      // write
      track.style.transform = `translate3d(${-s.pos}px,0,0)`
      items.forEach((el, i) => {
        const d = clamp((centers[i] - vw / 2) / (vw / 2), -1.4, 1.4)
        el.style.transform = `perspective(1400px) translateZ(${(-Math.abs(d) * 90).toFixed(1)}px) rotateY(${(-d * 16).toFixed(2)}deg)`
      })
    }

    function start(): void {
      if (raf !== 0) return
      last = 0
      s.dirtyUntil = performance.now() + SETTLE_MS
      raf = requestAnimationFrame(frame)
    }

    function stop(): void {
      if (raf !== 0) cancelAnimationFrame(raf)
      raf = 0
    }

    // Enough copies that the visible window never runs off the end of the track.
    function fit(): void {
      const items = panels()
      const sw = setWidth(items)
      if (sw > 0) setCopies((prev) => Math.max(prev, clamp(Math.ceil(viewport.clientWidth / sw) + 2, 3, MAX_COPIES)))
      s.dirtyUntil = performance.now() + SETTLE_MS
    }

    fit()
    window.addEventListener('resize', fit)

    let observer: IntersectionObserver | undefined
    if (typeof IntersectionObserver === 'undefined') {
      start()
    } else {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start()
          else stop()
        }
      })
      observer.observe(viewport)
    }

    return () => {
      stop()
      observer?.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [slots.length])

  const go = useCallback((dir: 1 | -1) => {
    const s = engine.current
    if (s.reduce) {
      s.pos += dir * STEP
      s.dirtyUntil = performance.now() + 100
    } else {
      s.kick = dir * KICK
    }
  }, [])

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const s = engine.current
    s.down = true
    s.drag = false
    s.startX = event.clientX
    s.startPos = s.pos
    s.lastX = event.clientX
    s.lastT = event.timeStamp
    s.vel = 0
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const s = engine.current
    if (!s.down) return
    const dx = event.clientX - s.startX
    if (!s.drag && Math.abs(dx) > DRAG_THRESHOLD) {
      s.drag = true
      viewportRef.current?.setPointerCapture(event.pointerId)
      viewportRef.current?.classList.add('ns-drag')
    }
    if (!s.drag) return
    s.pos = s.startPos - dx
    const dtMs = event.timeStamp - s.lastT
    if (dtMs > 0) s.vel = (-(event.clientX - s.lastX) / dtMs) * 1000
    s.lastX = event.clientX
    s.lastT = event.timeStamp
  }

  function endPointer(event: PointerEvent<HTMLDivElement>, withInertia: boolean): void {
    const s = engine.current
    if (!s.down) return
    s.down = false
    if (!s.drag) return
    s.drag = false
    viewportRef.current?.classList.remove('ns-drag')
    if (viewportRef.current?.hasPointerCapture(event.pointerId) === true) viewportRef.current.releasePointerCapture(event.pointerId)
    // The click that follows a drag must not toggle a panel.
    s.suppressClick = true
    window.setTimeout(() => {
      s.suppressClick = false
    }, 80)
    if (withInertia && !s.reduce) s.kick = clamp(s.vel, -1500, 1500)
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>): void {
    if (!engine.current.suppressClick) return
    event.preventDefault()
    event.stopPropagation()
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const track = trackRef.current
    if (event.key === 'Escape') {
      setOpenIdx(null)
      return
    }
    if (track === null || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return
    const index = Number(event.currentTarget.dataset.index)
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + slots.length) % slots.length
    ;(track.children[next] as HTMLElement | undefined)?.focus()
    event.preventDefault()
  }

  // Focus can scroll an overflow:hidden box; keep the visual position in the transform only
  // and bring an off-screen panel into view by moving `pos`.
  function onPanelFocus(index: number, el: HTMLElement): void {
    const viewport = viewportRef.current
    if (viewport === null) return
    viewport.scrollLeft = 0
    const s = engine.current
    const vw = viewport.clientWidth
    const center = el.offsetLeft + el.offsetWidth / 2 - s.pos
    if (center < 0 || center > vw) {
      s.pos = el.offsetLeft + el.offsetWidth / 2 - vw / 2
      s.dirtyUntil = performance.now() + SETTLE_MS
    }
    if (isKeyboardFocus(el)) setActiveIdx(index)
  }

  return (
    <section id="models" className="ns-section" aria-labelledby="ns-models-title">
      <div className="ns-wrap">
        <span className="ns-kick">{t(copy.models.kick, lang)}</span>
        <h2 id="ns-models-title" className="ns-h2">
          {t(copy.models.title, lang)}
        </h2>
        <p className="ns-sub">{t(copy.models.sub, lang)}</p>
      </div>

      <div
        ref={viewportRef}
        className="ns-car"
        role="group"
        aria-roledescription="carousel"
        aria-label={t(copy.models.region, lang)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, true)}
        onPointerCancel={(e) => endPointer(e, false)}
        onClickCapture={onClickCapture}
        onScroll={(e) => {
          e.currentTarget.scrollLeft = 0
        }}
      >
        <div ref={trackRef} className="ns-track">
          {Array.from({ length: copies }, (_, copy) =>
            slots.map((slot, i) => {
              const isClone = copy > 0
              const title = t(slot.title, lang)
              return (
                <button
                  key={`${copy}-${i}`}
                  type="button"
                  className="ns-pan"
                  data-index={i}
                  aria-expanded={expandedIdx === i}
                  // Clones only exist to make the loop seamless: hidden from assistive tech and the tab order.
                  aria-hidden={isClone ? true : undefined}
                  tabIndex={isClone ? -1 : undefined}
                  onClick={() => setOpenIdx((prev) => (prev === i ? null : i))}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setActiveIdx(i)
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setActiveIdx((prev) => (prev === i ? null : prev))
                  }}
                  onFocus={isClone ? undefined : (e) => onPanelFocus(i, e.currentTarget)}
                  onBlur={isClone ? undefined : () => setActiveIdx((prev) => (prev === i ? null : prev))}
                  onKeyDown={isClone ? undefined : onPanelKeyDown}
                >
                  <span className="ns-pan-img">
                    <MediaImage
                      src={mediaUrl(slot.key)}
                      alt=""
                      hue={slot.hue}
                      slot={`carousel[${i}]`}
                      sizes="(max-width: 860px) 78vw, 460px"
                    />
                  </span>
                  <span className="ns-pan-v" aria-hidden="true">
                    {title}
                  </span>
                  <span className="ns-pan-cap">
                    <strong>{title}</strong>
                    <small>{slot.size}</small>
                  </span>
                </button>
              )
            }),
          )}
        </div>
      </div>

      <div className="ns-wrap">
        <div className="ns-car-ctl">
          {/* The strip itself is always laid out left to right, so the arrows are physical in both languages. */}
          <button type="button" onClick={() => go(-1)} aria-label={t(copy.models.prev, lang)}>
            <span aria-hidden="true">{'\u2190'}</span>
          </button>
          <button type="button" onClick={() => go(1)} aria-label={t(copy.models.next, lang)}>
            <span aria-hidden="true">{'\u2192'}</span>
          </button>
          {!reduceMotion && (
            <button
              type="button"
              onClick={() => setUserPaused((prev) => !prev)}
              aria-label={t(userPaused ? copy.models.play : copy.models.pause, lang)}
            >
              <span aria-hidden="true">{userPaused ? '\u25B6' : '\u275A\u275A'}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
