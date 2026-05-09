import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LINKS } from '@/lib/config';

interface ShowcaseItem {
  src: string;
  badge: string;
  titleKey: string;
  descKey: string;
  accent: string;
  reverse?: boolean;
}

const ITEMS: ShowcaseItem[] = [
  {
    src: '/screenshots/desktop/deals-kanban.png',
    badge: '🗂',
    titleKey: 'showcase_1_title',
    descKey: 'showcase_1_desc',
    accent: 'from-violet-600 to-purple-500',
  },
  {
    src: '/screenshots/desktop/statistics.png',
    badge: '📊',
    titleKey: 'showcase_2_title',
    descKey: 'showcase_2_desc',
    accent: 'from-emerald-600 to-teal-500',
    reverse: true,
  },
  {
    src: '/screenshots/desktop/ai-chats.png',
    badge: '🤖',
    titleKey: 'showcase_3_title',
    descKey: 'showcase_3_desc',
    accent: 'from-indigo-600 to-blue-500',
  },
];

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-[#1a1a2e]">
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1a1a2e] border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-red-500/60" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
        <span className="w-3 h-3 rounded-full bg-green-500/60" />
        <span className="ml-3 flex-1 h-5 rounded-md bg-white/5 text-[10px] text-text-3 flex items-center px-3">
          crm.pashkovsky-group.com
        </span>
      </div>
      {/* Screenshot */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 10' }}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top"
          sizes="(max-width: 1024px) 100vw, 55vw"
        />
      </div>
    </div>
  );
}

export default function ScreenshotShowcase() {
  const t = useTranslations('showcase');

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#0c0c14]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 lg:space-y-32">

        {/* Section label */}
        <div className="text-center">
          <p className="text-xs text-text-3 uppercase tracking-widest font-medium mb-4">
            {t('label')}
          </p>
          <h2 className="animate-on-scroll font-syne font-800 text-3xl sm:text-4xl lg:text-5xl text-white">
            {t('title')}
          </h2>
        </div>

        {ITEMS.map(({ src, badge, titleKey, descKey, accent, reverse }, i) => (
          <div
            key={src}
            className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
          >
            {/* Text */}
            <div className={`animate-on-scroll delay-${i + 1} space-y-5`}>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${accent} bg-opacity-10 border border-white/10 text-sm font-medium text-white`}>
                <span>{badge}</span>
                <span>{t(`${titleKey}_badge` as 'showcase_1_title_badge')}</span>
              </div>

              <h3 className="font-syne font-800 text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
                {t(titleKey as 'showcase_1_title')}
              </h3>

              <p className="text-base text-text-2 leading-relaxed max-w-lg">
                {t(descKey as 'showcase_1_desc')}
              </p>

              {/* Bullet points */}
              <ul className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-center gap-3 text-sm text-text-2">
                    <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center shrink-0`}>
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {t(`${titleKey}_point_${n}` as 'showcase_1_title_point_1')}
                  </li>
                ))}
              </ul>

              <a
                href={LINKS.register}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r ${accent} text-white text-sm font-semibold shadow-lg transition-transform hover:scale-105`}
              >
                {t('cta')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            {/* Browser screenshot */}
            <div className={`animate-on-scroll delay-${i + 2}`}>
              <BrowserFrame src={src} alt={t(titleKey as 'showcase_1_title')} />
            </div>
          </div>
        ))}

        {/* Remaining screenshots grid */}
        <div className="animate-on-scroll">
          <p className="text-center text-xs text-text-3 uppercase tracking-widest font-medium mb-8">
            {t('more_label')}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { src: '/screenshots/desktop/deals-pipeline.png', label: t('screen_pipeline') },
              { src: '/screenshots/desktop/leads.png',          label: t('screen_leads') },
              { src: '/screenshots/desktop/worker-detail.png',  label: t('screen_workers') },
              { src: '/screenshots/desktop/dashboard.png',      label: t('screen_dashboard') },
            ].map(({ src, label }) => (
              <div key={src} className="group">
                <div className="rounded-xl overflow-hidden border border-white/8 shadow-lg shadow-black/30 bg-[#1a1a2e] group-hover:border-violet-500/30 transition-all duration-300 group-hover:-translate-y-1">
                  {/* Mini chrome */}
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-[#1a1a2e] border-b border-white/5">
                    <span className="w-2 h-2 rounded-full bg-red-500/50" />
                    <span className="w-2 h-2 rounded-full bg-yellow-500/50" />
                    <span className="w-2 h-2 rounded-full bg-green-500/50" />
                  </div>
                  <div className="relative w-full" style={{ aspectRatio: '16 / 10' }}>
                    <Image
                      src={src}
                      alt={label}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 640px) 50vw, 25vw"
                    />
                  </div>
                </div>
                <p className="text-center text-xs text-text-3 mt-2 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
