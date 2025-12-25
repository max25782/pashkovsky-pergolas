import type { Offer } from '@/types/offer'

export function getPublicOfferUrl(offerId: string, locale: string = 'he'): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  return `${baseUrl}/${locale}/offers/${offerId}/approve`
}

export function openWhatsAppWithOffer(offer: Offer, offerUrl: string) {
  const raw = offer.customerPhone?.replace(/\D/g, '') || '972524494848' // fallback main number
  let phone = raw
  if (phone.startsWith('0')) {
    phone = `972${phone.slice(1)}`
  } else if (!phone.startsWith('972')) {
    phone = `972${phone}`
  }
  phone = `+${phone}`
  
  if (!phone) {
    throw new Error('מספר טלפון לא נמצא')
  }
  
  const message = encodeURIComponent(
    `שלום ${offer.customerName},\n\nלצפייה ואישור הצעת המחיר שלך לחץ כאן:\n${offerUrl}`
  )
  
  const whatsappUrl = `https://wa.me/${phone}?text=${message}`
  window.open(whatsappUrl, '_blank')
}
