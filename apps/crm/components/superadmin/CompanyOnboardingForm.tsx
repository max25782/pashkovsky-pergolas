'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface OnboardingResponse {
  success: boolean
  company_id?: string
  user_id?: string
  company_name?: string
  error?: string
}

export default function CompanyOnboardingForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OnboardingResponse | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      console.log('[CompanyOnboardingForm] Submitting:', email)
      
      const response = await fetch('/api/superadmin/companies/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      })
      
      console.log('[CompanyOnboardingForm] Response status:', response.status)

      let data: OnboardingResponse
      
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('[CompanyOnboardingForm] JSON parse error:', jsonError)
        throw new Error(`Server returned status ${response.status}, but response was not JSON`)
      }

      if (!response.ok) {
        console.error('[CompanyOnboardingForm] Error response:', data)
        throw new Error(data.error || `Request failed with status ${response.status}`)
      }

      console.log('[CompanyOnboardingForm] Success response:', data)
      setResult(data)
      
      // Refresh the page to show new company in the list
      setTimeout(() => {
        window.location.reload()
      }, 3000) // Wait 3 seconds to show success message
      
    } catch (error: any) {
      console.error('[CompanyOnboardingForm] Error:', error)
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Unknown error'
      
      if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to reach server. Please check your connection and try again.'
      } else if (error.message?.includes('NetworkError')) {
        errorMessage = 'Network error: Request was interrupted. Please try again.'
      }
      
      setResult({
        success: false,
        error: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="!bg-white !border-gray-200 !text-black">
      <CardHeader>
        <CardTitle className="text-xl font-medium !text-black">Manual Company Onboarding</CardTitle>
        <CardDescription className="!text-black">
          Create a new company and grant full enterprise access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="!text-black font-medium">
              User Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              disabled={loading}
              className="bg-white border-gray-300 !text-black placeholder:text-gray-500"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full !bg-blue-600 !text-white hover:!bg-blue-700 !border-transparent disabled:!opacity-50 disabled:!cursor-not-allowed"
            onClick={() => {
              console.log('[Button] Clicked! Email:', email, 'Loading:', loading, 'Disabled:', loading || !email)
            }}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating company...
              </>
            ) : (
              'Create Company + Give Full Access'
            )}
          </Button>
          
          {/* Debug info */}
          {!email && (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ Enter email to enable the button
            </p>
          )}
        </form>

        {result && (
          <div className="mt-6">
            {result.success ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900">Success!</AlertTitle>
                <AlertDescription className="space-y-2 text-black">
                  <p className="text-black">
                    Company <strong className="text-black font-semibold">{result.company_name}</strong> created successfully.
                  </p>
                  <p className="text-sm text-black">
                    Company ID: <span className="font-mono">{result.company_id}</span>
                  </p>
                  <p className="text-sm text-black">
                    User ID: <span className="font-mono">{result.user_id}</span>
                  </p>
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-900 font-medium">
                      ✓ Company created successfully with full enterprise access
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      User can now log in using their email and password, or you can generate a magic link separately.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-900">Error</AlertTitle>
                <AlertDescription className="text-red-800">
                  {result.error || 'Onboarding failed'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
