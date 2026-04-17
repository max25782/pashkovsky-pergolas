'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLanguage } from '@/lib/language-context'
import clsx from 'clsx'

const STEP_COUNT = 3

export interface OnboardingModalProps {
  open: boolean
  onComplete: () => void | Promise<void>
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const t = useTranslations('onboarding')
  const { language } = useLanguage()
  const dir = language === 'he' ? 'rtl' : 'ltr'
  const [step, setStep] = useState(0)

  const titles = [t('step1Title'), t('step2Title'), t('step3Title')]
  const descriptions = [t('step1Desc'), t('step2Desc'), t('step3Desc')]

  const handleFinish = useCallback(() => {
    void Promise.resolve(onComplete()).finally(() => {
      setStep(0)
    })
  }, [onComplete])

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      dir={dir}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-950 to-black shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-blue-500 to-emerald-400" />
        <div className="p-6 sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-300/90">
            {t('progress', { current: step + 1, total: STEP_COUNT })}
          </p>
          <h2 id="onboarding-title" className="text-xl font-bold text-white sm:text-2xl">
            {titles[step]}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">{descriptions[step]}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className={clsx(
                'rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium transition',
                step === 0 ? 'cursor-not-allowed opacity-40' : 'text-white hover:bg-white/10',
              )}
            >
              {t('back')}
            </button>
            <div className="flex flex-1 justify-end gap-3">
              {step < STEP_COUNT - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  {t('next')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  {t('finish')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
