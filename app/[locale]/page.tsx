import type { Locale } from '@/lib/locales'
import { HeroSection } from '@/components/home/hero-section'
import { ServicesSection } from '@/components/home/services-section'
import { VideoGallery } from '@/components/video/VideoGallery'
import ContactSection from '@/components/contact-section'
import { PartnersLogos } from '@/components/home/partners-logos'

export default function Page({ params: { locale } } : { params: { locale: Locale }}){
  return (
    <main>
      <HeroSection />
      <ServicesSection locale={locale} />
      <ContactSection locale={locale} />
      <PartnersLogos locale={locale} />
    </main>
  )
}
