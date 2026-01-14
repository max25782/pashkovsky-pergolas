'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Company {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  primary_email?: string
  created_at: string
}

interface CompanySettingsFormProps {
  companyId: string
}

export function CompanySettingsForm({ companyId }: CompanySettingsFormProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    primary_email: '',
    status: 'active' as 'trial' | 'active' | 'suspended' | 'cancelled',
    plan: '',
  })
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null)

  useEffect(() => {
    loadCompany()
  }, [companyId])

  async function loadCompany() {
    try {
      const response = await fetch(`/api/superadmin/companies/${companyId}/settings`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load company')
      }

      const data = await response.json()
      setCompany(data)
      setFormData({
        name: data.name || '',
        primary_email: data.primary_email || '',
        status: data.status || 'active',
        plan: data.plan || '',
      })
    } catch (error: any) {
      console.error('[CompanySettingsForm] Load error:', error)
      setResult({
        success: false,
        message: error.message || 'Failed to load company settings',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setResult(null)

    try {
      const response = await fetch(`/api/superadmin/companies/${companyId}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update company')
      }

      setResult({
        success: true,
        message: 'Company settings updated successfully',
      })

      // Reload company data
      await loadCompany()

      // Clear success message after 3 seconds
      setTimeout(() => {
        setResult(null)
      }, 3000)
    } catch (error: any) {
      console.error('[CompanySettingsForm] Save error:', error)
      setResult({
        success: false,
        message: error.message || 'Failed to update company settings',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading company settings...</span>
      </div>
    )
  }

  if (!company) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load company settings
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="!text-black font-medium">
          Company Name
        </Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          disabled={saving}
          className="bg-white border-gray-300 !text-black"
        />
      </div>

      {/* Primary Email */}
      <div className="space-y-2">
        <Label htmlFor="primary_email" className="!text-black font-medium">
          Primary Email
        </Label>
        <Input
          id="primary_email"
          type="email"
          value={formData.primary_email}
          onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
          disabled={saving}
          className="bg-white border-gray-300 !text-black"
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status" className="!text-black font-medium">
          Status
        </Label>
        <select
          id="status"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
          disabled={saving}
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-black"
        >
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Plan */}
      <div className="space-y-2">
        <Label htmlFor="plan" className="!text-black font-medium">
          Plan
        </Label>
        <Input
          id="plan"
          type="text"
          value={formData.plan}
          onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
          placeholder="trial, enterprise, etc."
          disabled={saving}
          className="bg-white border-gray-300 !text-black"
        />
      </div>

      {/* Result Message */}
      {result && (
        <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          {result.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle className={result.success ? 'text-green-900' : 'text-red-900'}>
            {result.success ? 'Success' : 'Error'}
          </AlertTitle>
          <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
            {result.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button
          type="submit"
          disabled={saving}
          className="!bg-blue-600 !text-white hover:!bg-blue-700"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  )
}




