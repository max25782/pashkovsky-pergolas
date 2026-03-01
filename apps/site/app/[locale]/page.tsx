import type { Locale } from '@/lib/locales'
import { HeroSection } from '@/components/home/hero-section'
import { ServicesSection } from '@/components/home/services-section'
import { VideoGallery } from '@/components/video/VideoGallery'
import ContactSection from '@/components/contact-section'
import { PartnersLogos } from '@/components/home/partners-logos'
import Footer from '@/components/footer/footer'
import WhyChooseUs from '@/components/home/WhyChooseUs'

export default function Page({ params: { locale } } : { params: { locale: Locale }}){
  return (
    <main>
      <HeroSection />
      <WhyChooseUs locale={locale} />
      <ServicesSection locale={locale} />
      <ContactSection locale={locale} pageName="home" />
      <PartnersLogos locale={locale} />
      <Footer locale={locale} />
    </main>
  )
}
