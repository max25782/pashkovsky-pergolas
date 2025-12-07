import Image from 'next/image'
import { Locale } from '@/lib/locales'
import { getImageUrl } from '@/lib/image-url'

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
        {/* Seamless two-rail marquee */}
        <div className="marquee-duo select-none h-24 sm:h-36 lg:h-40">
          <div className="marquee-rail first">
            {[...LOGOS, ...LOGOS].map((logo, idx) => (
              <div
                key={`a-${logo.src}-${idx}`}
                className="relative shrink-0 px-16 w-40 sm:w-56 lg:w-64 h-24 sm:h-36 lg:h-40 flex items-center justify-center"
              >
                <Image
                  src={getImageUrl(logo.src)}
                  alt={logo.alt}
                  fill
                  sizes="(min-width: 1024px) 16rem, (min-width: 640px) 14rem, 10rem"
                  className="object-contain"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
          <div className="marquee-rail second">
            {[...LOGOS, ...LOGOS].map((logo, idx) => (
              <div
                key={`b-${logo.src}-${idx}`}
                className="relative shrink-0 px-16 w-40 sm:w-56 lg:w-64 h-24 sm:h-36 lg:h-40 flex items-center justify-center"
              >
                <Image
                  src={getImageUrl(logo.src)}
                  alt={logo.alt}
                  fill
                  sizes="(min-width: 1024px) 16rem, (min-width: 640px) 14rem, 10rem"
                  className="object-contain"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}


