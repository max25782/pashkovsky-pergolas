import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LINKS } from '@/lib/config';

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-syne font-800 text-2xl sm:text-3xl text-white">{value}</span>
      <span className="text-xs sm:text-sm text-text-2 font-medium">{label}</span>
    </div>
  );
}

function PhoneMockup({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-[2.5rem] overflow-hidden border-4 border-white/15 shadow-2xl shadow-black/60 bg-[#1a1a2e] ${className}`}
      style={{ aspectRatio: '9/19.5' }}
    >
      <Image src={src} alt={alt} fill className="object-cover object-top" sizes="240px" />
    </div>
  );
}

export default function Hero() {
  const t = useTranslations('hero');

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-16">
      {/* Pain image — stressed businessman, heavily darkened */}
      <div className="absolute inset-0">
        <Image
          src="/screenshots/hero-pain.png"
          alt="Construction business chaos"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        {/* Multi-layer overlay: dark purple + gradient */}
        <div className="absolute inset-0 bg-[#0c0c14]/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c14] via-[#0c0c14]/85 to-[#0c0c14]/40" />
        <div className="absolute inset-0 bg-hero-glow" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text side */}
          <div className="text-center lg:text-start space-y-6 lg:space-y-8">
            {/* Badge */}
            <div className="animate-on-scroll inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-600/10 text-violet-300 text-xs sm:text-sm font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              {t('badge')}
            </div>

            {/* Headline */}
            <div className="animate-on-scroll delay-1 space-y-1">
              <h1 className="font-syne font-800 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-white leading-tight tracking-tight">
                {t('headline_1')}
              </h1>
              <h1 className="font-syne font-800 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-tight tracking-tight gradient-text">
                {t('headline_2')}
              </h1>
            </div>

            {/* Subheadline */}
            <p className="animate-on-scroll delay-2 text-base sm:text-lg text-text-2 leading-relaxed max-w-xl mx-auto lg:mx-0">
              {t('subheadline')}
            </p>

            {/* CTAs */}
            <div className="animate-on-scroll delay-3 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <a
                href={LINKS.register}
                className="btn-shimmer inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-syne font-600 text-white text-sm sm:text-base shadow-lg shadow-violet-500/25 transition-transform hover:scale-105"
              >
                {t('cta_primary')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium text-text-2 hover:text-white text-sm sm:text-base border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('cta_secondary')}
              </a>
            </div>

            {/* No card note */}
            <p className="animate-on-scroll delay-4 text-xs text-text-3 flex items-center gap-1.5 justify-center lg:justify-start">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('no_card')}
            </p>

            {/* Stats */}
            <div className="animate-on-scroll delay-5 pt-4 border-t border-white/10 grid grid-cols-3 gap-4 max-w-sm mx-auto lg:mx-0">
              <StatCard value={t('stat_companies')} label={t('stat_companies_label')} />
              <StatCard value={t('stat_deals')} label={t('stat_deals_label')} />
              <StatCard value={t('stat_revenue')} label={t('stat_revenue_label')} />
            </div>
          </div>

          {/* Phone mockup stack */}
          <div className="animate-on-scroll delay-2 hidden lg:flex items-center justify-center relative h-[560px]">
            {/* Back phone — pipeline */}
            <div className="absolute right-4 top-8 w-48 rotate-6 opacity-70 hover:opacity-90 transition-all duration-300 hover:rotate-3">
              <PhoneMockup src="/screenshots/pipeline.png" alt="Deal pipeline" />
            </div>
            {/* Middle phone — analytics */}
            <div className="absolute left-4 bottom-8 w-44 -rotate-4 opacity-65 hover:opacity-85 transition-all duration-300 hover:-rotate-1">
              <PhoneMockup src="/screenshots/analytics.png" alt="Analytics" />
            </div>
            {/* Front phone — main hero */}
            <div className="relative w-56 z-10 animate-float drop-shadow-2xl">
              <PhoneMockup src="/screenshots/quick-offer.png" alt="Quick offer AI" />
              {/* Floating badge */}
              <div className="absolute -top-3 -right-4 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg shadow-emerald-500/30 whitespace-nowrap">
                AI ✦ 30 sec
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0c0c14] to-transparent" aria-hidden="true" />
    </section>
  );
}
