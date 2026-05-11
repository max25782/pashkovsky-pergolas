'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CRM_URL, LINKS } from '@/lib/config';

const TOTAL_SPOTS = 20;
const FLOOR = 5;
const SPOTS_ENDPOINT = `${CRM_URL}/api/public/early-bird/spots`;

interface SpotsPayload {
  remaining: number;
  total: number;
  isOpen: boolean;
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface PlanProps {
  name: string;
  price: string;
  regularPrice: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  href: string;
  badge?: string;
  highlighted?: boolean;
  earlyBirdTag: string;
  regularLabel: string;
  currency: string;
  earlyBirdNote: string;
}

function PlanCard({
  name, price, regularPrice, period, desc, features,
  cta, href, badge, highlighted, earlyBirdTag, regularLabel,
  currency, earlyBirdNote,
}: PlanProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all duration-300 ${
        highlighted
          ? 'border-violet-500/50 bg-gradient-to-b from-violet-600/10 to-[#1c1c2e] shadow-2xl shadow-violet-500/15 scale-[1.02]'
          : 'border-white/8 bg-[#1c1c2e] hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/5'
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="btn-shimmer text-xs font-semibold text-white px-3 py-1 rounded-full shadow-lg">
            {badge}
          </span>
        </div>
      )}

      <div className="mb-5">
        <h3 className="font-syne font-700 text-lg text-white mb-1">{name}</h3>
        <p className="text-xs text-text-2">{desc}</p>
      </div>

      {/* Price block */}
      <div className="mb-6 space-y-1">
        {/* Crossed-out regular price + Early Bird badge — only when earlyBirdNote is set */}
        {earlyBirdNote !== '' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-3 line-through">{regularLabel} {currency}{regularPrice}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
              {earlyBirdTag}
            </span>
          </div>
        )}
        {/* Main price */}
        <div className="flex items-end gap-1">
          <span className="font-syne font-800 text-4xl sm:text-5xl text-white">{currency}{price}</span>
          <span className="text-text-2 text-sm mb-1.5">{period}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5">
            <CheckIcon />
            <span className="text-sm text-text-2">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={href}
        className={`block text-center py-3 rounded-xl font-syne font-600 text-sm transition-all ${
          highlighted
            ? 'btn-shimmer text-white shadow-lg shadow-violet-500/20 hover:scale-105'
            : 'bg-white/8 border border-white/10 text-white hover:bg-white/12 hover:border-white/20'
        }`}
      >
        {cta}
      </a>
    </div>
  );
}

export default function Pricing() {
  const t = useTranslations('pricing');
  const [annual, setAnnual] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState<number>(FLOOR); // SSR-safe init at the floor
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSpots() {
      try {
        const res = await fetch(SPOTS_ENDPOINT, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<SpotsPayload>;
        if (cancelled) return;
        if (typeof data.remaining === 'number') {
          setSpotsLeft(Math.max(FLOOR, Math.min(TOTAL_SPOTS, data.remaining)));
        }
      } catch {
        // Network failure: keep the floor value, no scary 0
      }
    }

    fetchSpots();
    // Refresh occasionally so visitors who linger see live updates
    const refreshId = setInterval(fetchSpots, 60_000);

    // Occasional pulse to draw attention
    const pulseId = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(refreshId);
      clearInterval(pulseId);
    };
  }, []);

  const spotsFraction = (TOTAL_SPOTS - spotsLeft) / TOTAL_SPOTS;

  const currency = t('currency');
  const earlyBirdNote = t('earlyBirdNote');
  const earlyBirdTag = t('early_bird_tag');
  const regularLabel = t('regular_label');

  const plans: PlanProps[] = [
    {
      name: t('plan_starter_name'),
      price: annual ? t('plan_starter_price_annual') : t('plan_starter_price'),
      regularPrice: t('plan_starter_price_regular'),
      period: t('plan_starter_period'),
      desc: t('plan_starter_desc'),
      features: t.raw('plan_starter_features') as string[],
      cta: t('plan_starter_cta'),
      href: LINKS.register,
      currency,
      earlyBirdNote,
      earlyBirdTag,
      regularLabel,
    },
    {
      name: t('plan_pro_name'),
      price: annual ? t('plan_pro_price_annual') : t('plan_pro_price'),
      regularPrice: t('plan_pro_price_regular'),
      period: t('plan_pro_period'),
      desc: t('plan_pro_desc'),
      features: t.raw('plan_pro_features') as string[],
      cta: t('plan_pro_cta'),
      href: LINKS.register,
      badge: t('plan_pro_badge'),
      highlighted: true,
      currency,
      earlyBirdNote,
      earlyBirdTag,
      regularLabel,
    },
    {
      name: t('plan_enterprise_name'),
      price: annual ? t('plan_enterprise_price_annual') : t('plan_enterprise_price'),
      regularPrice: t('plan_enterprise_price_regular'),
      period: t('plan_enterprise_period'),
      desc: t('plan_enterprise_desc'),
      features: t.raw('plan_enterprise_features') as string[],
      cta: t('plan_enterprise_cta'),
      href: LINKS.contactSales,
      currency,
      earlyBirdNote,
      earlyBirdTag,
      regularLabel,
    },
  ];

  return (
    <section id="pricing" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#0e0e1a]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Early Bird alert banner */}
        <div className="animate-on-scroll mb-10 max-w-2xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-600/10 via-orange-600/10 to-amber-600/10 p-5">
            {/* Shimmer strip */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Left: icon + text */}
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-syne font-700 text-white text-sm sm:text-base">
                    {t('early_bird_banner')}
                  </p>
                  <p className="text-xs text-text-2 mt-0.5">
                    {t('early_bird_note')}
                  </p>
                </div>
              </div>

              {/* Right: spots counter */}
              <div className="shrink-0 text-center">
                <div
                  className={`font-syne font-800 text-3xl text-amber-400 transition-transform duration-300 ${
                    pulse ? 'scale-110' : 'scale-100'
                  }`}
                >
                  {spotsLeft}
                </div>
                <div className="text-xs text-text-2 whitespace-nowrap">
                  {t('early_bird_spots', { spots: spotsLeft })}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                style={{ width: `${spotsFraction * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-text-3">
              <span>0</span>
              <span>{t('early_bird_total', { total: TOTAL_SPOTS })}</span>
            </div>
          </div>
        </div>

        {/* Section header */}
        <div className="text-center mb-10">
          <h2 className="animate-on-scroll font-syne font-800 text-3xl sm:text-4xl lg:text-5xl text-white mb-4">
            {t('title')}
          </h2>
          <p className="animate-on-scroll delay-1 text-text-2 text-base sm:text-lg mb-8">
            {t('subtitle')}
          </p>

          {/* Monthly / Annual toggle */}
          <div className="animate-on-scroll delay-2 inline-flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !annual ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-text-2 hover:text-white'
              }`}
            >
              {t('monthly')}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                annual ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-text-2 hover:text-white'
              }`}
            >
              {t('annual')}
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                {t('save')}
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 items-start">
          {plans.map((plan, i) => (
            <div key={plan.name} className={`animate-on-scroll delay-${i + 2}`}>
              <PlanCard {...plan} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
