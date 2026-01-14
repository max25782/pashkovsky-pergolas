"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatPrice } from '@/lib/offer-calculator'
import type { Offer } from '@/types/offer'
import { FileText, Check, Clock, Download, FileDown, MessageCircle, Mail, Trash2 } from 'lucide-react'
import { getOfferPublicUrl } from '@/lib/offer-sharing'
import type { Locale } from '@/lib/locales'
import { authFetch } from '@/lib/api/auth-fetch'

interface OffersListProps {
  dealId: string
  refreshTrigger?: number
  adminToken?: string
}

export function OffersList({ dealId, refreshTrigger, adminToken }: OffersListProps) {
  const params = useParams()
  const locale = (params?.locale as Locale) || 'he'
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  const fetchOffers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/offers?dealId=${dealId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch offers')
      }

      const data = await response.json()
      setOffers(data.offers || [])
    } catch (err: any) {
      console.error('Error fetching offers:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers, refreshTrigger])

  const handleSendWhatsApp = useCallback((offer: Offer) => {
    try {
      const offerUrl = getOfferPublicUrl(offer.id, locale)

      // Normalize phone to international format for wa.me
      const raw = offer.customerPhone?.replace(/\D/g, '') || '972524494848' // fallback to main number
      let phone = raw
      if (phone.startsWith('0')) {
        phone = `972${phone.slice(1)}`
      } else if (!phone.startsWith('972')) {
        phone = `972${phone}`
      }
      phone = `+${phone}`

      // Build message with AI-generated description if available
      let messageText = `שלום ${offer.customerName},\n\n` +
        `הצעת המחיר שלך מוכנה! 🎉\n\n`
      
      // Add AI-generated description if exists
      if (offer.options?.notes && offer.options.notes.trim()) {
        // Limit to ~300 chars to keep WhatsApp message reasonable
        const shortDescription = offer.options.notes.length > 300
          ? offer.options.notes.substring(0, 297) + '...'
          : offer.options.notes
        
        messageText += `📋 תיאור:\n${shortDescription}\n\n`
      }
      
      messageText += `לצפייה ואישור הצעת המחיר המלאה לחץ כאן:\n${offerUrl}\n\n` +
        `💰 סכום: ₪${offer.finalPrice.toLocaleString('he-IL', { minimumFractionDigits: 2 })}\n\n` +
        `בברכה,\nPashkovsky Group`

      const message = encodeURIComponent(messageText)
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
    } catch (err: any) {
      alert('שגיאה: ' + err.message)
    }
  }, [locale])

  const handleSendEmail = useCallback(async (offer: Offer) => {
    const email = prompt('הזן כתובת אימייל לשליחת ההצעה:')
    if (!email) return

    try {
      const offerUrl = getOfferPublicUrl(offer.id, locale)
      
      const response = await fetch(`/api/offers/${offer.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          offerUrl,
          customerName: offer.customerName,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Failed to send email')
      }

      alert('✅ האימייל נשלח בהצלחה!')
    } catch (err: any) {
      console.error('Error sending email:', err)
      alert('❌ שגיאה בשליחת אימייל: ' + err.message)
    }
  }, [locale])

  const handleDelete = useCallback(async (offerId: string) => {
    if (!confirm('למחוק את ההצעה הזו?')) return
    try {
      const response = await authFetch(`/api/offers/${offerId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to delete offer')
      }
      // refresh list
      fetchOffers()
    } catch (err: any) {
      alert('❌ שגיאה במחיקה: ' + err.message)
    }
  }, [fetchOffers])

  const handleGeneratePdf = useCallback(async (offer: Offer, forceRegenerate = false) => {
    try {
      const url = `/api/offers/${offer.id}/pdf${forceRegenerate ? '?force=true' : ''}`
      const res = await authFetch(url, {
        method: 'POST'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.details || 'Failed to generate PDF')
      }
      const data = await res.json()
      if (data?.pdfUrl) {
        window.open(data.pdfUrl, '_blank')
        // If it was cached, ask if user wants to regenerate
        if (data.cached && !forceRegenerate) {
          const shouldRegenerate = confirm('PDF כבר קיים. האם לייצר מחדש?')
          if (shouldRegenerate) {
            handleGeneratePdf(offer, true)
          }
        }
      } else {
        alert('PDF נוצר אך לא הוחזר קישור')
      }
    } catch (err: any) {
      alert('❌ שגיאה ביצירת PDF: ' + err.message)
    }
  }, [])

  const handleViewOffer = useCallback((offerId: string) => {
    const url = getOfferPublicUrl(offerId, locale)
    window.open(url, '_blank')
  }, [locale])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
        שגיאה בטעינת הצעות מחיר: {error}
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-12 text-white/60">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>אין עדיין הצעות מחיר ללקוח זה</p>
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
                  {offer.pergola.width}×{offer.pergola.length} מ׳
                  {offer.pergola.height && ` (גובה: ${offer.pergola.height} מ׳)`}
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
                {formatPrice(offer.finalPrice)}
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
                  {offer.discountPercent}% (-{formatPrice(offer.discountAmount)})
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
        </div>
      ))}
    </div>
  )
}
