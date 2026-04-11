'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import SignatureCanvas from 'react-signature-canvas'
import { Check, Loader2, PenLine, RotateCcw } from 'lucide-react'

interface ApproveClientProps {
  offerId: string
  offerHtml: string
  alreadyApproved: boolean
  approvedAt?: string | null
  defaultName: string
  defaultPhone: string
}

export function ApproveClient({
  offerId,
  offerHtml,
  alreadyApproved,
  approvedAt,
  defaultName,
  defaultPhone,
}: ApproveClientProps) {
  const router = useRouter()
  const params = useParams()
  const sigRef = useRef<SignatureCanvas>(null)

  const [customerName, setCustomerName] = useState(defaultName)
  const [customerPhone, setCustomerPhone] = useState(defaultPhone)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iframeHeight, setIframeHeight] = useState(1200)

  // Resize iframe to match its content height
  useEffect(() => {
    const iframe = document.getElementById('offer-preview') as HTMLIFrameElement | null
    if (!iframe) return
    function onLoad() {
      try {
        const h = iframe?.contentDocument?.documentElement?.scrollHeight
        if (h && h > 400) setIframeHeight(h + 40)
      } catch {
        // cross-origin — keep default
      }
    }
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [])

  async function handleApprove() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError('אנא חתמו על ההצעה')
      return
    }
    if (!customerName.trim()) {
      setError('אנא הזינו את שמכם')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const signatureImage = sigRef.current.toDataURL()
      const res = await fetch(`/api/offers/${offerId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureImage, customerName, customerPhone }),
      })
      if (!res.ok) throw new Error('Failed to approve offer')
      router.push(`/${params.locale}/offers/${offerId}/success`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadyApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-green-200">
          <Check className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ההצעה כבר אושרה</h1>
          {approvedAt && (
            <p className="text-gray-500 text-sm">
              אושרה בתאריך {new Date(approvedAt).toLocaleDateString('he-IL')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-2" dir="rtl">
      <div className="max-w-[860px] mx-auto space-y-0">

        {/* PDF preview — exact same HTML as the generated PDF */}
        <div className="bg-white shadow-xl rounded-t-xl overflow-hidden border border-gray-300">
          <iframe
            id="offer-preview"
            srcDoc={offerHtml}
            className="w-full border-0"
            style={{ height: iframeHeight }}
            title="הצעת מחיר"
            sandbox="allow-same-origin"
          />
        </div>

        {/* Signature section — appended below the PDF content */}
        <div className="bg-white shadow-xl rounded-b-xl border border-t-0 border-gray-300 p-6 space-y-5">
          <div className="border-t-2 border-dashed border-gray-300 pt-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-blue-600" />
              אישור וחתימה דיגיטלית
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              לאישור ההצעה — מלאו את הפרטים וחתמו למטה. לאחר האישור תוכלו להוריד עותק PDF עם החתימה.
            </p>

            {/* Name + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="הזן את שמך המלא"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="050-0000000"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Signature pad */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">חתימה *</label>
                <button
                  type="button"
                  onClick={() => sigRef.current?.clear()}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  נקה
                </button>
              </div>
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white touch-none">
                <SignatureCanvas
                  ref={sigRef}
                  canvasProps={{
                    className: 'w-full',
                    style: { display: 'block', height: 160, width: '100%' },
                  }}
                  backgroundColor="white"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">חתמו בתוך המסגרת באמצעות העכבר או האצבע</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleApprove}
              disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-md transition text-base"
            >
              {submitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> שומר...</>
                : <><Check className="w-5 h-5" /> אני מאשר/ת את ההצעה וחותם/ת דיגיטלית</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
