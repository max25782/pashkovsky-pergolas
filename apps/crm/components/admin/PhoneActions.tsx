'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { useCRMTranslations } from './useCRMTranslations'
import { useFirmProfile } from './hooks/useFirmProfile'
import { customerWhatsAppLink, leadGreeting } from '@/lib/company/firm-profile'

interface PhoneActionsProps {
  phone: string
  /** Lead/customer name for personalized WhatsApp greeting */
  leadName?: string
  /** Override company name (default: from useCompanyName) */
  companyName?: string
  className?: string
  /** Compact: icons only. Full: icons + labels */
  variant?: 'compact' | 'full'
}

export function PhoneActions({
  phone,
  leadName,
  companyName: companyProp,
  className = '',
  variant = 'full'
}: PhoneActionsProps) {
  const t = useCRMTranslations()
  const { profile } = useFirmProfile()
  const companyName = companyProp ?? profile.name

  if (!phone?.trim()) return <span className="text-white/50">—</span>

  // The firm's own greeting when it wrote one, otherwise the neutral translated default.
  const greeting = profile.whatsappTemplate
    ? leadGreeting({ ...profile, name: companyName }, leadName)
    : leadName?.trim()
      ? t.leads.whatsappGreeting(leadName.trim(), companyName)
      : t.leads.whatsappGreetingNoName(companyName)
  // Null when the firm has no WhatsApp number: the button is not rendered at all.
  const waLink = customerWhatsAppLink(profile, phone, greeting)

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-white/70">{phone}</span>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <a
          href={`tel:${phone}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition-colors"
          title="Позвонить"
        >
          <Phone className="w-3.5 h-3.5" />
          {variant === 'full' && <span>Позвонить</span>}
        </a>
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600/30 hover:bg-green-600/50 text-green-300 hover:text-green-200 text-xs transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {variant === 'full' && <span>WhatsApp</span>}
          </a>
        ) : null}
      </div>
    </div>
  )
}
