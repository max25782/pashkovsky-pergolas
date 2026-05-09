import Image from 'next/image';
import { useTranslations } from 'next-intl';

const ICONS = [
  // Pipeline
  <svg key="1" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>,
  // AI
  <svg key="2" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>,
  // WhatsApp / Leads
  <svg key="3" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>,
  // Workers
  <svg key="4" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>,
  // Analytics
  <svg key="5" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>,
  // Multi-language
  <svg key="6" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  </svg>,
];

const COLORS = [
  'from-violet-600 to-purple-500',
  'from-indigo-600 to-blue-500',
  'from-emerald-600 to-teal-500',
  'from-orange-600 to-amber-500',
  'from-pink-600 to-rose-500',
  'from-cyan-600 to-sky-500',
];

const SCREENSHOTS = [
  '/screenshots/desktop/deals-kanban.png',
  '/screenshots/desktop/ai-chats.png',
  '/screenshots/desktop/leads.png',
  '/screenshots/desktop/worker-detail.png',
  '/screenshots/desktop/statistics.png',
  '/screenshots/desktop/dashboard.png',
];

type TitleKey = 'item_1_title' | 'item_2_title' | 'item_3_title' | 'item_4_title' | 'item_5_title' | 'item_6_title';
type DescKey  = 'item_1_desc'  | 'item_2_desc'  | 'item_3_desc'  | 'item_4_desc'  | 'item_5_desc'  | 'item_6_desc';

const KEYS = ['item_1', 'item_2', 'item_3', 'item_4', 'item_5', 'item_6'] as const;

function BrowserChrome() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a2e] border-b border-white/5">
      <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
      <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      <span className="ml-2 flex-1 h-4 rounded bg-white/5 text-[9px] text-text-3 flex items-center px-2">
        crm.pashkovsky-group.com
      </span>
    </div>
  );
}

export default function Features() {
  const t = useTranslations('features');

  return (
    <section id="features" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#0e0e1a]" />
      <div className="absolute inset-0 bg-cta-glow opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="animate-on-scroll font-syne font-800 text-3xl sm:text-4xl lg:text-5xl text-white mb-4">
            {t('title')}
          </h2>
          <p className="animate-on-scroll delay-1 text-text-2 text-base sm:text-lg max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Grid — browser-frame cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {KEYS.map((key, i) => (
            <div
              key={key}
              className={`glow-card overflow-hidden animate-on-scroll delay-${Math.min(i + 1, 6)} flex flex-col`}
            >
              {/* Browser-frame screenshot */}
              <div className="rounded-t-xl overflow-hidden border-b border-white/5">
                <BrowserChrome />
                <div className="relative w-full overflow-hidden bg-[#13131f]" style={{ aspectRatio: '16 / 10' }}>
                  <Image
                    src={SCREENSHOTS[i]}
                    alt={t(`${key}_title` as TitleKey)}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* Bottom fade so screenshot blends into card text */}
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#1c1c2e] to-transparent" />
                </div>
              </div>

              {/* Text */}
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${COLORS[i]} flex items-center justify-center text-white shadow-lg`}>
                  {ICONS[i]}
                </div>
                <h3 className="font-syne font-700 text-base text-white leading-snug">
                  {t(`${key}_title` as TitleKey)}
                </h3>
                <p className="text-sm text-text-2 leading-relaxed">
                  {t(`${key}_desc` as DescKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
