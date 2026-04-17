'use client'

import Link from 'next/link'
import { FileText, Sparkles, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useLanguage } from '@/lib/language-context'
import clsx from 'clsx'

export function FirstActions() {
  const t = useTranslations('onboarding')
  const { language } = useLanguage()
  const dir = language === 'he' ? 'rtl' : 'ltr'

  const cards = [
    {
      href: '/app/quick-offer',
      title: t('firstActionOfferTitle'),
      description: t('firstActionOfferDesc'),
      icon: Sparkles,
      accent: 'from-amber-500/30 to-orange-600/20 border-amber-500/40',
    },
    {
      href: '/app/admin/leads',
      title: t('firstActionLeadsTitle'),
      description: t('firstActionLeadsDesc'),
      icon: UserPlus,
      accent: 'from-blue-500/25 to-cyan-600/15 border-blue-500/35',
    },
    {
      href: '/app/admin/deals',
      title: t('firstActionDealsTitle'),
      description: t('firstActionDealsDesc'),
      icon: FileText,
      accent: 'from-emerald-500/25 to-green-700/15 border-emerald-500/35',
    },
  ] as const

  return (
    <section className="mb-10 space-y-5" dir={dir}>
      <Link
        href="/app/quick-offer"
        className="group relative block overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-yellow-600/15 p-5 shadow-lg shadow-amber-900/20 transition hover:border-amber-300/70 hover:shadow-amber-800/30 sm:p-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-amber-100 sm:text-3xl">{t('quickOfferHero')}</p>
            <p className="mt-1 max-w-xl text-sm text-amber-100/75">{t('quickOfferHeroSub')}</p>
          </div>
          <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-gray-950 transition group-hover:bg-amber-400">
            {t('quickOfferCta')}
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className={clsx(
                'group flex flex-col rounded-xl border bg-gradient-to-br p-5 transition hover:-translate-y-0.5 hover:shadow-lg',
                card.accent,
              )}
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/10 transition group-hover:bg-white/15">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-1 flex-1 text-sm text-white/55">{card.description}</p>
              <span className="mt-4 text-sm font-medium text-blue-300 group-hover:text-blue-200">{t('open')}</span>
            </Link>
          )
        })}
      </div>

      <Link
        href="/app/admin/ai-chats"
        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-white/70 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-100"
      >
        <span aria-hidden>✨</span>
        {t('aiHint')}
      </Link>
    </section>
  )
}
