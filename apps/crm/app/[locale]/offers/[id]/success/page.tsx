"use client"

import { Check } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function OfferSuccessPage() {
  const params = useParams()

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
          <div>
            <strong>📞 טלפון:</strong> 052-449-4848
          </div>
          <div>
            <strong>📧 אימייל:</strong> office@pashkovsky-group.com
          </div>
        </div>
        
        <div className="mt-8">
          <Link
            href={`/${params.locale}`}
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition"
          >
            חזרה לאתר הראשי
          </Link>
        </div>
      </div>
    </div>
  )
}

