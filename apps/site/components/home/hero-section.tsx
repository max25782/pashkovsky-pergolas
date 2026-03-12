import ContactCtaButton from '@/components/contact/ContactCtaButton'
import { getImageUrl } from '@/lib/image-url-client'
import type { Locale } from '@/lib/locales'

const TITLE: Record<Locale, string> = {
  he: 'הפרגולה המושלמת מתחילה כאן',
  ru: 'Идеальная пергола начинается здесь',
  en: 'The perfect pergola starts here',
}

const SUBTITLE: Record<Locale, string> = {
  he: 'פרגולות אלומיניום בהתאמה מושלמת לבית שלך – פתרון מעוצב, עמיד ויפהפה לאורך שנים',
  ru: 'Алюминиевые перголы, идеально подходящие к вашему дому — стильное, долговечное и красивое решение на годы',
  en: 'Aluminum pergolas, perfectly tailored to your home — stylish, durable and beautiful for years',
}

interface HeroSectionProps {
  locale: Locale
}

export function HeroSection({ locale }: HeroSectionProps) {
  const videoSrc = getImageUrl('/hero/photo_2025-10-03_22-07-08_merged.mp4')

  return (
    <section className="relative h-[100vh] min-h-[600px] bg-black text-white overflow-hidden">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-black/30" aria-hidden />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto h-full grid place-content-center">
        <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
          {TITLE[locale]}
        </h1>
        <p className="text-lg md:text-2xl mb-6 drop-shadow-md">
          {SUBTITLE[locale]}
        </p>
        <div className="flex items-center justify-center gap-3">
          <ContactCtaButton locale={locale} />
        </div>
      </div>
    </section>
  )
}
