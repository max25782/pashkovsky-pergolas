/**
 * Utilities for sharing offers via WhatsApp, Email, etc.
 */

import type { Offer } from '@/types/offer'

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
export function sendOfferViaWhatsApp(offer: Offer): string {
  if (!offer.customerPhone) {
    throw new Error('Customer phone number is required')
  }

  const phone = formatPhoneForWhatsApp(offer.customerPhone)
  const offerUrl = getOfferPublicUrl(offer.id)
  
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
  
  messageText += `לצפייה בהצעת מחיר מלאה ולחץ כאן:\n${offerUrl}\n\n` +
    `💰 סכום: ₪${offer.finalPrice.toLocaleString('he-IL', { minimumFractionDigits: 2 })}\n\n` +
    `בברכה,\nPashkovsky Group`
  
  const message = encodeURIComponent(messageText)

  return `https://wa.me/${phone}?text=${message}`
}

/**
 * Open WhatsApp with pre-filled message
 */
export function openWhatsApp(offer: Offer): void {
  const url = sendOfferViaWhatsApp(offer)
  window.open(url, '_blank')
}

/**
 * Get email subject for offer
 */
export function getOfferEmailSubject(offer: Offer): string {
  return `הצעת מחיר - ${offer.customerName} | Pashkovsky Group`
}

/**
 * Get email body for offer
 */
export function getOfferEmailBody(offer: Offer): string {
  const offerUrl = getOfferPublicUrl(offer.id)
  
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
      <p>Pashkovsky Group - פתרונות אלומיניום מתקדמים</p>
    </div>
    
    <div class="content">
      <p><strong>שלום ${offer.customerName},</strong></p>
      
      <p>שמחים להציג לך את הצעת המחיר המפורטת עבור פרגולת האלומיניום שלך.</p>
      
      <div class="details">
        ${(() => {
          const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
          if (pergolas.length === 0) {
            return '<h3>ללא פרגולה</h3>'
          }
          let html = '<h3>פרטי הפרגולות:</h3><ul>'
          pergolas.forEach((pergola, index) => {
            const prefix = pergolas.length > 1 ? `פרגולה ${index + 1}: ` : ''
            const width = pergola.shape?.type === 'rectangle' ? pergola.shape.width : pergola.width || 0
            const length = pergola.shape?.type === 'rectangle' ? pergola.shape.length : pergola.length || 0
            html += `<li><strong>${prefix}גודל:</strong> ${width}m × ${length}m</li>`
            if (pergola.height) {
              html += `<li><strong>${prefix}גובה:</strong> ${pergola.height}m</li>`
            }
          })
          html += `</ul><ul>`
          return html
        })()}
          ${offer.santaf?.enabled ? `<li><strong>סנטף:</strong> ${offer.santaf.withStructure ? 'עם קונסטרוקציה' : 'בסיסי'}</li>` : ''}
          ${offer.discountPercent > 0 ? `<li><strong>הנחה:</strong> ${offer.discountPercent}%</li>` : ''}
        </ul>
      </div>
      
      <div class="price">
        מחיר סופי: ₪${offer.finalPrice.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
      </div>
      
      <div style="text-align: center;">
        <a href="${offerUrl}" class="button">לצפייה ואישור ההצעה</a>
      </div>
      
      <p><strong>תוקף ההצעה:</strong> 30 יום מתאריך שליחה</p>
      
      <p>לשאלות נוספות או לתיאום פגישה, צור קשר:</p>
      <ul>
        <li>📞 טלפון: 050-123-4567</li>
        <li>📧 אימייל: office@pashkovsky-group.com</li>
        <li>🌐 אתר: www.pashkovsky-group.com</li>
      </ul>
      
      <p>נשמח לעמוד לשירותך!</p>
      
      <p><strong>בברכה,<br>צוות Pashkovsky Group</strong></p>
    </div>
    
    <div class="footer">
      <p>Pashkovsky Group | אזור תעשיה עמנואל</p>
      <p>טלפון: 050-123-4567 | www.pashkovsky-group.com</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

