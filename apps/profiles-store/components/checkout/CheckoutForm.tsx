'use client'

import { FormEvent, useState } from 'react'
import { getTranslation, type Locale } from '@/lib/locales'

interface CustomerInfo {
  name: string
  phone: string
  email: string
  city: string
  address: string
}

interface CheckoutFormProps {
  locale: Locale
  customerInfo: CustomerInfo
  onChange: (info: CustomerInfo) => void
  onSubmit: (e: FormEvent) => void
  isSubmitting?: boolean
}

export function CheckoutForm({
  locale,
  customerInfo,
  onChange,
  onSubmit,
  isSubmitting = false,
}: CheckoutFormProps) {
  const handleChange = (field: keyof CustomerInfo, value: string) => {
    onChange({ ...customerInfo, [field]: value })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {getTranslation(locale, 'checkout.name')} *
        </label>
        <input
          type="text"
          required
          value={customerInfo.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {getTranslation(locale, 'checkout.phone')} *
        </label>
        <input
          type="tel"
          required
          value={customerInfo.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {getTranslation(locale, 'checkout.email')} *
        </label>
        <input
          type="email"
          required
          value={customerInfo.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {getTranslation(locale, 'checkout.city')} *
        </label>
        <input
          type="text"
          required
          value={customerInfo.city}
          onChange={(e) => handleChange('city', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {getTranslation(locale, 'checkout.address')}
        </label>
        <textarea
          value={customerInfo.address}
          onChange={(e) => handleChange('address', e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting
          ? 'Submitting...'
          : getTranslation(locale, 'checkout.submit')}
      </button>
    </form>
  )
}
