import { Check } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { firmWhatsAppLink, loadFirmProfile } from '@/lib/company/firm-profile'

export const dynamic = 'force-dynamic'

/** The firm that issued the offer, so the page shows its contacts and nobody else's. */
async function loadIssuer(offerId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key, { db: { schema: 'public' } })
  const { data } = await supabase.from('offers').select('company_id').eq('id', offerId).maybeSingle()
  const companyId = typeof data?.company_id === 'string' ? data.company_id : null
  return companyId ? loadFirmProfile(supabase, companyId) : null
}

export default async function OfferSuccessPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  const firm = await loadIssuer(id)
  const whatsAppHref = firmWhatsAppLink(firm)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <Check className="w-20 h-20 text-green-500 mx-auto mb-4 animate-bounce" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🎉 ההצעה אושרה בהצלחה!
        </h1>

        <p className="text-gray-600 mb-6 text-lg">
          תודה רבה על אישור ההצעה!
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            <strong>מה הלאה?</strong>
          </p>
          <p className="text-sm text-gray-600 mt-2">
            נציג מטעמנו יצור איתך קשר בהקדם לתיאום התקנה ופרטים נוספים.
          </p>
        </div>

        <div className="space-y-3 text-sm text-gray-600">
          {firm?.phone ? (
            <div>
              <strong>📞 טלפון:</strong> {firm.phone}
            </div>
          ) : null}
          {firm?.email ? (
            <div>
              <strong>📧 אימייל:</strong> {firm.email}
            </div>
          ) : null}
          {whatsAppHref ? (
            <div>
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
              >
                WhatsApp
              </a>
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <Link
            href={`/${locale}`}
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition"
          >
            חזרה לאתר הראשי
          </Link>
        </div>
      </div>
    </div>
  )
}
