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
} from 'lucide-react'
import type { OfferDraft, Pergola, PergolaProductType, WinterClosureItem } from '@/types/offer'
import {
  DEFAULT_OFFER_VALUES,
  PERGOLA_TYPE_NAMES,
  PERGOLA_TYPE_DEFAULT_PRICES,
} from '@/types/offer'
import { calculateOffer, formatPrice } from '@/lib/offer-calculator'
import { PergolaShapeSelector } from '@/components/offers/PergolaShapeSelector'
import { authFetch } from '@/lib/api/auth-fetch'
import { formatPhoneForWhatsApp } from '@/lib/offer-sharing'
import { OfferConfiguratorEmbed, type OfferConfiguratorEmbedHandle } from '@/components/offers/OfferConfiguratorEmbed'

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
  onClose,
  onSaved,
}: {
  offerId: string
  onClose: () => void
  onSaved: (dealId: string) => void
}) {
  const t = useTranslations('quickOffer')
  const tCommon = useTranslations('common')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{t('saveCrmTitle')}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/60 text-sm">{t('saveCrmSubtitle')}</p>

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
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
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
      const res = await authFetch(`/api/quick-offer/${offerId}/save-to-crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name, customerPhone: phone }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? t('errorSaving'))
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
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [showSaveCrm, setShowSaveCrm] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [savedDealId, setSavedDealId] = useState<string | null>(null)

  const [configuratorEditUrl, setConfiguratorEditUrl] = useState<string | null>(null)
  const [configuratorLoading, setConfiguratorLoading] = useState(false)
  const [show3D, setShow3D] = useState(true)
  const configuratorRef = useRef<OfferConfiguratorEmbedHandle>(null)

  useEffect(() => {
    if (!show3D || configuratorEditUrl) return
    setConfiguratorLoading(true)
    authFetch(`/api/offers/${result.offerId}/configurator-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'he' }),
    })
      .then((r) => r.json())
      .then((data: { url?: string }) => {
        if (data.url) setConfiguratorEditUrl(data.url)
      })
      .catch(() => {})
      .finally(() => setConfiguratorLoading(false))
  }, [show3D, result.offerId, configuratorEditUrl])

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

      const res = await authFetch(`/api/quick-offer/${result.offerId}/pdf`, { method: 'POST' })
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

  const priceRows = [
    calculation.pergolaTotal != null && { label: t('labelPergola'), value: calculation.pergolaTotal },
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
          </div>
          {show3D && (
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
                  locale="he"
                  editUrl={configuratorEditUrl}
                  offer={offerSeed}
                />
              )}
            </div>
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
              <span className="text-white/60">{t('vat18')}</span>
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

            <button
              onClick={() => setShowSaveCrm(true)}
              disabled={savedDealId !== null}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {savedDealId ? t('btnSavedCrm') : t('btnSaveCrm')}
            </button>
          </div>

          {savedDealId && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between">
              <p className="text-purple-300 text-sm">{t('savedToCrm')}</p>
              <Link
                href="/app/admin/deals"
                className="text-sm text-purple-400 hover:text-purple-300 underline"
              >
                {t('openDeals')}
              </Link>
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
    discountPercent: 0,
    images: [],
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuickOfferPage() {
  const t = useTranslations('quickOffer')
  const tDeals = useTranslations('deals')
  const [step, setStep] = useState<Step>('form')
  const [draft, setDraft] = useState<OfferDraft>(buildDefaultDraft)
  const [result, setResult] = useState<QuickOfferResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [improvingAi, setImprovingAi] = useState(false)

  const calculation = useMemo(() => calculateOffer(draft), [draft])

  const pergola: Pergola = draft.pergolas?.[0] ?? { ...DEFAULT_OFFER_VALUES.pergola }

  function updatePergola(patch: Partial<Pergola>) {
    setDraft((d) => ({
      ...d,
      pergolas: [{ ...(d.pergolas?.[0] ?? DEFAULT_OFFER_VALUES.pergola), ...patch }],
    }))
  }

  const generateAiDescription = useCallback(async () => {
    setGeneratingAi(true)
    setError(null)
    try {
      let base = `הצעת מחיר לפרגולת אלומיניום מתקדמת:\n\n`
      base += `📐 שטח: ${calculation.area} מ"ר\n`
      const features: string[] = []
      if (draft.santaf.enabled) features.push(`סנטף BH ${draft.santaf.withStructure ? 'עם קונסטרוקציה' : 'בסיסי'}`)
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
  }, [draft, calculation, t])

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
  }, [draft.options?.notes, calculation.finalPrice, t])

  const handleSubmit = useCallback(async () => {
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
            {/* Pergola */}
            <SectionCard title={t('sectionPergola')}>
              <Field label={t('fieldPergolaType')}>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PERGOLA_TYPE_NAMES) as PergolaProductType[]).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() =>
                        updatePergola({ pergolaType: pt, pricePerSqm: PERGOLA_TYPE_DEFAULT_PRICES[pt] })
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
                  onChange={(shape) => updatePergola({ shape })}
                />
              </Field>

              <Field label={t('fieldPricePerSqm')}>
                <input
                  type="number"
                  className={inputCls}
                  value={pergola.pricePerSqm}
                  onChange={(e) => updatePergola({ pricePerSqm: Number(e.target.value) || 0 })}
                />
              </Field>

              <Field label={t('fieldLocation')}>
                <input
                  className={inputCls}
                  placeholder={t('fieldLocationPlaceholder')}
                  value={pergola.location ?? ''}
                  onChange={(e) => updatePergola({ location: e.target.value })}
                />
              </Field>
            </SectionCard>

            {/* Color */}
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

            {/* Santaf */}
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

            {/* Discount */}
            <SectionCard title={t('sectionDiscount')} defaultOpen={false}>
              <Field label={t('fieldDiscount')}>
                <input
                  type="number"
                  className={inputCls}
                  min={0}
                  max={100}
                  value={draft.discountPercent}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, discountPercent: Number(e.target.value) || 0 }))
                  }
                />
              </Field>
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

            {/* Live price summary */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex justify-between items-center">
                <span className="text-white/60">{t('totalToPay')}</span>
                <span className="text-2xl font-bold text-green-400">
                  {formatPrice(calculation.finalPrice)}
                </span>
              </div>
              {calculation.discountAmount > 0 && (
                <p className="text-sm text-white/40 mt-1 text-left">
                  {t('beforeDiscount', { price: formatPrice(calculation.priceWithVat) })}
                </p>
              )}
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
