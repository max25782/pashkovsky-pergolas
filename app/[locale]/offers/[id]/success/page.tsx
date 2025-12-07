"use client"

import { Check } from 'lucide-react'

export default function OfferSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          ההצעה אושרה בהצלחה!
        </h1>
        
        <p className="text-gray-600 text-lg mb-8">
          תודה רבה על האישור.<br />
          ניצור איתך קשר בהקדם.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <p className="font-semibold mb-2">Pashkovsky Group</p>
          <p>פרגולות | גדרות | חלונות</p>
          <p className="mt-2 text-blue-600">052-449-4848</p>
        </div>
      </div>
    </div>
  )
}

