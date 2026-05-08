'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Download,
  MessageCircle,
  Mail,
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Loader2,
  X,
  Box,
  Lock,
} from 'lucide-react'
import type {
  OfferDraft,
  Pergola,
  PergolaProductType,
  QuickOfferFenceVariant,
  QuickOfferGlazingSystem,
  QuickOfferProductType,
  QuickOfferRailingsLocation,
  WinterClosureItem,
} from '@/types/offer'
import {
  DEFAULT_OFFER_VALUES,
  PERGOLA_TYPE_NAMES,
  PERGOLA_TYPE_DEFAULT_PRICES,
  type Offer,
} from '@/types/offer'
import { calculateOffer, formatPrice, quickOfferRailingsFenceAreaSqm } from '@/lib/offer-calculator'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'
import { PergolaShapeSelector } from '@/components/offers/PergolaShapeSelector'
import { authFetch } from '@/lib/api/auth-fetch'
import { formatPhoneForWhatsApp } from '@/lib/offer-sharing'
import { OfferConfiguratorEmbed, type OfferConfiguratorEmbedHandle } from '@/components/offers/OfferConfiguratorEmbed'
import { useSubscriptionPlan } from '@/components/subscription/subscription-plan-context'
import { minPlanForFeature } from '@/lib/subscription/plan-access'
import { useLanguage, type Language } from '@/lib/language-context'
import type { Locale } from '@/lib/locales'
import type { OfferAiOutputLanguage } from '@/lib/ai/offer-text-output-languages'

function uiLanguageToAiDefault(lang: Language): OfferAiOutputLanguage {
  if (lang === 'en' || lang === 'ru' || lang === 'he') return lang
  return 'en'
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'form' | 'result'

interface QuickOfferResult {
  offerId: string
  dealId?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="font-semibold text-white">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-white/60">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors'

const toggleCls = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
  }`

// ─── Save to CRM Modal ────────────────────────────────────────────────────────

function SaveToCrmModal({
  offerId,
  mode = 'save',
  onClose,
  onSaved,
}: {
  offerId: string
  /** After customer approval, use convert copy in the modal. */
  mode?: 'save' | 'convert'
  onClose: () => void
  onSaved: (dealId: string) => void
}) {
  const t = useTranslations('quickOffer')
  const tCommon = useTranslations('common')
  const tSub = useTranslations('subscription')
  const { can } = useSubscriptionPlan()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isConvert = mode === 'convert'
  const modalTitle = isConvert ? t('convertToDealTitle') : t('saveCrmTitle')
  const modalSubtitle = isConvert ? t('convertToDealSubtitle') : t('saveCrmSubtitle')

  async function handleSave() {
    if (!can('save_offer_to_crm')) return
    if (!name.trim()) {
      setError(t('errorNameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await authFetch(`/api/quick-offer/${offerId}/save-to-crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name, customerPhone: phone, customerCity: city }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? t('errorSaving'))
      }
      const data = await res.json() as { dealId: string }
      onSaved(data.dealId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!can('save_offer_to_crm')) {
    const need = minPlanForFeature('save_offer_to_crm')
    const planLabel = tSub(`planNames.${need}`)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" aria-hidden />
              {modalTitle}
            </h2>
            <button type="button" onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/70 text-sm">{tSub('saveToCrmBlocked')}</p>
          <p className="text-amber-200/90 text-sm">{tSub('availableInPlan', { plan: planLabel })}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {tCommon('close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/60 text-sm">{modalSubtitle}</p>

        <div className="space-y-3">
          <Field label={t('fieldCustomerName')}>
            <input
              className={inputCls}
              placeholder={t('fieldCustomerNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t('fieldPhone')}>
            <input
              className={inputCls}
              placeholder={t('fieldPhonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label={tCommon('city')}>
            <input
              className={inputCls}
              placeholder={t('fieldCityPlaceholder')}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-60 transition-colors font-medium"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('btnSave')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── WhatsApp Modal ───────────────────────────────────────────────────────────

function WhatsAppModal({
  offerId,
  finalPrice,
  onClose,
}: {
  offerId: string
  finalPrice: number
  onClose: () => void
}) {
  const t = useTranslations('quickOffer')
  const tCommon = useTranslations('common')
  const { can } = useSubscriptionPlan()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!name.trim() || !phone.trim()) {
      setError(t('errorNamePhoneRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (can('save_offer_to_crm')) {
        const res = await authFetch(`/api/quick-offer/${offerId}/save-to-crm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: name, customerPhone: phone }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error ?? t('errorSaving'))
        }
      }

      const baseUrl =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'
      const offerUrl = `${baseUrl}/he/offers/${offerId}/approve`
      const formattedPhone = formatPhoneForWhatsApp(phone)
      const message = encodeURIComponent(
        `שלום ${name},\n\nהצעת המחיר שלך מוכנה!\n\nלצפייה בהצעה:\n${offerUrl}\n\n💰 סכום: ₪${finalPrice.toLocaleString('he-IL')}\n\nבברכה,\nPashkovsky Group`,
      )
      window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{t('whatsAppTitle')}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/60 text-sm">{t('whatsAppSubtitle')}</p>

        <div className="space-y-3">
          <Field label={t('fieldCustomerName')}>
            <input
              className={inputCls}
              placeholder={t('fieldCustomerNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t('fieldPhoneRequired')}>
            <input
              className={inputCls}
              placeholder={t('fieldPhonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 text-white hover:bg-green-400 disabled:opacity-60 transition-colors font-medium"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {t('btnSend')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Email Modal ──────────────────────────────────────────────────────────────

function EmailModal({
  offerId,
  customerName,
  onClose,
}: {
  offerId: string
  customerName?: string
  onClose: () => void
}) {
  const t = useTranslations('quickOffer')
  const tCommon = useTranslations('common')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSend() {
    if (!email.trim()) {
      setError(t('errorEmailRequired'))
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError(t('errorInvalidEmail'))
      return
    }
    setSending(true)
    setError(null)
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'
      const offerUrl = `${baseUrl}/he/offers/${offerId}/approve`
      const res = await authFetch(`/api/offers/${offerId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), offerUrl, customerName }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Failed to send email')
      }
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{t('emailTitle')}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/60 text-sm">{t('emailSubtitle')}</p>

        {success ? (
          <div className="flex items-center gap-2 text-green-400 font-medium py-2">
            <CheckCircle className="w-5 h-5" />
            {t('emailSent')}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <Field label={t('fieldEmail')}>
                <input
                  type="email"
                  className={inputCls}
                  placeholder={t('fieldEmailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                  autoFocus
                />
              </Field>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60 transition-colors font-medium"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {t('btnSend')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Result Screen ────────────────────────────────────────────────────────────

function ResultScreen({
  result,
  calculation,
  draft,
  onBack,
}: {
  result: QuickOfferResult
  calculation: ReturnType<typeof calculateOffer>
  draft: OfferDraft
  onBack: () => void
}) {
  const t = useTranslations('quickOffer')
  const tDeals = useTranslations('deals')
  const tSub = useTranslations('subscription')
  const { can } = useSubscriptionPlan()
  const { language } = useLanguage()
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [showSaveCrm, setShowSaveCrm] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [savedDealId, setSavedDealId] = useState<string | null>(null)
  const [offerSigned, setOfferSigned] = useState(false)

  const [configuratorEditUrl, setConfiguratorEditUrl] = useState<string | null>(null)
  const [configuratorLoading, setConfiguratorLoading] = useState(false)
  const [show3D, setShow3D] = useState(true)
  const configuratorRef = useRef<OfferConfiguratorEmbedHandle>(null)

  const resultProductKind = draft.quickProduct ?? 'pergola'

  useEffect(() => {
    if (savedDealId) return

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval>

    async function tick() {
      if (cancelled) return
      try {
        const res = await authFetch(`/api/offers/${result.offerId}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as Offer
        if (data.approval?.approved === true) {
          setOfferSigned(true)
          clearInterval(intervalId)
        }
      } catch {
        // ignore transient errors while polling
      }
    }

    void tick()
    intervalId = setInterval(tick, 8000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [result.offerId, savedDealId])

  useEffect(() => {
    if (resultProductKind !== 'pergola' || !show3D || configuratorEditUrl) return
    setConfiguratorLoading(true)
    authFetch(`/api/offers/${result.offerId}/configurator-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: language }),
    })
      .then((r) => r.json())
      .then((data: { url?: string }) => {
        if (data.url) setConfiguratorEditUrl(data.url)
      })
      .catch(() => {})
      .finally(() => setConfiguratorLoading(false))
  }, [resultProductKind, show3D, result.offerId, configuratorEditUrl, language])

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      // Auto-capture 3D screenshot and save it to the offer before generating PDF
      const screenshot = configuratorRef.current?.captureScreenshot()
      if (screenshot && screenshot.startsWith('data:image/')) {
        try {
          await authFetch(`/api/offers/${result.offerId}/screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ screenshot }),
          })
        } catch {
          // Non-fatal: proceed with PDF even if screenshot save fails
        }
      }

      const res = await authFetch(
        `/api/quick-offer/${result.offerId}/pdf?locale=${encodeURIComponent(language)}`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(`${t('errorCreating')}: ${d.error ?? res.statusText}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `offer-${result.offerId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      alert(`${t('errorCreating')}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const resultProductKind2 = draft.quickProduct ?? 'pergola'
  const resultPergolas = draft.pergolas?.length ? draft.pergolas : []

  const pergolaRows: Array<{ label: string; value: number }> =
    resultProductKind2 === 'pergola' && resultPergolas.length > 0
      ? resultPergolas.flatMap((p, i) => {
          if (!p?.shape) return []
          const area = calculatePergolaArea(p.shape)
          const price = area * p.pricePerSqm
          if (price <= 0) return []
          const label =
            resultPergolas.length > 1
              ? `${t('labelPergola')} #${i + 1} (${area.toFixed(2)} מ״ר)`
              : `${t('labelPergola')} (${area.toFixed(2)} מ״ר)`
          return [{ label, value: price }]
        })
      : []

  const priceRows = [
    ...(pergolaRows.length > 0
      ? pergolaRows
      : calculation.pergolaTotal != null && calculation.pergolaTotal > 0
        ? [{ label: t('labelPergola'), value: calculation.pergolaTotal }]
        : []),
    calculation.railingsLineTotal != null &&
      calculation.railingsLineTotal > 0 && {
        label: tDeals('workTypes.railings'),
        value: calculation.railingsLineTotal,
      },
    calculation.fenceLineTotal != null &&
      calculation.fenceLineTotal > 0 && {
        label: tDeals('workTypes.fence'),
        value: calculation.fenceLineTotal,
      },
    calculation.santafTotal > 0 && { label: t('labelSantaf'), value: calculation.santafTotal },
    calculation.zipScreenTotal > 0 && { label: t('labelZipScreen'), value: calculation.zipScreenTotal },
    calculation.lightingTotal > 0 && { label: t('labelLighting'), value: calculation.lightingTotal },
    calculation.drainageTotal > 0 && { label: t('labelDrainage'), value: calculation.drainageTotal },
    calculation.winterClosureTotal > 0 && { label: t('labelWinterClosure'), value: calculation.winterClosureTotal },
  ].filter(Boolean) as Array<{ label: string; value: number }>

  const offerSeed = useMemo(
    () => ({
      ...draft,
      ...calculation,
      id: result.offerId,
      pricing: calculation as never,
      paymentTerms: {} as never,
      warranty: {} as never,
      approval: {} as never,
      pdf: {} as never,
      createdAt: '',
      updatedAt: '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.offerId],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
        <div>
          <p className="font-semibold text-green-300">{t('successTitle')}</p>
          <p className="text-sm text-green-400/70">{t('successId', { id: result.offerId.slice(0, 8) })}...</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="w-full lg:flex-1 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Box className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-white">{t('section3D')}</span>
            </div>
            {resultProductKind === 'pergola' && (
              <button
                type="button"
                onClick={() => setShow3D((v) => !v)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                {configuratorLoading
                  ? <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                  : show3D
                    ? <ChevronUp className="w-4 h-4 text-white/50" />
                    : <ChevronDown className="w-4 h-4 text-white/50" />
                }
              </button>
            )}
          </div>
          {resultProductKind === 'pergola' && show3D && (
            <div className="relative h-[580px] rounded-b-xl overflow-hidden">
              {configuratorLoading ? (
                <div className="h-full flex items-center justify-center text-white/40">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  {t('loading3D')}
                </div>
              ) : (
                <OfferConfiguratorEmbed
                  ref={configuratorRef}
                  offerId={result.offerId}
                  locale={language as Locale}
                  editUrl={configuratorEditUrl}
                  offer={offerSeed}
                />
              )}
            </div>
          )}
          {resultProductKind !== 'pergola' && (
            <div className="px-5 py-12 text-center text-white/45 text-sm">{t('configuratorPergolaOnly')}</div>
          )}
        </div>

        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-white text-sm mb-2">{t('priceSummary')}</h3>
            {priceRows.map((row) => (
              <div key={row.label} className="flex justify-between text-xs">
                <span className="text-white/60">{row.label}</span>
                <span className="text-white">{formatPrice(row.value)}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 flex justify-between text-xs">
              <span className="text-white/60">{t('beforeVat')}</span>
              <span className="text-white">{formatPrice(calculation.totalBeforeVat)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/60">
                {t('vatPercentLabel', { pct: calculation.vatPercent })}
              </span>
              <span className="text-white">{formatPrice(calculation.vatAmount)}</span>
            </div>
            {calculation.discountAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-white/60">{t('discount', { pct: calculation.discountPercent })}</span>
                <span className="text-red-400">−{formatPrice(calculation.discountAmount)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
              <span className="text-white text-sm">{t('grandTotal')}</span>
              <span className="text-green-400 text-sm">{formatPrice(calculation.finalPrice)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t('btnDownloadPdf')}
            </button>

            <button
              onClick={() => setShowWhatsApp(true)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {t('btnSendWhatsApp')}
            </button>

            <button
              onClick={() => setShowEmail(true)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              {t('btnSendEmail')}
            </button>

            {can('save_offer_to_crm') ? (
              <button
                type="button"
                onClick={() => setShowSaveCrm(true)}
                disabled={savedDealId !== null}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {savedDealId
                  ? t('btnSavedCrm')
                  : offerSigned
                    ? t('btnConvertToDeal')
                    : t('btnSaveCrm')}
              </button>
            ) : (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-left">
                <div className="flex items-center gap-2 text-amber-200 text-sm font-medium">
                  <Lock className="w-4 h-4 shrink-0" aria-hidden />
                  {offerSigned ? t('btnConvertToDeal') : t('btnSaveCrm')}
                </div>
                <p className="text-[11px] text-amber-200/80 mt-1">
                  {tSub('availableInPlan', { plan: tSub(`planNames.${minPlanForFeature('save_offer_to_crm')}`) })}
                </p>
              </div>
            )}
          </div>

          {savedDealId && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between gap-2">
              <p className="text-purple-300 text-sm">{t('savedToCrm')}</p>
              {can('deals') ? (
                <Link
                  href="/app/admin/deals"
                  className="text-sm text-purple-400 hover:text-purple-300 underline shrink-0"
                >
                  {t('openDeals')}
                </Link>
              ) : (
                <span className="text-xs text-white/40 shrink-0">{tSub('lockedNavHint', { plan: tSub('planNames.pro') })}</span>
              )}
            </div>
          )}

          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('btnNewOffer')}
          </button>
        </div>
      </div>

      {showSaveCrm && (
        <SaveToCrmModal
          offerId={result.offerId}
          mode={offerSigned ? 'convert' : 'save'}
          onClose={() => setShowSaveCrm(false)}
          onSaved={(dId) => {
            setSavedDealId(dId)
            setShowSaveCrm(false)
          }}
        />
      )}
      {showWhatsApp && (
        <WhatsAppModal
          offerId={result.offerId}
          finalPrice={calculation.finalPrice}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
      {showEmail && (
        <EmailModal
          offerId={result.offerId}
          customerName={draft.customerName || undefined}
          onClose={() => setShowEmail(false)}
        />
      )}
    </div>
  )
}

// ─── Offer Form ───────────────────────────────────────────────────────────────

function buildDefaultDraft(): OfferDraft {
  return {
    dealId: '',
    customerName: 'הצעה מהירה',
    quickProduct: DEFAULT_OFFER_VALUES.quickProduct,
    quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
    quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
    pergolas: [{ ...DEFAULT_OFFER_VALUES.pergola }],
    color: { ...DEFAULT_OFFER_VALUES.color },
    roof: { ...DEFAULT_OFFER_VALUES.roof },
    shadingRatio: DEFAULT_OFFER_VALUES.shadingRatio,
    finishType: DEFAULT_OFFER_VALUES.finishType,
    finishValue: DEFAULT_OFFER_VALUES.finishValue,
    santaf: { ...DEFAULT_OFFER_VALUES.santaf },
    zipScreen: { ...DEFAULT_OFFER_VALUES.zipScreen },
    lighting: { ...DEFAULT_OFFER_VALUES.lighting },
    drainage: { ...DEFAULT_OFFER_VALUES.drainage },
    winterClosure: { ...DEFAULT_OFFER_VALUES.winterClosure },
    options: { ...DEFAULT_OFFER_VALUES.options },
    vatPercent: DEFAULT_OFFER_VALUES.vatPercent,
    discountPercent: 0,
    images: [],
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuickOfferPage() {
  const t = useTranslations('quickOffer')
  const tDeals = useTranslations('deals')
  const { language: uiLanguage } = useLanguage()
  const [step, setStep] = useState<Step>('form')
  const [draft, setDraft] = useState<OfferDraft>(buildDefaultDraft)
  const [result, setResult] = useState<QuickOfferResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [improvingAi, setImprovingAi] = useState(false)
  const [aiOutputLang, setAiOutputLang] = useState<OfferAiOutputLanguage>(() =>
    uiLanguageToAiDefault(uiLanguage),
  )

  useEffect(() => {
    setAiOutputLang(uiLanguageToAiDefault(uiLanguage))
  }, [uiLanguage])

  const calculation = useMemo(() => calculateOffer(draft), [draft])

  const productKind: QuickOfferProductType = draft.quickProduct ?? 'pergola'

  const pergolas: Pergola[] = draft.pergolas?.length ? draft.pergolas : [{ ...DEFAULT_OFFER_VALUES.pergola }]

  const pergolaRows: Array<{ label: string; value: number }> = useMemo(() => {
    if (productKind !== 'pergola' || pergolas.length === 0) return []
    return pergolas.flatMap((p, i) => {
      if (!p?.shape) return []
      const area = calculatePergolaArea(p.shape)
      const price = area * p.pricePerSqm
      if (price <= 0) return []
      const label =
        pergolas.length > 1
          ? `פרגולה #${i + 1} (${area.toFixed(2)} מ״ר)`
          : `פרגולה (${area.toFixed(2)} מ״ר)`
      return [{ label, value: price }]
    })
  }, [productKind, pergolas])

  function updatePergola(index: number, patch: Partial<Pergola>) {
    setDraft((d) => {
      const current = d.pergolas?.length ? d.pergolas : [{ ...DEFAULT_OFFER_VALUES.pergola }]
      const updated = [...current]
      updated[index] = { ...updated[index], ...patch }
      return { ...d, pergolas: updated }
    })
  }

  function addPergola() {
    setDraft((d) => {
      const current = d.pergolas?.length ? d.pergolas : [{ ...DEFAULT_OFFER_VALUES.pergola }]
      return { ...d, pergolas: [...current, { ...DEFAULT_OFFER_VALUES.pergola }] }
    })
  }

  function removePergola(index: number) {
    setDraft((d) => {
      const current = d.pergolas?.length ? d.pergolas : [{ ...DEFAULT_OFFER_VALUES.pergola }]
      const updated = current.filter((_, i) => i !== index)
      return { ...d, pergolas: updated.length > 0 ? updated : [{ ...DEFAULT_OFFER_VALUES.pergola }] }
    })
  }

  function patchQuickRailings(patch: Partial<NonNullable<OfferDraft['quickRailings']>>) {
    setDraft((d) => ({
      ...d,
      quickRailings: { ...(d.quickRailings ?? { ...DEFAULT_OFFER_VALUES.quickRailings }), ...patch },
    }))
  }

  function patchQuickFence(patch: Partial<NonNullable<OfferDraft['quickFence']>>) {
    setDraft((d) => ({
      ...d,
      quickFence: { ...(d.quickFence ?? { ...DEFAULT_OFFER_VALUES.quickFence }), ...patch },
    }))
  }

  const generateAiDescription = useCallback(async () => {
    setGeneratingAi(true)
    setError(null)
    try {
      const pk = draft.quickProduct ?? 'pergola'
      let base = ''
      if (pk === 'railings' && draft.quickRailings) {
        const qr = draft.quickRailings
        const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
        base = `הצעת מחיר למעקות אלומיניום:\n\n📐 שטח (מ״ר): ${sqm}\n📏 אורך: ${qr.metersTotal} מ׳ · גובה: ${qr.heightCm ?? '—'} ס״מ\nפרופיל: ${qr.profileType || '—'}\nצבע: ${qr.color || '—'}\n`
      } else if (pk === 'fence' && draft.quickFence) {
        const qf = draft.quickFence
        const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
        base = `הצעת מחיר לגדר:\n\n📐 שטח (מ״ר): ${sqm}\n📏 אורך: ${qf.metersTotal} מ׳ · גובה: ${qf.heightCm ?? '—'} ס״מ\nצבע: ${qf.color || '—'}\n`
      } else {
        base = `הצעת מחיר לפרגולת אלומיניום מתקדמת:\n\n📐 שטח: ${calculation.area} מ"ר\n`
      }
      const features: string[] = []
      if (pk === 'pergola' && draft.santaf.enabled)
        features.push(`סנטף BH ${draft.santaf.withStructure ? 'עם קונסטרוקציה' : 'בסיסי'}`)
      if (draft.zipScreen.enabled) features.push(`מסך ZIP ${draft.zipScreen.type === 'electric' ? 'חשמלי' : 'ידני'}`)
      if (draft.lighting.enabled) features.push('תאורת לד משולבת')
      if (draft.drainage.enabled) features.push('מערכת ניקוז')
      if (draft.winterClosure.enabled) features.push('סגירת זכוכיות')
      if (features.length > 0) base += `\n✨ תוספות:\n${features.map((f) => `• ${f}`).join('\n')}\n`
      base += `\n💰 מחיר סופי: ${formatPrice(calculation.finalPrice)}`
      if (draft.discountPercent > 0) base += ` (כולל ${draft.discountPercent}% הנחה!)`

      const res = await authFetch('/api/ai/improve-offer-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: base,
          outputLanguage: aiOutputLang,
          context: { customerName: 'לקוח', pergolaType: 'אלומיניום', price: calculation.finalPrice },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? t('errorGenerating'))
      }
      const data = await res.json()
      setDraft((d) => ({ ...d, options: { notes: data.improvedText } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGeneratingAi(false)
    }
  }, [draft, calculation, t, aiOutputLang])

  const improveAiText = useCallback(async () => {
    const currentNotes = draft.options?.notes?.trim()
    if (!currentNotes) return
    setImprovingAi(true)
    setError(null)
    try {
      const res = await authFetch('/api/ai/improve-offer-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentNotes,
          outputLanguage: aiOutputLang,
          context: { customerName: 'לקוח', pergolaType: 'אלומיניום', price: calculation.finalPrice },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? t('errorImproving'))
      }
      const data = await res.json()
      setDraft((d) => ({ ...d, options: { notes: data.improvedText } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImprovingAi(false)
    }
  }, [draft.options?.notes, calculation.finalPrice, t, aiOutputLang])

  const handleSubmit = useCallback(async () => {
    const pk = draft.quickProduct ?? 'pergola'
    if (pk === 'railings' && draft.quickRailings) {
      const qr = draft.quickRailings
      if (!qr.metersTotal || qr.metersTotal <= 0) {
        setError(t('errorRailingsMeters'))
        return
      }
      if (qr.heightCm == null || qr.heightCm <= 0) {
        setError(t('errorRailingsHeight'))
        return
      }
      if (!qr.profileType?.trim() || !qr.color?.trim() || !qr.locationType) {
        setError(t('errorRailingsFields'))
        return
      }
      const gs = String(qr.glazingSystem ?? '').trim()
      if (!['aluminum_glass', 'wet_glazing', 'dry_glazing'].includes(gs)) {
        setError(t('errorRailingsGlazing'))
        return
      }
    }
    if (pk === 'fence' && draft.quickFence) {
      const qf = draft.quickFence
      if (!qf.metersTotal || qf.metersTotal <= 0) {
        setError(t('errorFenceMeters'))
        return
      }
      if (qf.heightCm == null || qf.heightCm <= 0) {
        setError(t('errorFenceHeight'))
        return
      }
      if (!qf.color?.trim()) {
        setError(t('errorFenceColor'))
        return
      }
      const fv = String(qf.fenceVariant ?? '').trim()
      if (!['classic', 'hitech', 'hitech_angular'].includes(fv)) {
        setError(t('errorFenceVariant'))
        return
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      const body = { ...draft, ...calculation }
      const res = await authFetch('/api/quick-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? t('errorCreating'))
      }
      const data = (await res.json()) as QuickOfferResult
      setResult(data)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }, [draft, calculation, t])

  function handleBack() {
    setStep('form')
    setResult(null)
    setDraft(buildDefaultDraft())
    setError(null)
  }

  const colorOptions = [
    { v: 'white' as const, l: t('colorWhite') },
    { v: 'black' as const, l: t('colorBlack') },
    { v: 'cream' as const, l: t('colorCream') },
    { v: 'ral' as const, l: t('colorRal') },
  ]

  const zipTypeOptions = [
    { v: 'manual' as const, l: t('typeManual') },
    { v: 'electric' as const, l: t('typeElectric') },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white" dir="rtl">
      <div className={`mx-auto px-4 py-8 space-y-6 ${step === 'result' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="flex items-center gap-4">
          <Link
            href="/app/admin"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-white/50 text-sm">{t('subtitle')}</p>
          </div>
        </div>

        {step === 'result' && result ? (
          <ResultScreen result={result} calculation={calculation} draft={draft} onBack={handleBack} />
        ) : (
          <div className="space-y-4">
            <SectionCard title={t('sectionProductType')} defaultOpen>
              <Field label={t('fieldProductKind')}>
                <div className="flex flex-wrap gap-2">
                  {(['pergola', 'railings', 'fence'] as const).map((pk) => (
                    <button
                      key={pk}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, quickProduct: pk }))}
                      className={toggleCls(productKind === pk)}
                    >
                      {pk === 'pergola'
                        ? tDeals('workTypes.pergola')
                        : pk === 'railings'
                          ? tDeals('workTypes.railings')
                          : tDeals('workTypes.fence')}
                    </button>
                  ))}
                </div>
              </Field>
            </SectionCard>

            {productKind === 'pergola' && (
              <div className="space-y-3">
                {pergolas.map((pergola, index) => (
                  <SectionCard
                    key={index}
                    title={pergolas.length > 1 ? `${t('sectionPergola')} #${index + 1}` : t('sectionPergola')}
                  >
                    {pergolas.length > 1 && (
                      <div className="flex justify-end mb-2">
                        <button
                          type="button"
                          onClick={() => removePergola(index)}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600/80 hover:bg-red-600 text-white rounded transition"
                        >
                          <X className="w-3 h-3" />
                          הסר
                        </button>
                      </div>
                    )}

                    <Field label={t('fieldPergolaType')}>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(PERGOLA_TYPE_NAMES) as PergolaProductType[]).map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() =>
                              updatePergola(index, { pergolaType: pt, pricePerSqm: PERGOLA_TYPE_DEFAULT_PRICES[pt] })
                            }
                            className={toggleCls(pergola.pergolaType === pt)}
                          >
                            {tDeals(pt === 'fixed' ? 'pergolaFixed' : pt === 'electricPvc' ? 'pergolaElectricPvc' : 'pergolaElectricBioclimatic')}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label={t('fieldShapeDimensions')}>
                      <PergolaShapeSelector
                        value={pergola.shape}
                        onChange={(shape) => updatePergola(index, { shape })}
                      />
                    </Field>

                    <Field label={t('fieldPricePerSqm')}>
                      <input
                        type="number"
                        className={inputCls}
                        value={pergola.pricePerSqm}
                        onChange={(e) => updatePergola(index, { pricePerSqm: Number(e.target.value) || 0 })}
                      />
                    </Field>

                    <Field label={t('fieldLocation')}>
                      <input
                        className={inputCls}
                        placeholder={t('fieldLocationPlaceholder')}
                        value={pergola.location ?? ''}
                        onChange={(e) => updatePergola(index, { location: e.target.value })}
                      />
                    </Field>
                  </SectionCard>
                ))}

                <button
                  type="button"
                  onClick={addPergola}
                  className="w-full py-2 border border-dashed border-white/30 hover:border-blue-400 text-white/60 hover:text-blue-400 rounded-xl text-sm transition"
                >
                  + הוסף פרגולה נוספת
                </button>
              </div>
            )}

            {productKind === 'railings' && draft.quickRailings && (
              <SectionCard title={tDeals('railingsDetails')}>
                <Field label={tDeals('metersTotal')}>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className={inputCls}
                    value={draft.quickRailings.metersTotal || ''}
                    onChange={(e) =>
                      patchQuickRailings({ metersTotal: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label={tDeals('heightCm')}>
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    placeholder="120"
                    value={draft.quickRailings.heightCm ?? ''}
                    onChange={(e) =>
                      patchQuickRailings({
                        heightCm: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </Field>
                <p className="text-xs text-white/50">
                  {t('computedAreaSqm', {
                    area: quickOfferRailingsFenceAreaSqm(
                      draft.quickRailings.metersTotal,
                      draft.quickRailings.heightCm,
                    ).toFixed(2),
                  })}
                </p>
                <Field label={tDeals('profileType')}>
                  <input
                    className={inputCls}
                    placeholder={tDeals('railingProfilePlaceholder')}
                    value={draft.quickRailings.profileType}
                    onChange={(e) => patchQuickRailings({ profileType: e.target.value })}
                  />
                </Field>
                <Field label={tDeals('color')}>
                  <input
                    className={inputCls}
                    value={draft.quickRailings.color}
                    onChange={(e) => patchQuickRailings({ color: e.target.value })}
                  />
                </Field>
                <Field label={tDeals('locationType')}>
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={draft.quickRailings.locationType}
                    onChange={(e) =>
                      patchQuickRailings({
                        locationType: e.target.value as QuickOfferRailingsLocation,
                      })
                    }
                  >
                    <option value="balcony">{tDeals('locationTypes.balcony')}</option>
                    <option value="stairs">{tDeals('locationTypes.stairs')}</option>
                    <option value="roof">{tDeals('locationTypes.roof')}</option>
                    <option value="yard">{tDeals('locationTypes.yard')}</option>
                    <option value="other">{tDeals('locationTypes.other')}</option>
                  </select>
                </Field>
                <Field label={tDeals('glazingSystem')}>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['aluminum_glass', 'glazingAluminumGlass'],
                        ['wet_glazing', 'glazingWet'],
                        ['dry_glazing', 'glazingDry'],
                      ] as const
                    ).map(([v, msgKey]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => patchQuickRailings({ glazingSystem: v as QuickOfferGlazingSystem })}
                        className={toggleCls(draft.quickRailings!.glazingSystem === v)}
                      >
                        {tDeals(msgKey)}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={tDeals('glassType')}>
                  <input
                    className={inputCls}
                    value={draft.quickRailings.glassType ?? ''}
                    onChange={(e) => patchQuickRailings({ glassType: e.target.value })}
                  />
                </Field>
                <Field label={t('fieldPricePerSqm')}>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.quickRailings.pricePerSqm}
                    onChange={(e) =>
                      patchQuickRailings({ pricePerSqm: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label={tDeals('notes')}>
                  <input
                    className={inputCls}
                    placeholder={tDeals('notes')}
                    value={draft.quickRailings.notes ?? ''}
                    onChange={(e) => patchQuickRailings({ notes: e.target.value })}
                  />
                </Field>
              </SectionCard>
            )}

            {productKind === 'fence' && draft.quickFence && (
              <SectionCard title={tDeals('fenceDetails')}>
                <Field label={tDeals('metersTotal')}>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className={inputCls}
                    value={draft.quickFence.metersTotal || ''}
                    onChange={(e) => patchQuickFence({ metersTotal: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label={tDeals('heightCm')}>
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    placeholder="120"
                    value={draft.quickFence.heightCm ?? ''}
                    onChange={(e) =>
                      patchQuickFence({
                        heightCm: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </Field>
                <p className="text-xs text-white/50">
                  {t('computedAreaSqm', {
                    area: quickOfferRailingsFenceAreaSqm(
                      draft.quickFence.metersTotal,
                      draft.quickFence.heightCm,
                    ).toFixed(2),
                  })}
                </p>
                <Field label={tDeals('fenceVariant')}>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['classic', 'fenceClassic'],
                        ['hitech', 'fenceHitech'],
                        ['hitech_angular', 'fenceHitechAngular'],
                      ] as const
                    ).map(([v, msgKey]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => patchQuickFence({ fenceVariant: v as QuickOfferFenceVariant })}
                        className={toggleCls(draft.quickFence!.fenceVariant === v)}
                      >
                        {tDeals(msgKey)}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={tDeals('color')}>
                  <input
                    className={inputCls}
                    value={draft.quickFence.color}
                    onChange={(e) => patchQuickFence({ color: e.target.value })}
                  />
                </Field>
                <Field label={t('fieldPricePerSqm')}>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.quickFence.pricePerSqm}
                    onChange={(e) =>
                      patchQuickFence({ pricePerSqm: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label={tDeals('notes')}>
                  <input
                    className={inputCls}
                    placeholder={tDeals('notes')}
                    value={draft.quickFence.notes ?? ''}
                    onChange={(e) => patchQuickFence({ notes: e.target.value })}
                  />
                </Field>
              </SectionCard>
            )}

            {/* Color */}
            {productKind === 'pergola' && (
            <SectionCard title={t('sectionColor')} defaultOpen={false}>
              <Field label={t('fieldColorType')}>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(({ v, l }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, color: { ...d.color, type: v } }))}
                      className={toggleCls(draft.color.type === v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              {draft.color.type === 'ral' && (
                <Field label={t('fieldRalCode')}>
                  <input
                    className={inputCls}
                    placeholder="9006"
                    value={draft.color.ralCode ?? ''}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, color: { ...d.color, ralCode: e.target.value } }))
                    }
                  />
                </Field>
              )}
            </SectionCard>
            )}

            {/* Santaf */}
            {productKind === 'pergola' && (
            <SectionCard title={t('sectionSantaf')} defaultOpen={false}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="santaf-enabled"
                  checked={draft.santaf.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, santaf: { ...d.santaf, enabled: e.target.checked } }))
                  }
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="santaf-enabled" className="text-white">
                  {t('includeSantaf')}
                </label>
              </div>
              {draft.santaf.enabled && (
                <>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="santaf-struct"
                      checked={draft.santaf.withStructure}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          santaf: { ...d.santaf, withStructure: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 accent-blue-500"
                    />
                    <label htmlFor="santaf-struct" className="text-white text-sm">
                      {t('withStructure')}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('fieldBasicPrice')}>
                      <input
                        type="number"
                        className={inputCls}
                        value={draft.santaf.pricePerSqmBasic}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            santaf: { ...d.santaf, pricePerSqmBasic: Number(e.target.value) || 0 },
                          }))
                        }
                      />
                    </Field>
                    <Field label={t('fieldWithStructurePrice')}>
                      <input
                        type="number"
                        className={inputCls}
                        value={draft.santaf.pricePerSqmWithStructure}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            santaf: {
                              ...d.santaf,
                              pricePerSqmWithStructure: Number(e.target.value) || 0,
                            },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </>
              )}
            </SectionCard>
            )}

            {/* ZIP Screen */}
            <SectionCard title={t('sectionZipScreen')} defaultOpen={false}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="zip-enabled"
                  checked={draft.zipScreen.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      zipScreen: { ...d.zipScreen, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="zip-enabled" className="text-white">
                  {t('includeZipScreen')}
                </label>
              </div>
              {draft.zipScreen.enabled && (
                <>
                  <Field label={t('fieldType')}>
                    <div className="flex gap-2">
                      {zipTypeOptions.map(({ v, l }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, zipScreen: { ...d.zipScreen, type: v } }))
                          }
                          className={toggleCls(draft.zipScreen.type === v)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('fieldManualPrice')}>
                      <input
                        type="number"
                        className={inputCls}
                        value={draft.zipScreen.pricePerSqmManual}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            zipScreen: { ...d.zipScreen, pricePerSqmManual: Number(e.target.value) || 0 },
                          }))
                        }
                      />
                    </Field>
                    <Field label={t('fieldElectricPrice')}>
                      <input
                        type="number"
                        className={inputCls}
                        value={draft.zipScreen.pricePerSqmElectric}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            zipScreen: { ...d.zipScreen, pricePerSqmElectric: Number(e.target.value) || 0 },
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label={t('fieldRunningMeters')}>
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="0"
                      value={draft.zipScreen.runningMeters ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          zipScreen: {
                            ...d.zipScreen,
                            runningMeters: e.target.value ? Number(e.target.value) : undefined,
                          },
                        }))
                      }
                    />
                  </Field>
                </>
              )}
            </SectionCard>

            {/* Lighting */}
            <SectionCard title={t('sectionLighting')} defaultOpen={false}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="light-enabled"
                  checked={draft.lighting.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      lighting: { ...d.lighting, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="light-enabled" className="text-white">
                  {t('includeLighting')}
                </label>
              </div>
              {draft.lighting.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('fieldPricePerMeter')}>
                    <input
                      type="number"
                      className={inputCls}
                      value={draft.lighting.pricePerMeter}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          lighting: { ...d.lighting, pricePerMeter: Number(e.target.value) || 0 },
                        }))
                      }
                    />
                  </Field>
                  <Field label={t('fieldRunningMeters')}>
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="0"
                      value={draft.lighting.runningMeters ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          lighting: {
                            ...d.lighting,
                            runningMeters: e.target.value ? Number(e.target.value) : undefined,
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
              )}
            </SectionCard>

            {/* Drainage */}
            <SectionCard title={t('sectionDrainage')} defaultOpen={false}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="drain-enabled"
                  checked={draft.drainage.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      drainage: { ...d.drainage, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="drain-enabled" className="text-white">
                  {t('includeDrainage')}
                </label>
              </div>
              {draft.drainage.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('fieldPricePerMeter')}>
                    <input
                      type="number"
                      className={inputCls}
                      value={draft.drainage.pricePerMeter}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          drainage: { ...d.drainage, pricePerMeter: Number(e.target.value) || 0 },
                        }))
                      }
                    />
                  </Field>
                  <Field label={t('fieldRunningMeters')}>
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="0"
                      value={draft.drainage.runningMeters ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          drainage: {
                            ...d.drainage,
                            runningMeters: e.target.value ? Number(e.target.value) : undefined,
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
              )}
            </SectionCard>

            {/* Winter Closure */}
            <SectionCard title={t('sectionWinterClosure')} defaultOpen={false}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="winter-enabled"
                  checked={draft.winterClosure.enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    setDraft((d) => ({
                      ...d,
                      winterClosure: {
                        ...d.winterClosure,
                        enabled,
                        items:
                          enabled && d.winterClosure.items.length === 0
                            ? [{ type: 'fixedGlass' as const, area: 0, pricePerSqm: 750, notes: '' }]
                            : d.winterClosure.items,
                      },
                    }))
                  }}
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="winter-enabled" className="text-white">
                  {t('includeWinterClosure')}
                </label>
              </div>

              {draft.winterClosure.enabled && (
                <div className="space-y-4">
                  {draft.winterClosure.items.map((item, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white/80">{t('closureItem', { n: index + 1 })}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              winterClosure: {
                                ...d.winterClosure,
                                items: d.winterClosure.items.filter((_, i) => i !== index),
                              },
                            }))
                          }
                          className="text-red-400 hover:text-red-300 text-sm transition-colors"
                        >
                          {t('removeItem')}
                        </button>
                      </div>

                      <Field label={t('fieldClosureType')}>
                        <select
                          value={item.type}
                          onChange={(e) => {
                            const type = e.target.value as WinterClosureItem['type']
                            const prices: Record<string, number> = {
                              fixedGlass: 750,
                              windows7000: 950,
                              windows9000: 1050,
                              slidingShowcase7000: 1200,
                              slidingShowcase9000: 1800,
                              sliderGlass: 1650,
                              foldingGlass: 0,
                            }
                            setDraft((d) => {
                              const items = [...d.winterClosure.items]
                              items[index] = { ...item, type, pricePerSqm: prices[type] ?? item.pricePerSqm }
                              return { ...d, winterClosure: { ...d.winterClosure, items } }
                            })
                          }}
                          className={`${inputCls} cursor-pointer`}
                        >
                          <option value="fixedGlass">{t('closureFixedGlass')}</option>
                          <option value="windows7000">{t('closureWindows7000')}</option>
                          <option value="windows9000">{t('closureWindows9000')}</option>
                          <option value="slidingShowcase7000">{t('closureSlidingShowcase7000')}</option>
                          <option value="slidingShowcase9000">{t('closureSlidingShowcase9000')}</option>
                          <option value="sliderGlass">{t('closureSliderGlass')}</option>
                          <option value="foldingGlass">{t('closureFoldingGlass')}</option>
                        </select>
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t('fieldArea')}>
                          <input
                            type="number"
                            className={inputCls}
                            placeholder="0"
                            min={0}
                            step={0.1}
                            value={item.area || ''}
                            onChange={(e) =>
                              setDraft((d) => {
                                const items = [...d.winterClosure.items]
                                items[index] = { ...item, area: parseFloat(e.target.value) || 0 }
                                return { ...d, winterClosure: { ...d.winterClosure, items } }
                              })
                            }
                          />
                        </Field>
                        <Field label={t('fieldPricePerSqmShort')}>
                          <input
                            type="number"
                            className={inputCls}
                            min={0}
                            step={10}
                            value={item.pricePerSqm || ''}
                            onChange={(e) =>
                              setDraft((d) => {
                                const items = [...d.winterClosure.items]
                                items[index] = { ...item, pricePerSqm: parseFloat(e.target.value) || 0 }
                                return { ...d, winterClosure: { ...d.winterClosure, items } }
                              })
                            }
                          />
                        </Field>
                      </div>

                      <Field label={t('fieldClosureNotes')}>
                        <input
                          className={inputCls}
                          placeholder={t('fieldClosureNotesPlaceholder')}
                          value={item.notes ?? ''}
                          onChange={(e) =>
                            setDraft((d) => {
                              const items = [...d.winterClosure.items]
                              items[index] = { ...item, notes: e.target.value }
                              return { ...d, winterClosure: { ...d.winterClosure, items } }
                            })
                          }
                        />
                      </Field>

                      {item.area > 0 && item.pricePerSqm > 0 && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                          <span className="text-sm text-white/60">{t('closureSubtotal')}</span>
                          <span className="font-bold text-green-400">
                            {(item.area * item.pricePerSqm).toLocaleString('he-IL')} ₪
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        winterClosure: {
                          ...d.winterClosure,
                          items: [
                            ...d.winterClosure.items,
                            { type: 'fixedGlass' as const, area: 0, pricePerSqm: 750, notes: '' },
                          ],
                        },
                      }))
                    }
                    className="w-full py-2 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 text-blue-300 text-sm font-medium transition-colors"
                  >
                    {t('addMoreClosure')}
                  </button>

                  {draft.winterClosure.items.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex justify-between items-center">
                      <span className="text-sm text-white/60">{t('closureTotal')}</span>
                      <span className="font-bold text-blue-400">
                        {draft.winterClosure.items
                          .reduce((sum, it) => sum + it.area * it.pricePerSqm, 0)
                          .toLocaleString('he-IL')}{' '}
                        ₪
                      </span>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Notes + AI */}
            <SectionCard title={t('sectionNotes')} defaultOpen={false}>
              {!draft.options?.notes && (
                <div className="p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-400/30 rounded-lg flex items-start gap-2">
                  <span className="text-xl shrink-0">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-300 mb-0.5">{t('aiHintTitle')}</p>
                    <p className="text-xs text-white/60">{t('aiHintBody')}</p>
                  </div>
                </div>
              )}

              <Field label={t('aiOutputLanguage')}>
                <select
                  className={inputCls}
                  value={aiOutputLang}
                  onChange={(e) => setAiOutputLang(e.target.value as OfferAiOutputLanguage)}
                  dir="ltr"
                >
                  <option value="en">{t('langEn')}</option>
                  <option value="ru">{t('langRu')}</option>
                  <option value="sr">{t('langSr')}</option>
                  <option value="he">{t('langHe')}</option>
                </select>
              </Field>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generateAiDescription}
                  disabled={generatingAi || improvingAi}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60 text-white font-medium text-sm transition-all"
                >
                  {generatingAi ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t('generating')}</>
                  ) : (
                    t('btnGenerateAi')
                  )}
                </button>
                <button
                  type="button"
                  onClick={improveAiText}
                  disabled={improvingAi || generatingAi || !draft.options?.notes?.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-sm transition-all"
                >
                  {improvingAi ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t('improving')}</>
                  ) : (
                    t('btnImproveAi')
                  )}
                </button>
              </div>

              <Field label={t('fieldOfferText')}>
                <textarea
                  className={`${inputCls} min-h-[100px] resize-y`}
                  placeholder={t('offerTextPlaceholder')}
                  value={draft.options?.notes ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, options: { notes: e.target.value } }))
                  }
                />
              </Field>
            </SectionCard>

            {/* Live price summary — VAT % and discount always visible (quick offer) */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                {t('priceSummary')}
              </div>

              {/* Full line-item breakdown */}
              {(() => {
                const rows: Array<{ label: string; value: number }> = []
                if (pergolaRows.length === 1) {
                  rows.push(...pergolaRows)
                } else if (pergolaRows.length > 1) {
                  rows.push(...pergolaRows)
                  rows.push({ label: `${t('labelPergola')} סה״כ`, value: pergolaRows.reduce((s, r) => s + r.value, 0) })
                }
                if (calculation.santafTotal > 0) rows.push({ label: t('labelSantaf'), value: calculation.santafTotal })
                if (calculation.zipScreenTotal > 0) rows.push({ label: t('labelZipScreen'), value: calculation.zipScreenTotal })
                if (calculation.lightingTotal > 0) rows.push({ label: t('labelLighting'), value: calculation.lightingTotal })
                if (calculation.drainageTotal > 0) rows.push({ label: t('labelDrainage'), value: calculation.drainageTotal })
                if (calculation.winterClosureTotal > 0) rows.push({ label: t('labelWinterClosure'), value: calculation.winterClosureTotal })
                if (calculation.railingsLineTotal != null && calculation.railingsLineTotal > 0) rows.push({ label: tDeals('workTypes.railings'), value: calculation.railingsLineTotal })
                if (calculation.fenceLineTotal != null && calculation.fenceLineTotal > 0) rows.push({ label: tDeals('workTypes.fence'), value: calculation.fenceLineTotal })
                if (rows.length === 0) return null
                return (
                  <div className="space-y-1 border-b border-white/10 pb-2">
                    {rows.map((row, i) => (
                      <div
                        key={i}
                        className={`flex justify-between text-xs ${row.label.includes('סה״כ') ? 'text-white/70 font-medium pt-0.5' : 'text-white/60'}`}
                      >
                        <span>{row.label}</span>
                        <span className="tabular-nums text-white/80">{formatPrice(row.value)}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="flex justify-between text-sm text-white/70">
                <span>{t('beforeVat')}</span>
                <span className="text-white tabular-nums">{formatPrice(calculation.totalBeforeVat)}</span>
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
                <span className="text-white/70">{t('fieldVatPercent')}</span>
                <div className="flex items-center gap-2 ms-auto">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    dir="ltr"
                    className={`${inputCls} w-[5.5rem] py-1.5 text-center shrink-0`}
                    value={draft.vatPercent}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setDraft((d) => ({
                        ...d,
                        vatPercent: Number.isFinite(v)
                          ? Math.min(100, Math.max(0, v))
                          : DEFAULT_OFFER_VALUES.vatPercent,
                      }))
                    }}
                  />
                  <span className="text-white tabular-nums whitespace-nowrap">
                    +{formatPrice(calculation.vatAmount)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm text-white/80">
                <span>{t('afterVat')}</span>
                <span className="text-white tabular-nums font-medium">
                  {formatPrice(calculation.priceWithVat)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
                <span className="text-white/70">{t('fieldDiscount')}</span>
                <div className="flex items-center gap-2 ms-auto">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    dir="ltr"
                    className={`${inputCls} w-[5.5rem] py-1.5 text-center shrink-0`}
                    value={draft.discountPercent}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, discountPercent: Number(e.target.value) || 0 }))
                    }
                  />
                  {draft.discountPercent > 0 ? (
                    <span className="text-red-400 tabular-nums whitespace-nowrap">
                      −{formatPrice(calculation.discountAmount)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between items-center gap-2">
                <span className="text-white/80 font-medium">{t('totalToPay')}</span>
                <span className="text-2xl font-bold text-green-400 tabular-nums">
                  {formatPrice(calculation.finalPrice)}
                </span>
              </div>
              {calculation.discountAmount > 0 ? (
                <p className="text-xs text-white/40 text-left">
                  {t('beforeDiscount', { price: formatPrice(calculation.priceWithVat) })}
                </p>
              ) : null}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-lg transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('creatingOffer')}
                </>
              ) : (
                t('btnCreateOffer')
              )}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
