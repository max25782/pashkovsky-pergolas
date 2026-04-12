/**
 * Company Settings Page
 * Manage company profile, logo, branding, and contact information
 * Only accessible by Owner/Admin or users with company_settings permission
 */

'use client'

import { useState, useEffect } from 'react'
import { Building2, Upload, Save, Mail, FileText, Palette, Phone, MapPin, CreditCard } from 'lucide-react'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/admin/LanguageSwitcher'

interface Company {
  id: string
  name: string
  slug: string
  primary_email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  logo_url: string | null
  brand_color: string | null
  email_signature: string | null
  pdf_footer: string | null
  vat_number: string | null
  bank_name: string | null
  bank_account: string | null
  bank_branch: string | null
}

const strings = {
  loadFailed: 'Failed to load company data',
  saveFailed: 'Failed to save changes',
  savedSuccess: 'Changes saved successfully',
  logoUploadFailed: 'Failed to upload logo',
  logoUploadSuccess: 'Logo uploaded successfully',
  loading: 'Loading...',
  noCompany: 'No company found. Please contact your administrator.',
  title: 'Company Settings',
  subtitle: 'Manage your company profile, branding, and contact information',
  logoSection: 'Company Logo',
  noLogo: 'No logo',
  uploading: 'Uploading...',
  uploadLogo: 'Upload Logo',
  logoHint: 'Recommended: PNG or SVG, max 2MB',
  basicInfo: 'Basic Information',
  companyName: 'Company Name',
  email: 'Email',
  phone: 'Phone',
  city: 'City',
  address: 'Address',
  addressPlaceholder: '123 Main St',
  banking: 'Banking & Invoice Details',
  vatNumber: 'VAT Number',
  vatPlaceholder: '123456789',
  bankName: 'Bank Name',
  bankNamePlaceholder: 'Bank Leumi',
  branchNumber: 'Branch Number',
  branchPlaceholder: '800',
  accountNumber: 'Account Number',
  accountPlaceholder: '12345678',
  branding: 'Branding',
  primaryColor: 'Primary Color',
  colorCode: 'Hex color code',
  emailSignature: 'Email Signature',
  emailSignatureHint: 'This signature will be appended to outgoing emails',
  pdfFooter: 'PDF Footer',
  pdfFooterHint: 'This text will appear at the bottom of generated PDFs',
  saving: 'Saving...',
  saveChanges: 'Save Changes',
}

export default function CompanySettingsPage() {
  const t = (key: keyof typeof strings) => strings[key]

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    fetchCompany()
  }, [])

  async function fetchCompany() {
    try {
      const res = await fetch('/api/company/profile')
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || t('loadFailed'))
      }
      const data = await res.json()
      setCompany(data)
    } catch (error: unknown) {
      showMessage('error', (error instanceof Error ? error.message : String(error)) || t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!company) return
    
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || t('saveFailed'))
      }

      const updated = await res.json()
      setCompany(updated)
      showMessage('success', t('savedSuccess'))
    } catch (error: unknown) {
      showMessage('error', (error instanceof Error ? error.message : String(error)) || t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/company/logo', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || t('logoUploadFailed'))
      }

      const { logo_url } = await res.json()
      setCompany(prev => prev ? { ...prev, logo_url } : null)
      showMessage('success', t('logoUploadSuccess'))
    } catch (error: unknown) {
      showMessage('error', (error instanceof Error ? error.message : String(error)) || t('logoUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  function updateField(field: keyof Company, value: any) {
    if (!company) return
    setCompany({ ...company, [field]: value })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p>{t('noCompany')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header with Language Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle')}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          {t('logoSection')}
        </h2>
        
        <div className="flex items-center gap-6">
          {company.logo_url ? (
            <div className="relative w-48 h-24 border-2 border-gray-200 rounded-lg p-2 bg-gray-50">
              <Image 
                src={company.logo_url} 
                alt="Company Logo" 
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-48 h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
              {t('noLogo')}
            </div>
          )}
          
          <label className="cursor-pointer">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleLogoUpload}
              disabled={uploading}
              className="hidden"
            />
            <div className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {uploading ? t('uploading') : t('uploadLogo')}
            </div>
          </label>
          <p className="text-sm text-gray-500">
            {t('logoHint')}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5 text-blue-600" />
          {t('basicInfo')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('companyName')}
            </label>
            <input 
              type="text"
              value={company.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('email')}
            </label>
            <input 
              type="email"
              value={company.primary_email || ''}
              onChange={(e) => updateField('primary_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('phone')}
            </label>
            <input 
              type="tel"
              value={company.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="050-1234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('city')}
            </label>
            <input 
              type="text"
              value={company.city || ''}
              onChange={(e) => updateField('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {t('address')}
            </label>
            <input 
              type="text"
              value={company.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder={t('addressPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Banking/Invoice Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-600" />
          {t('banking')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('vatNumber')}
            </label>
            <input 
              type="text"
              value={company.vat_number || ''}
              onChange={(e) => updateField('vat_number', e.target.value)}
              placeholder={t('vatPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('bankName')}
            </label>
            <input 
              type="text"
              value={company.bank_name || ''}
              onChange={(e) => updateField('bank_name', e.target.value)}
              placeholder={t('bankNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('branchNumber')}
            </label>
            <input 
              type="text"
              value={company.bank_branch || ''}
              onChange={(e) => updateField('bank_branch', e.target.value)}
              placeholder={t('branchPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('accountNumber')}
            </label>
            <input 
              type="text"
              value={company.bank_account || ''}
              onChange={(e) => updateField('bank_account', e.target.value)}
              placeholder={t('accountPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5 text-blue-600" />
          {t('branding')}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('primaryColor')}
            </label>
            <div className="flex items-center gap-3">
              <input 
                type="color"
                value={company.brand_color || '#2563EB'}
                onChange={(e) => updateField('brand_color', e.target.value)}
                className="h-12 w-24 cursor-pointer rounded-lg border-2 border-gray-300"
              />
              <input 
                type="text"
                value={company.brand_color || '#2563EB'}
                onChange={(e) => updateField('brand_color', e.target.value)}
                placeholder="#2563EB"
                className="px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <span className="text-sm text-gray-600">{t('colorCode')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email Signature */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          {t('emailSignature')}
        </h2>
        
        <textarea
          value={company.email_signature || ''}
          onChange={(e) => updateField('email_signature', e.target.value)}
          placeholder={`${company.name}\n${company.phone || ''}`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-500 mt-2">
          {t('emailSignatureHint')}
        </p>
      </div>

      {/* PDF Footer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          {t('pdfFooter')}
        </h2>
        
        <textarea
          value={company.pdf_footer || ''}
          onChange={(e) => updateField('pdf_footer', e.target.value)}
          placeholder={`${company.name} | ${company.phone || ''} | ${company.address || ''}`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-500 mt-2">
          {t('pdfFooterHint')}
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
        >
          <Save className="h-5 w-5" />
          {saving ? t('saving') : t('saveChanges')}
        </button>
      </div>
    </div>
  )
}

