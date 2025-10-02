import type { Locale } from '@/lib/locales'
import { HeroSection } from '@/components/home/hero-section'
import { ServicesSection } from '@/components/home/services-section'

export default function Page({ params: { locale } } : { params: { locale: Locale }}){
  return (
    <main>
      <HeroSection />
      <ServicesSection locale={locale} />
    </main>
  )
}
