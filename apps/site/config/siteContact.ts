/**
 * Contact details for the new site (/new).
 * Phone, e-mail, WhatsApp and social links are reused from the existing site footer.
 * `address` and `hours` are PLACEHOLDERS (marked below) until real values are confirmed.
 */
import type { Localized } from './siteTypes'

export interface SocialLink {
  name: string
  href: string
}

export interface SiteContact {
  brand: string
  phoneDisplay: string
  phoneTel: string
  /** Digits only, international format, used in wa.me links. */
  whatsappNumber: string
  email: string
  /** PLACEHOLDER: replace with the real address. */
  address: Localized
  /** PLACEHOLDER: replace with the real opening hours. */
  hours: Localized
  socials: SocialLink[]
}

export const siteContact: SiteContact = {
  brand: 'PASHKOVSKY',
  phoneDisplay: '052-449-4848',
  phoneTel: '+972524494848',
  whatsappNumber: '972524494848',
  email: 'office@pashkovsky-group.com',
  address: { he: 'כתובת, ישראל', en: 'Address, Israel' },
  hours: { he: 'א׳–ה׳ 08:00–17:00', en: 'Sun–Thu 08:00–17:00' },
  socials: [
    { name: 'Instagram', href: 'https://www.instagram.com/pashkovsky_maakot/' },
    { name: 'Facebook', href: 'https://www.facebook.com/pashcovskimaakot' },
    { name: 'TikTok', href: 'https://www.tiktok.com/@pashkovsky.group' },
  ],
}

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${siteContact.whatsappNumber}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
