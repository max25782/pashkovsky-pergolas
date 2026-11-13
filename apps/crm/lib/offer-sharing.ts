/**
 * Utilities for sharing offers via WhatsApp, Email, etc.
 */

import {
  customerOfferMessage,
  formatEnteredPercent,
  readOfferPricingSnapshot,
  snapshotShareLines,
} from '@/lib/offers/offer-pricing-snapshot'
import type { Offer } from '@/types/offer'
import {
  customerWhatsAppLink,
  displayWebsite,
  type FirmProfile,
} from '@/lib/company/firm-profile'

/**
 * Get public URL for offer approval page
 */
export function getOfferPublicUrl(offerId: string, locale: string = 'he'): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  return `${baseUrl}/${locale}/offers/${offerId}/approve`
}

/**
 * Format phone number for WhatsApp (remove non-digits, ensure + prefix)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  
  // Add + if not present
  return digits.startsWith('972') ? `+${digits}` : `+972${digits}`
}

/**
 * Generate WhatsApp share link for offer
 */
export function sendOfferViaWhatsApp(offer: Offer, firm: FirmProfile): string {
  if (!offer.customerPhone) {
    throw new Error('Customer phone number is required')
  }
  const offerUrl = getOfferPublicUrl(offer.id)
  const snapshot = readOfferPricingSnapshot(offer)
  const messageText = snapshot
    ? customerOfferMessage({ customerName: offer.customerName, offerUrl, snapshot, companyName: firm.name })
    : `שלום ${offer.customerName},\n\n` +
      `הצעת המחיר שלך מוכנה!\n\n` +
      `לצפייה בהצעת מחיר מלאה:\n${offerUrl}\n\n` +
      `סכום: ₪${offer.finalPrice.toLocaleString('he-IL', { minimumFractionDigits: 2 })}\n\n` +
      `בברכה,${firm.name ? `\n${firm.name}` : ''}`

  const link = customerWhatsAppLink(firm, offer.customerPhone, messageText)
  if (!link) throw new Error('WhatsApp is not set up for this firm')
  return link
}

/**
 * Open WhatsApp with pre-filled message
 */
export function openWhatsApp(offer: Offer, firm: FirmProfile): void {
  const url = sendOfferViaWhatsApp(offer, firm)
  window.open(url, '_blank')
}

/**
 * Get email subject for offer
 */
export function getOfferEmailSubject(offer: Offer, firm: FirmProfile): string {
  return [`הצעת מחיר - ${offer.customerName}`, firm.name].filter(Boolean).join(' | ')
}

/**
 * Get email body for offer
 */
export function getOfferEmailBody(offer: Offer, firm: FirmProfile): string {
  const website = displayWebsite(firm.website)
  const offerUrl = getOfferPublicUrl(offer.id)
  const snapshot = readOfferPricingSnapshot(offer)
  const finalPrice = snapshot?.totals.finalPrice ?? offer.finalPrice
  const discountPercent = snapshot?.discountPercent ?? offer.discountPercent
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .price { font-size: 32px; font-weight: bold; color: #16a34a; text-align: center; margin: 20px 0; }
    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 הצעת המחיר שלך מוכנה!</h1>
      <p>${firm.name}</p>
    </div>
    
    <div class="content">
      <p><strong>שלום ${offer.customerName},</strong></p>
      
      <p>שמחים להציג לך את הצעת המחיר המפורטת עבור פרגולת האלומיניום שלך.</p>
      
      <div class="details">
        ${(() => {
          if (snapshot) {
            const lines = snapshotShareLines(snapshot)
              .map((line) => `<li><strong>${line.label}:</strong> ₪${line.amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>`)
              .join('')
            const discount =
              discountPercent > 0
                ? `<li><strong>הנחה:</strong> ${formatEnteredPercent(discountPercent)}%</li>`
                : ''
            return `<ul>${lines}${discount}</ul>`
          }
          const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
          if (pergolas.length === 0) return '<h3>ללא פרגולה</h3>'
          let html = '<ul>'
          pergolas.forEach((pergola, index) => {
            if (!(pergola.pricePerSqm > 0)) return
            const prefix = pergolas.length > 1 ? `פרגולה ${index + 1}: ` : 'פרגולה: '
            html += `<li><strong>${prefix}</strong> ₪${pergola.pricePerSqm}</li>`
          })
          html += `${offer.santaf?.enabled ? `<li><strong>סנטף:</strong> ${offer.santaf.withStructure ? 'עם קונסטרוקציה' : 'בסיסי'}</li>` : ''}`
          html += `${discountPercent > 0 ? `<li><strong>הנחה:</strong> ${formatEnteredPercent(discountPercent)}%</li>` : ''}`
          html += '</ul>'
          return html
        })()}
      </div>
      
      <div class="price">
        מחיר סופי: ₪${finalPrice.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
      </div>
      
      <div style="text-align: center;">
        <a href="${offerUrl}" class="button">לצפייה ואישור ההצעה</a>
      </div>
      
      <p><strong>תוקף ההצעה:</strong> 30 יום מתאריך שליחה</p>
      
      <p>לשאלות נוספות או לתיאום פגישה, צור קשר:</p>
      <ul>
        ${firm.phone ? `<li>📞 טלפון: ${firm.phone}</li>` : ''}
        ${firm.email ? `<li>📧 אימייל: ${firm.email}</li>` : ''}
        ${website ? `<li>🌐 אתר: ${website}</li>` : ''}
      </ul>
      
      <p>נשמח לעמוד לשירותך!</p>
      
      <p><strong>בברכה,<br>${firm.name ? `צוות ${firm.name}` : ''}</strong></p>
    </div>
    
    <div class="footer">
      <p>${[firm.name, firm.address].filter(Boolean).join(' | ')}</p>
      <p>${[firm.phone ? `טלפון: ${firm.phone}` : '', website ?? ''].filter(Boolean).join(' | ')}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

