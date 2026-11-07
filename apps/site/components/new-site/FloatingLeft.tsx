'use client'

import { useEffect, useRef, useState } from 'react'
import { whatsappUrl } from '@/config/siteContact'
import { copy, t } from './i18n'
import { FONT_SIZE, useNewSite } from './NewSiteProvider'

/** Bottom-left: accessibility menu and WhatsApp (physical left in both languages, as in the concept). */
export function FloatingLeft() {
  const { lang, a11y, updateA11y } = useNewSite()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const label = t(copy.a11yPanel.open, lang)

  // Escape closes the open menu and hands focus back to its button.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="ns-fab ns-fab-l">
      <div className="ns-a11y-wrap">
        {open && (
          <div id="ns-a11y-panel" className="ns-a11y-panel" role="group" aria-label={label}>
            <button
              type="button"
              disabled={a11y.fontSize >= FONT_SIZE.max}
              onClick={() => updateA11y((prev) => ({ fontSize: prev.fontSize + FONT_SIZE.step }))}
            >
              {t(copy.a11yPanel.inc, lang)}
            </button>
            <button
              type="button"
              disabled={a11y.fontSize <= FONT_SIZE.min}
              onClick={() => updateA11y((prev) => ({ fontSize: prev.fontSize - FONT_SIZE.step }))}
            >
              {t(copy.a11yPanel.dec, lang)}
            </button>
            <button type="button" aria-pressed={a11y.contrast} onClick={() => updateA11y((prev) => ({ contrast: !prev.contrast }))}>
              {t(copy.a11yPanel.contrast, lang)}
            </button>
            <button type="button" aria-pressed={a11y.underline} onClick={() => updateA11y((prev) => ({ underline: !prev.underline }))}>
              {t(copy.a11yPanel.underline, lang)}
            </button>
            <button type="button" aria-pressed={a11y.still} onClick={() => updateA11y((prev) => ({ still: !prev.still }))}>
              {t(copy.a11yPanel.still, lang)}
            </button>
            <a href="#accessibility" onClick={() => setOpen(false)}>
              {t(copy.a11yPanel.statement, lang)}
            </a>
          </div>
        )}
        <button
          ref={buttonRef}
          type="button"
          className="ns-fab-a11y"
          aria-label={label}
          aria-expanded={open}
          aria-controls="ns-a11y-panel"
          onClick={() => setOpen((prev) => !prev)}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <circle cx="12" cy="4.5" r="2" />
            <path d="M4 8.5h16v2h-6.2v3.2l2.4 7.3-1.9.6-2.3-6.9-2.3 6.9-1.9-.6 2.4-7.3v-3.2H4z" />
          </svg>
        </button>
      </div>
      <a className="ns-fab-wa" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" aria-label={t(copy.whatsapp, lang)}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" aria-hidden="true" focusable="false">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.200zm4.500-6.100c-.2-.1-1.500-.7-1.700-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6.1a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.2-.4.700-1.300.1-.1 0-.3 0-.4l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.200 5.200 5.200 0 0 0 1.100 2.800 11.900 11.900 0 0 0 4.600 4c1.700.7 2.300.8 3.200.7a2.700 2.700 0 0 0 1.800-1.300 2.200 2.200 0 0 0 .2-1.300c-.1-.1-.3-.2-.5-.3z" />
        </svg>
      </a>
    </div>
  )
}
