import Image from 'next/image';
import { useTranslations } from 'next-intl';

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

type TestimonialKey = '1' | '2' | '3';

function Testimonial({
  tKey,
  t,
}: {
  tKey: TestimonialKey;
  t: ReturnType<typeof useTranslations<'proof'>>;
}) {
  return (
    <div className="glow-card p-6 space-y-4">
      <StarRating />
      <p className="text-text-2 text-sm leading-relaxed">
        &ldquo;{t(`testimonial_${tKey}_text` as 'testimonial_1_text')}&rdquo;
      </p>
      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center text-white text-sm font-syne font-700 shrink-0">
          {t(`testimonial_${tKey}_author` as 'testimonial_1_author').charAt(0)}
        </div>
        <div>
          <div className="text-sm font-medium text-white">
            {t(`testimonial_${tKey}_author` as 'testimonial_1_author')}
          </div>
          <div className="text-xs text-text-3">
            {t(`testimonial_${tKey}_role` as 'testimonial_1_role')}
          </div>
        </div>
      </div>
    </div>
  );
}

const PHONE_SCREENS = [
  { src: '/screenshots/pipeline.png', label: 'Deal Pipeline' },
  { src: '/screenshots/profit.png', label: 'Profit Calculator' },
  { src: '/screenshots/payments.png', label: 'Payment Plan' },
  { src: '/screenshots/worklog.png', label: 'Work Log' },
  { src: '/screenshots/analytics.png', label: 'Analytics' },
  { src: '/screenshots/quick-offer.png', label: 'Quick Offer AI' },
];

export default function ProofSection() {
  const t = useTranslations('proof');

  const stats = [
    { value: t('stat_1'), label: t('stat_1_label') },
    { value: t('stat_2'), label: t('stat_2_label') },
    { value: t('stat_3'), label: t('stat_3_label') },
  ];

  return (
    <section id="testimonials" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#0c0c14]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="animate-on-scroll font-syne font-800 text-3xl sm:text-4xl lg:text-5xl text-white mb-4">
            {t('title')}
          </h2>
          <p className="animate-on-scroll delay-1 text-text-2 text-base sm:text-lg max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-20 max-w-2xl mx-auto">
          {stats.map(({ value, label }, i) => (
            <div
              key={label}
              className={`animate-on-scroll delay-${i + 1} text-center p-4 sm:p-6 rounded-2xl bg-white/3 border border-white/5`}
            >
              <div className="font-syne font-800 text-2xl sm:text-4xl gradient-text mb-1">{value}</div>
              <div className="text-xs sm:text-sm text-text-2 font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* Real app screenshots — horizontal scroll strip */}
        <div className="animate-on-scroll mb-20">
          <p className="text-center text-xs text-text-3 uppercase tracking-widest font-medium mb-8">
            Real product — live at crm.pashkovsky-group.com
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
            {PHONE_SCREENS.map(({ src, label }) => (
              <div
                key={src}
                className="shrink-0 snap-start w-36 sm:w-auto group"
              >
                <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl shadow-black/40 bg-[#1a1a2e] group-hover:border-violet-500/40 transition-all duration-300 group-hover:-translate-y-1"
                  style={{ aspectRatio: '9/19.5' }}>
                  <Image
                    src={src}
                    alt={label}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 640px) 144px, (max-width: 1024px) 200px, 160px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
                </div>
                <p className="text-center text-xs text-text-3 mt-2 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {(['1', '2', '3'] as TestimonialKey[]).map((key, i) => (
            <div key={key} className={`animate-on-scroll delay-${i + 2}`}>
              <Testimonial tKey={key} t={t} />
            </div>
          ))}
        </div>

        {/* Brand strip */}
        <div className="mt-16 text-center">
          <p className="text-xs text-text-3 uppercase tracking-widest mb-6 font-medium">
            Trusted by companies across Israel, Russia & Serbia
          </p>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 items-center opacity-30">
            {['Pergola Masters', 'AlumPro', 'StructureBuild', 'MetalFrame', 'SunShade Co'].map(
              (name) => (
                <span
                  key={name}
                  className="font-syne font-700 text-sm sm:text-base text-white tracking-wide"
                >
                  {name}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
