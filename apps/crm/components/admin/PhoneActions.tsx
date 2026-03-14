'use client'

import { Phone, MessageCircle } from 'lucide-react'

function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return '972' + digits.slice(1)
  if (digits.startsWith('972')) return digits
  if (digits.length === 9 && digits.startsWith('5')) return '972' + digits
  return digits
}

interface PhoneActionsProps {
  phone: string
  className?: string
  /** Compact: icons only. Full: icons + labels */
  variant?: 'compact' | 'full'
}

export function PhoneActions({ phone, className = '', variant = 'full' }: PhoneActionsProps) {
  if (!phone?.trim()) return <span className="text-white/50">—</span>

  const waNumber = toWhatsAppNumber(phone)
  const waLink = `https://wa.me/${waNumber}`

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
      </div>
    </div>
  )
}
