import Image from 'next/image'
import { Locale } from '@/lib/locales'

interface PartnersLogosProps {
  locale?: Locale
}

function getHeading(locale: Locale): string {
  if (locale === 'ru') return 'Компании, с которыми мы работаем'
  if (locale === 'en') return 'Companies we work with'
  return 'חברות שבחרו אותנו'
}

const LOGOS: Array<{ src: string; alt: string; width: number; height: number }> = [
  { src: '/images/logos/beit amana.jpg', alt: 'Beit Amana', width: 220, height: 120 },
  { src: '/images/logos/nitzav.png', alt: 'Nitzav', width: 220, height: 120 },
  { src: '/images/logos/tzurim.jpg', alt: 'Tzurim', width: 220, height: 120 },
  { src: '/images/logos/ofek2.webp', alt: 'Ofek', width: 220, height: 120 },
  { src: '/images/logos/לוגו_שאג.jpg', alt: 'SHAG', width: 220, height: 120 },
  { src: '/images/logos/logo-1.png', alt: 'Partner', width: 220, height: 120 },
]

export function PartnersLogos({ locale = 'he' }: PartnersLogosProps) {
  const heading = getHeading(locale)
  return (
    <section className="py-16 bg-neutral-950 text-white">
      <div className="container bg-white text-black rounded-3xl mx-auto px-4">
        <h2 className="text-center text-2xl sm:text-3xl font-bold mb-10">{heading}</h2>
        <div className="flex items-center justify-around gap-10 md:gap-12 flex-wrap">
          {LOGOS.map((logo) => (
            <div key={logo.src} className="flex items-center justify-center">
              <Image
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                className="object-contain max-h-16 md:max-h-20 w-auto opacity-80 hover:opacity-100 transition-opacity duration-200 grayscale hover:grayscale-0"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}


