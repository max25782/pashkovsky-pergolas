'use client'
import ContactCtaButton from '@/components/contact/ContactCtaButton'
import type { Locale } from '@/lib/locales'
import { FaWhatsapp } from 'react-icons/fa'

export default function FloatingWhatsApp({ locale = 'he' as Locale }) {
  return (
    <div className="fixed right-4 bottom-4 z-50">
      <ContactCtaButton
        locale={locale}
        className="rounded-full w-16 h-16 !px-0 !py-0 !gap-0 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
        buttonText={<FaWhatsapp color="#ffffff" size={28} />}
      />
    </div>
  )
}


