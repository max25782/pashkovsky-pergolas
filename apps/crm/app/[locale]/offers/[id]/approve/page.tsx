"use client"

import { useToast } from '@/components/ui/toast'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SignatureCanvas from 'react-signature-canvas'
import { formatPrice } from '@/types/offer'
import type { Offer, PergolaShape } from '@/types/offer'
import { Check, Loader2 } from 'lucide-react'

// Helper to render pergola dimensions based on shape
function renderPergolaDimensions(shape: PergolaShape) {
  switch (shape.type) {
    case 'rectangle':
      return (
        <>
          <div><span className="font-medium">רוחב:</span> {shape.width} מ׳</div>
          <div><span className="font-medium">אורך:</span> {shape.length} מ׳</div>
        </>
      )
    case 'L':
      return (
        <>
          <div className="col-span-2"><span className="font-medium">צורה:</span> L</div>
          <div><span className="font-medium">רגל 1 - רוחב:</span> {shape.leg1.width} מ׳</div>
          <div><span className="font-medium">רגל 1 - אורך:</span> {shape.leg1.length} מ׳</div>
          <div><span className="font-medium">רגל 2 - רוחב:</span> {shape.leg2.width} מ׳</div>
          <div><span className="font-medium">רגל 2 - אורך:</span> {shape.leg2.length} מ׳</div>
        </>
      )
    case 'X':
      return (
        <>
          <div className="col-span-2"><span className="font-medium">צורה:</span> X</div>
          <div><span className="font-medium">מרכז - רוחב:</span> {shape.center.width} מ׳</div>
          <div><span className="font-medium">מרכז - אורך:</span> {shape.center.length} מ׳</div>
          {shape.arms.map((arm, i) => (
            <div key={i} className="col-span-2">
              <span className="font-medium">זרוע {i + 1} ({arm.direction}):</span> {arm.width} × {arm.length} מ׳
            </div>
          ))}
        </>
      )
    case 'U':
      return (
        <>
          <div className="col-span-2"><span className="font-medium">צורה:</span> U</div>
          <div><span className="font-medium">בסיס - רוחב:</span> {shape.base.width} מ׳</div>
          <div><span className="font-medium">בסיס - אורך:</span> {shape.base.length} מ׳</div>
          <div><span className="font-medium">רגל שמאל:</span> {shape.leftLeg.width} × {shape.leftLeg.length} מ׳</div>
          <div><span className="font-medium">רגל ימין:</span> {shape.rightLeg.width} × {shape.rightLeg.length} מ׳</div>
        </>
      )
    default:
      return null
  }
}

export default function OfferApprovePage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const signaturePadRef = useRef<SignatureCanvas>(null)
  
  const [offer, setOffer] = useState<Offer | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  useEffect(() => {
    fetchOffer()
  }, [])

  async function fetchOffer() {
    try {
      // Use public endpoint (no authentication required)
      const response = await fetch(`/api/public/offers/${params.id}`)
      if (!response.ok) {
        throw new Error('Offer not found')
      }
      const data = await response.json()
      setOffer(data)
      setCustomerName(data.customerName || '')
      setCustomerPhone(data.customerPhone || '')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function clearSignature() {
    signaturePadRef.current?.clear()
  }

  async function handleApprove() {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toast.error('אנא חתמו על ההצעה')
      return
    }

    if (!customerName.trim()) {
      toast.error('אנא הזינו את שמכם')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const signatureImage = signaturePadRef.current.toDataURL()

      const response = await fetch(`/api/offers/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureImage,
          customerName,
          customerPhone,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to approve offer')
      }

      // Redirect to success page
      router.push(`/${params.locale}/offers/${params.id}/success`)
    } catch (err: unknown) {
      console.error('Error approving offer:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">שגיאה</h1>
          <p className="text-gray-600">{error || 'הצעה לא נמצאה'}</p>
        </div>
      </div>
    )
  }

  if (offer.approval.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ההצעה כבר אושרה</h1>
          <p className="text-gray-600 mb-4">
            ההצעה אושרה בתאריך {new Date(offer.approval.approvedAt!).toLocaleDateString('he-IL')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
            <h1 className="text-3xl font-bold text-center">הצעת מחיר</h1>
            <p className="text-center text-blue-100 mt-2">Pashkovsky Group</p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Description / Notes - AI Generated or Custom (FIRST!) */}
            {offer.options?.notes && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-xl p-6 shadow-lg">
                <h2 className="text-xl font-bold mb-4 text-indigo-900 flex items-center gap-2">
                  <span className="text-2xl">✨</span>
                  <span>תיאור ההצעה</span>
                </h2>
                <div className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {offer.options.notes}
                </div>
              </div>
            )}

            {/* Client Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-900">פרטי לקוח</h2>
              <div className="space-y-2 text-sm text-gray-700">
                <div><span className="font-medium">שם:</span> {offer.customerName}</div>
                {offer.customerPhone && <div><span className="font-medium">טלפון:</span> {offer.customerPhone}</div>}
                {offer.customerCity && <div><span className="font-medium">עיר:</span> {offer.customerCity}</div>}
              </div>
            </div>

            {/* Pergola Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-900">פרטי פרגולה</h2>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                {(() => {
                  const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
                  if (pergolas.length === 0) {
                    return <div className="col-span-2 text-gray-500">ללא פרגולה</div>
                  }
                  
                  return pergolas.map((pergola, index) => (
                    <div key={index} className={`${pergolas.length > 1 ? 'col-span-2 border-b border-gray-200 pb-3 mb-3' : ''}`}>
                      {pergolas.length > 1 && (
                        <div className="font-semibold text-gray-800 mb-2">פרגולה #{index + 1}</div>
                      )}
                      {renderPergolaDimensions(pergola.shape)}
                      {pergola.height && <div><span className="font-medium">גובה:</span> {pergola.height} מ׳</div>}
                      {pergola.location && <div><span className="font-medium">מקום:</span> {pergola.location}</div>}
                    </div>
                  ))
                })()}
                {offer.shadingRatio && <div><span className="font-medium">הצללה:</span> {offer.shadingRatio}</div>}
                {(offer.finishType || offer.finishValue) && (
                  <div className="col-span-2">
                    <span className="font-medium">גמר:</span>{' '}
                    {offer.finishType === 'ral' ? 'RAL ' : 'דמוי עץ '}
                    {offer.finishValue || ''}
                  </div>
                )}
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <span className="font-medium">שטח כולל:</span> {offer.area} מ״ר
                </div>
                {offer.winterClosure?.enabled && offer.winterClosure.items && offer.winterClosure.items.length > 0 && (
                  <>
                    <div className="col-span-2 pt-2 border-t border-gray-200">
                      <span className="font-medium">סגירת חורף (זכוכית):</span>
                    </div>
                    {offer.winterClosure.glassType && (
                      <div className="col-span-2">
                        <span className="font-medium">סוג זכוכית:</span>{' '}
                        {offer.winterClosure.glassType === 'tempered' ? 'מחוסם' : 
                         offer.winterClosure.glassType === 'triplex' ? 'טריפלקס' : 
                         offer.winterClosure.glassType === 'insulated' ? 'בידודית' : 
                         offer.winterClosure.glassType}
                      </div>
                    )}
                    {offer.winterClosure.items.map((item: any, index: number) => {
                      const typeNames: Record<string, string> = {
                        fixedGlass: 'זכוכית קבועה',
                        windows7000: 'חלונות 7000',
                        windows9000: 'חלונות 9000',
                        slidingShowcase7000: 'ויטרינה הזזה דגם 7000',
                        slidingShowcase9000: 'ויטרינה הזזה דגם 9000',
                        foldingGlass: 'זכוכית מתקפלת'
                      };
                      const typeName = typeNames[item.type] || item.type;
                      return (
                        <div key={index} className="col-span-2 text-sm">
                          <span className="font-medium">{typeName}:</span>{' '}
                          {item.area.toFixed(2)} מ״ר
                          {item.notes && <span className="text-gray-600"> ({item.notes})</span>}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-200">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">תמחור</h2>
              <div className="space-y-2 text-sm text-gray-700">
                {offer.pergolaTotal ? (
                  <div className="flex justify-between">
                    <span>פרגולה:</span>
                    <span className="font-semibold text-gray-900">{formatPrice(offer.pergolaTotal)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>סנטף BH:</span>
                  <span className="font-semibold text-gray-900">{formatPrice(offer.santafTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>מסך ZIP:</span>
                  <span className="font-semibold text-gray-900">{formatPrice(offer.zipScreenTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>תאורה:</span>
                  <span className="font-semibold text-gray-900">{formatPrice(offer.lightingTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ניקוז:</span>
                  <span className="font-semibold text-gray-900">{formatPrice(offer.drainageTotal)}</span>
                </div>
                {offer.winterClosure?.enabled && offer.winterClosure.items && offer.winterClosure.items.length > 0 && (
                  <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-200">
                    <span>סה״כ סגירת חורף:</span>
                    <span>{formatPrice(offer.winterClosureTotal)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold text-gray-800 pt-2 border-t border-blue-200">
                  <span>לפני מע״מ:</span>
                  <span className="text-blue-600">{formatPrice(offer.totalBeforeVat)}</span>
                </div>
                <div className="flex justify-between">
                  <span>מע״מ (18%):</span>
                  <span className="font-semibold">+{formatPrice(offer.vatAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-800 pt-1 border-t border-blue-200">
                  <span>אחרי מע״מ:</span>
                  <span className="text-green-600">{formatPrice(offer.priceWithVat)}</span>
                </div>

                <div className="flex justify-between text-red-600 pt-2">
                  <span>הנחה ({offer.discountPercent}%):</span>
                  <span className="font-semibold">
                    {offer.discountPercent > 0 ? `-${formatPrice(offer.discountAmount)}` : formatPrice(0)}
                  </span>
                </div>

                <div className="flex justify-between text-2xl font-bold text-green-700 pt-3 border-t-2 border-blue-300">
                  <span>מחיר סופי:</span>
                  <span>{formatPrice(offer.finalPrice)}</span>
                </div>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-2 text-gray-900">תנאי תשלום:</h2>
              <p className="text-sm text-gray-700">{offer.paymentTerms.text}</p>
            </div>

            {/* Warranty */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-2 text-gray-900">אחריות:</h2>
              <p className="text-sm text-gray-700">
                {offer.warranty.years} שנים על {offer.warranty.covers.join(', ')}
              </p>
            </div>

            {/* Customer Input */}
            <div className="space-y-4 pt-6 border-t-2 border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="הזן את שמך המלא"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="מספר טלפון"
                />
              </div>
            </div>

            {/* Signature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">חתימה *</label>
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={signaturePadRef}
                  canvasProps={{
                    width: 600,
                    height: 200,
                    className: 'signature-canvas w-full'
                  }}
                />
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
              >
                נקה חתימה
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-lg shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>שומר...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>מאשר את ההצעה</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

