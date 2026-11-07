'use client'

import { useEffect, useRef, type MouseEvent } from 'react'
import { AccessibilityPage } from './AccessibilityPage'
import { AiChat } from './AiChat'
import { Calculator } from './Calculator'
import { Carousel3D } from './Carousel3D'
import { FloatingLeft } from './FloatingLeft'
import { Footer } from './Footer'
import { Header } from './Header'
import { Hero, Stats } from './Hero'
import { copy, t } from './i18n'
import { LeadSection } from './LeadSection'
import { NewSiteProvider, useNewSite } from './NewSiteProvider'
import { PartnersMarquee } from './PartnersMarquee'
import { Process } from './Process'
import { Reviews } from './Reviews'
import { Warranty } from './Warranty'
import { Works } from './Works'

function Page() {
  const { lang, view } = useNewSite()

  // Leaving #accessibility for an in-page anchor: the target only exists after the home view renders.
  const previousView = useRef(view)
  useEffect(() => {
    const wasAccessibility = previousView.current === 'accessibility'
    previousView.current = view
    if (view !== 'home' || !wasAccessibility) return
    const id = window.location.hash.slice(1)
    if (id !== '') document.getElementById(id)?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [view])

  // A plain #main link would change the hash and with it the view, so focus the landmark directly.
  function skipToMain(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault()
    document.getElementById('main')?.focus()
  }

  return (
    <>
      <a className="ns-skip" href="#main" onClick={skipToMain}>
        {t(copy.skip, lang)}
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        {view === 'accessibility' ? (
          <AccessibilityPage />
        ) : (
          <>
            <Hero />
            <Stats />
            <Carousel3D />
            <Works />
            <Reviews />
            <Process />
            <Calculator />
            <Warranty />
            <PartnersMarquee />
            <LeadSection />
          </>
        )}
      </main>
      <Footer />
      <FloatingLeft />
      <AiChat />
    </>
  )
}

export function NewSiteApp() {
  return (
    <NewSiteProvider>
      <Page />
    </NewSiteProvider>
  )
}
