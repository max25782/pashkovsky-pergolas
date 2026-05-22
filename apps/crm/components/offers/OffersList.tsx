"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePriceFormatter } from '@/lib/use-price-formatter'
import type { Offer } from '@/types/offer'
import { PERGOLA_TYPE_NAMES } from '@/types/offer'
import {
  FileText,
  Check,
  Clock,
  FileDown,
  MessageCircle,
  Mail,
  Trash2,
  Box,
  Copy,
  Building2,
  Lock,
} from 'lucide-react'
import { getOfferPublicUrl } from '@/lib/offer-sharing'
import type { Locale } from '@/lib/locales'
import { authFetch } from '@/lib/api/auth-fetch'
import { useLanguage } from '@/lib/language-context'
import { useToast } from '@/components/ui/toast'
import { OfferConfiguratorEmbed } from '@/components/offers/OfferConfiguratorEmbed'
import { useSubscriptionPlan } from '@/components/subscription/subscription-plan-context'
import { minPlanForFeature } from '@/lib/subscription/plan-access'
import { ModuleEmptyState } from '@/components/onboarding'

interface OffersListProps {
  dealId: string
  /** When `quick_offer`, signed offers can be promoted to the CRM board (Pro+). */
  dealSource?: string | null
  refreshTrigger?: number
  adminToken?: string
  onOffersChanged?: () => void
  /** Called after save-to-CRM so the parent can refresh deal `source` without refetch. */
  onDealPromotedToCrm?: () => void
}

export function OffersList({
  dealId,
  dealSource = null,
  refreshTrigger,
  adminToken,
  onOffersChanged,
  onDealPromotedToCrm,
}: OffersListProps) {
  const params = useParams()
  const locale = (params?.locale as Locale) || 'he'
  const toast = useToast()
  const tDeals = useTranslations('deals')
  const tOnboarding = useTranslations('onboarding')
  const tSub = useTranslations('subscription')
  const { language } = useLanguage()
  const fmt = usePriceFormatter()
  const { can } = useSubscriptionPlan()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [embedFor, setEmbedFor] = useState<{ offer: Offer; editUrl: string } | null>(null)
  const [embedLoadingOfferId, setEmbedLoadingOfferId] = useState<string | null>(null)
  const [convertingOfferId, setConvertingOfferId] = useState<string | null>(null)

  const fetchOffers = useCallback(async (opts?: { silent?: boolean }): Promise<Offer[]> => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const response = await fetch(`/api/offers?dealId=${dealId}`)
      if (!response.ok) throw new Error('Failed to fetch offers')
      const data = await response.json() as { offers?: Offer[] }
      const list = data.offers ?? []
      setOffers(list)
      return list
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load offers'
      console.error('Error fetching offers:', err)
      if (!silent) setError(message)
      return []
    } finally {
      if (!silent) setLoading(false)
    }
  }, [dealId])

  useEffect(() => { fetchOffers() }, [fetchOffers, refreshTrigger])

  const handleSendWhatsApp = useCallback((offer: Offer) => {
    try {
      const offerUrl = getOfferPublicUrl(offer.id, locale)
      const raw = offer.customerPhone?.replace(/\D/g, '') || '972524494848'
      let phone = raw
      if (phone.startsWith('0')) phone = `972${phone.slice(1)}`
      else if (!phone.startsWith('972')) phone = `972${phone}`
      phone = `+${phone}`

      let messageText = `שלום ${offer.customerName},\n\nהצעת המחיר שלך מוכנה!\n\n`
      if (offer.options?.notes?.trim()) {
        const shortDesc = offer.options.notes.length > 300
          ? offer.options.notes.substring(0, 297) + '...'
          : offer.options.notes
        messageText += `תיאור:\n${shortDesc}\n\n`
      }
      messageText += `לצפייה:\n${offerUrl}\n\n` +
        `סכום: ${fmt(offer.finalPrice)}\n\nבברכה,\nPashkovsky Group`

      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`, '_blank')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('שגיאה: ' + message)
    }
  }, [locale, toast])

  const handleSendEmail = useCallback(async (offer: Offer) => {
    const email = prompt('הזן כתובת אימייל לשליחת ההצעה:')
    if (!email) return
    try {
      const offerUrl = getOfferPublicUrl(offer.id, locale)
      const response = await fetch(`/api/offers/${offer.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, offerUrl, customerName: offer.customerName }),
      })
      if (!response.ok) {
        const data = await response.json() as { details?: string }
        throw new Error(data.details ?? 'Failed to send email')
      }
      toast.success('האימייל נשלח בהצלחה!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('שגיאה בשליחת אימייל: ' + message)
    }
  }, [locale, toast])

  const handleDelete = useCallback(async (offerId: string) => {
    if (!confirm('למחוק את ההצעה הזו?')) return
    try {
      const response = await authFetch(`/api/offers/${offerId}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to delete offer')
      }
      fetchOffers()
      onOffersChanged?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('שגיאה במחיקה: ' + message)
    }
  }, [fetchOffers, onOffersChanged, toast])

  const handleConvertToDeal = useCallback(
    async (offer: Offer) => {
      if (!can('save_offer_to_crm')) return
      const name = offer.customerName?.trim() || tDeals('withoutName')
      setConvertingOfferId(offer.id)
      try {
        const res = await authFetch(`/api/quick-offer/${offer.id}/save-to-crm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: name,
            customerPhone: offer.customerPhone ?? '',
            customerCity: offer.customerCity ?? '',
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(d.error ?? tDeals('convertToDealError'))
        }
        toast.success(tDeals('convertToDealSuccess'))
        onDealPromotedToCrm?.()
        await fetchOffers({ silent: true })
        onOffersChanged?.()
      } catch (err) {
        const message = err instanceof Error ? err.message : tDeals('convertToDealError')
        toast.error(message)
      } finally {
        setConvertingOfferId(null)
      }
    },
    [can, fetchOffers, onDealPromotedToCrm, onOffersChanged, tDeals, toast],
  )

  const handleGeneratePdf = useCallback(async (offer: Offer, forceRegenerate = false) => {
    try {
      const qs = new URLSearchParams()
      if (forceRegenerate) qs.set('force', 'true')
      qs.set('locale', language)
      const url = `/api/offers/${offer.id}/pdf?${qs.toString()}`
      const res = await authFetch(url, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; details?: string }
        throw new Error(err.error ?? err.details ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { pdfUrl?: string; cached?: boolean }
      if (data.pdfUrl !== undefined && data.pdfUrl !== '') {
        const pdfWindow = window.open(data.pdfUrl, '_blank')
        if (!pdfWindow) window.location.href = data.pdfUrl
        if (data.cached === true && !forceRegenerate) {
          if (confirm('PDF כבר קיים. האם לייצר מחדש?')) handleGeneratePdf(offer, true)
        }
      } else {
        toast.info('PDF נוצר אך לא הוחזר קישור')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      toast.error('שגיאה ביצירת PDF: ' + message)
    }
  }, [language, toast])

  const handleViewOffer = useCallback((offerId: string) => {
    const url = getOfferPublicUrl(offerId, locale)
    window.open(url, '_blank')
  }, [locale])

  const customerConfiguratorShareUrl = useCallback((offer: Offer): string | null => {
    const meta = offer.configuratorMeta
    if (meta?.viewUrl?.startsWith('http')) {
      return meta.viewUrl.includes('view=1')
        ? meta.viewUrl
        : `${meta.viewUrl}${meta.viewUrl.includes('?') ? '&' : '?'}view=1`
    }
    if (meta?.editUrl?.startsWith('http')) {
      return `${meta.editUrl}${meta.editUrl.includes('?') ? '&' : '?'}view=1`
    }
    return null
  }, [])

  const handleCopyConfiguratorLink = useCallback(
    async (offerId: string, offer: Offer) => {
      const existing = customerConfiguratorShareUrl(offer)
      if (existing) {
        try {
          await navigator.clipboard.writeText(existing)
          toast.success('קישור תצוגת 3D ללקוח הועתק (לצפייה בלבד)')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          toast.error('שגיאה: ' + message)
        }
        return
      }
      try {
        const res = await authFetch(`/api/offers/${offerId}/configurator-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as { url?: string; customerUrl?: string }
        const forCustomer = data.customerUrl ?? data.url
        if (!forCustomer) throw new Error('No URL')
        await navigator.clipboard.writeText(forCustomer)
        toast.success('קישור תצוגת 3D ללקוח הועתק (לצפייה בלבד)')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast.error('שגיאה: ' + message)
      }
    },
    [locale, toast, customerConfiguratorShareUrl]
  )

  const staffConfiguratorEditUrl = useCallback((offer: Offer): string | null => {
    const meta = offer.configuratorMeta
    if (meta?.editUrl?.startsWith('http')) return meta.editUrl
    const v = meta?.viewUrl
    if (!v?.startsWith('http')) return null
    if (!v.includes('view=1')) return v
    return v
      .replace(/&view=1(?=&|$)/, '')
      .replace(/\?view=1&/, '?')
      .replace(/\?view=1$/, '')
  }, [])

  const handleToggleConfiguratorEmbed = useCallback(
    async (offer: Offer) => {
      if (embedFor?.offer.id === offer.id) {
        setEmbedFor(null)
        return
      }
      let editUrl = staffConfiguratorEditUrl(offer)
      if (!editUrl) {
        setEmbedLoadingOfferId(offer.id)
        try {
          const res = await authFetch(`/api/offers/${offer.id}/configurator-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale }),
          })
          if (!res.ok) throw new Error('mint failed')
          const data = (await res.json()) as { url?: string }
          if (!data.url) throw new Error('No URL')
          editUrl = data.url
          const list = await fetchOffers({ silent: true })
          const fresh = list.find((o) => o.id === offer.id) ?? offer
          setEmbedFor({ offer: fresh, editUrl })
        } catch {
          toast.error('לא ניתן לטעון קונפיגורטור')
        } finally {
          setEmbedLoadingOfferId(null)
        }
        return
      }
      setEmbedFor({ offer, editUrl })
    },
    [embedFor?.offer.id, locale, toast, staffConfiguratorEditUrl, fetchOffers],
  )

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[200px] rounded-lg border border-red-500/50 bg-red-500/20 p-4 text-red-200">
        שגיאה בטעינת הצעות מחיר: {error}
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="min-h-[200px] py-4">
        <ModuleEmptyState
          title={tOnboarding('emptyOffersTitle')}
          description={tOnboarding('emptyOffersDesc')}
          actionLabel={tOnboarding('emptyOffersCta')}
          actionHref="/app/quick-offer"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {offers.map((offer) => (
        <div
          key={offer.id}
          className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <div>
                <div className="font-semibold">
                  {(() => {
                    const p = offer.pergolas?.[0] ?? offer.pergola
                    const rect =
                      p?.shape?.type === 'rectangle'
                        ? p.shape
                        : p?.width != null && p?.length != null
                          ? { width: p.width, length: p.length }
                          : null
                    const typeKey = p?.pergolaType === 'fixed' ? 'pergolaFixed' : p?.pergolaType === 'electricPvc' ? 'pergolaElectricPvc' : p?.pergolaType === 'electricBioclimatic' ? 'pergolaElectricBioclimatic' : null
                    const typeName = typeKey ? tDeals(typeKey) : null
                    return rect ? (
                      <>
                        {typeName && <span className="text-blue-300 text-xs font-normal me-1">{typeName}</span>}
                        {rect.width}×{rect.length} מ׳
                        {p?.height != null && ` (גובה: ${p.height} מ׳)`}
                      </>
                    ) : (
                      <span className="text-white/60">ללא פרגולה</span>
                    )
                  })()}
                </div>
                <div className="text-sm text-white/60">
                  {new Date(offer.createdAt).toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>

            <div className="text-left">
              <div className="text-2xl font-bold text-green-400">
                {fmt(offer.finalPrice)}
              </div>
              <div className="flex items-center gap-1 text-sm">
                {offer.approval.approved ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">אושר</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400">ממתין לאישור</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* AI Text Preview */}
          {(offer.configuratorMeta?.previewImageUrl?.startsWith('http') ||
            offer.images?.[0]?.startsWith('http')) && (
            <div className="mb-3 border-t border-white/10 pt-3 flex flex-col sm:flex-row gap-3 items-start">
              <img
                src={
                  offer.configuratorMeta?.previewImageUrl?.startsWith('http')
                    ? offer.configuratorMeta.previewImageUrl
                    : (offer.images![0] as string)
                }
                alt="3D preview"
                width={192}
                height={128}
                className="h-32 w-48 shrink-0 rounded border border-white/20 bg-black/20 object-contain"
              />
              <div className="text-xs text-white/70 space-y-1">
                <div className="font-semibold text-white/90">תצוגה תלת־ממדית</div>
                {staffConfiguratorEditUrl(offer) ? (
                  <a
                    href={staffConfiguratorEditUrl(offer)!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-300 underline"
                  >
                    עריכת 3D (אצלך)
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {offer.options?.notes && offer.options.notes.trim() && (
            <div className="mb-3 border-t border-white/10 pt-3">
              <div className="text-xs text-purple-300 mb-1 flex items-center gap-1">
                <span>✨</span>
                <span className="font-semibold">תיאור AI:</span>
              </div>
              <p className="text-sm text-white/80 line-clamp-2 whitespace-pre-wrap">
                {offer.options.notes.length > 150 
                  ? offer.options.notes.substring(0, 147) + '...' 
                  : offer.options.notes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm border-t border-white/10 pt-3">
            <div>
              <span className="text-white/60">שטח:</span>
              <span className="mr-2 font-medium">{offer.area} מ״ר</span>
            </div>
            <div>
              <span className="text-white/60">צבע:</span>
              <span className="mr-2 font-medium">
                {offer.color.type === 'white' && 'לבן'}
                {offer.color.type === 'black' && 'שחור'}
                {offer.color.type === 'cream' && 'קרם'}
                {offer.color.type === 'ral' && `RAL ${offer.color.ralCode}`}
                {offer.color.type === 'wood' && `דמוי עץ ${offer.color.woodName}`}
              </span>
            </div>
            {offer.santaf.enabled && (
              <div>
                <span className="text-white/60">סנטף BH:</span>
                <span className="mr-2 font-medium text-green-400">
                  {offer.santaf.withStructure ? '+ קונסטרוקציה' : 'בלבד'}
                </span>
              </div>
            )}
            {offer.zipScreen.enabled && (
              <div>
                <span className="text-white/60">ZIP:</span>
                <span className="mr-2 font-medium text-blue-400">
                  {offer.zipScreen.type === 'electric' ? 'חשמלי' : 'ידני'}
                </span>
              </div>
            )}
            {offer.lighting?.enabled && (
              <div>
                <span className="text-white/60">תאורה:</span>
                <span className="mr-2 font-medium text-yellow-400">{offer.lighting.runningMeters || '?'} מ׳</span>
              </div>
            )}
            {offer.drainage?.enabled && (
              <div>
                <span className="text-white/60">ניקוז:</span>
                <span className="mr-2 font-medium text-blue-400">{offer.drainage.runningMeters || '?'} מ׳</span>
              </div>
            )}
            {offer.discountPercent > 0 && (
              <div className="col-span-2">
                <span className="text-white/60">הנחה:</span>
                <span className="mr-2 font-medium text-red-400">
                  {offer.discountPercent}% (-{fmt(offer.discountAmount)})
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 border-t border-white/10 pt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {/* View Offer */}
            <button
              onClick={() => handleViewOffer(offer.id)}
              className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 text-xs font-medium transition-colors"
              title="צפה בהצעה"
            >
              <FileText className="w-4 h-4" />
              צפה
            </button>

            <button
              onClick={() => handleCopyConfiguratorLink(offer.id, offer)}
              className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 text-xs font-medium transition-colors"
              title="העתק ללקוח — תצוגת 3D בלבד (ללא שינוי מחירים)"
            >
              <Copy className="w-4 h-4" />
              קישור ללקוח
            </button>

            <button
              onClick={() => void handleToggleConfiguratorEmbed(offer)}
              disabled={embedLoadingOfferId === offer.id}
              className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-teal-600/20 hover:bg-teal-600/30 text-teal-200 text-xs font-medium transition-colors disabled:opacity-50"
              title="עריכת 3D בתוך ה-CRM (מחובר להצעה)"
            >
              <Box className="w-4 h-4" />
              {embedLoadingOfferId === offer.id ? '…' : embedFor?.offer.id === offer.id ? 'סגור 3D' : '3D'}
            </button>

            {/* PDF */}
            <button
              onClick={() => handleGeneratePdf(offer, false)}
              className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 text-xs font-medium transition-colors"
              title="הורד PDF (משתמש בקובץ קיים אם יש)"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>

            {/* Regenerate PDF (force) */}
            <button
              onClick={() => handleGeneratePdf(offer, true)}
              className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors"
              title="צור PDF מחדש (כולל שינויים אחרונים)"
            >
              <FileDown className="w-3 h-3" />
              <span className="text-[10px]">🔄 חדש</span>
            </button>

            {/* WhatsApp */}
            {offer.customerPhone && (
              <button
                onClick={() => handleSendWhatsApp(offer)}
                className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-green-600/20 hover:bg-green-600/30 text-green-200 text-xs font-medium transition-colors"
                title="שלח WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            )}

            {/* Email */}
            <button
              onClick={() => handleSendEmail(offer)}
              className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 text-xs font-medium transition-colors"
              title="שלח אימייל"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>

            {dealSource === 'quick_offer' && offer.approval.approved === true ? (
              can('save_offer_to_crm') ? (
                <button
                  type="button"
                  onClick={() => void handleConvertToDeal(offer)}
                  disabled={convertingOfferId === offer.id}
                  className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-violet-600/25 hover:bg-violet-600/35 text-violet-100 text-xs font-medium transition-colors disabled:opacity-50"
                  title={tDeals('btnConvertToDeal')}
                >
                  <Building2 className="w-4 h-4" />
                  {convertingOfferId === offer.id ? '…' : tDeals('btnConvertToDeal')}
                </button>
              ) : (
                <div className="col-span-2 flex flex-col gap-1 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-2">
                  <div className="flex items-center gap-1 text-amber-200 text-xs font-medium">
                    <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    {tDeals('btnConvertToDeal')}
                  </div>
                  <p className="text-[10px] text-amber-200/85 leading-snug">
                    {tSub('availableInPlan', {
                      plan: tSub(`planNames.${minPlanForFeature('save_offer_to_crm')}`),
                    })}
                  </p>
                </div>
              )
            ) : null}

            {/* Delete */}
            <button
              onClick={() => handleDelete(offer.id)}
              className="w-full sm:flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded bg-red-600/20 hover:bg-red-600/30 text-red-200 text-xs font-medium transition-colors"
              title="מחק הצעה"
            >
              <Trash2 className="w-4 h-4" />
              מחק
            </button>
          </div>

          {embedFor?.offer.id === offer.id ? (
            <div className="mt-3 flex min-h-[420px] flex-col rounded-lg border border-teal-500/30 bg-black/30 p-2 sm:p-3">
              <OfferConfiguratorEmbed
                offerId={offer.id}
                locale={locale}
                editUrl={embedFor.editUrl}
                offer={embedFor.offer}
                onSaved={() => void fetchOffers({ silent: true })}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
