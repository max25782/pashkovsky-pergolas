import { useTranslations } from 'next-intl';
import { LINKS } from '@/lib/config';

export default function TrialBanner() {
  const t = useTranslations('trial');

  return (
    <section id="trial" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#0c0c14]" />

      {/* Glow */}
      <div className="absolute inset-0 bg-cta-glow" aria-hidden="true" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/12 rounded-full blur-3xl" aria-hidden="true" />

      {/* Grid dots */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        {/* Icon */}
        <div className="animate-on-scroll inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 items-center justify-center mb-8 shadow-2xl shadow-violet-500/30 mx-auto">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h2 className="animate-on-scroll delay-1 font-syne font-800 text-3xl sm:text-4xl lg:text-5xl text-white mb-4 leading-tight">
          {t('headline')}
        </h2>

        <p className="animate-on-scroll delay-2 text-text-2 text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          {t('subheadline')}
        </p>

        <div className="animate-on-scroll delay-3 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={LINKS.register}
            className="btn-shimmer inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-syne font-700 text-white text-base shadow-2xl shadow-violet-500/30 transition-transform hover:scale-105"
          >
            {t('cta')}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        <p className="animate-on-scroll delay-4 mt-4 text-xs text-text-3 flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {t('note')}
        </p>
      </div>
    </section>
  );
}
