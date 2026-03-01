const ADS_ID = 'AW-17964444824'
const CONVERSION_EVENT = 'ads_conversion__2'

function gtag(...args: unknown[]) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag(...args)
}

/** Fire a Google Ads conversion event */
export function trackConversion(params?: Record<string, unknown>) {
  gtag('event', CONVERSION_EVENT, {
    send_to: `${ADS_ID}/${CONVERSION_EVENT}`,
    ...params,
  })
}

/** Generic click event for any CTA */
export function trackClick(label: string) {
  gtag('event', 'click', {
    event_category: 'CTA',
    event_label: label,
  })
}

/** Form submission conversion */
export function trackFormSubmit(formName = 'contact_form') {
  trackConversion({ form_name: formName })
  trackClick(formName)
}

/** WhatsApp click */
export function trackWhatsApp(source = 'unknown') {
  gtag('event', 'whatsapp_click', {
    event_category: 'Contact',
    event_label: source,
  })
  trackConversion({ contact_method: 'whatsapp', source })
}

/** Phone call click */
export function trackPhoneCall(number: string) {
  gtag('event', 'phone_call', {
    event_category: 'Contact',
    event_label: number,
  })
  trackConversion({ contact_method: 'phone', phone: number })
}
