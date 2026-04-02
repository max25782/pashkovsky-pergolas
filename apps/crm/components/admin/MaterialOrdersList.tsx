'use client'

import { useState, useEffect } from 'react'
import type { MaterialOrder } from '@/types/material-order'
import { authFetch } from '@/lib/api/auth-fetch'

interface MaterialOrdersListProps {
  dealId: string
  adminToken?: string
}

export function MaterialOrdersList({ dealId, adminToken = '' }: MaterialOrdersListProps) {
  const [orders, setOrders] = useState<MaterialOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offerId, setOfferId] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    loadOrders()
    loadOfferId()
  }, [dealId])

  async function loadOrders() {
    try {
      setLoading(true)
      const response = await authFetch(`/api/material-orders?dealId=${dealId}`)

      if (!response.ok) {
        throw new Error('Failed to load material orders')
      }

      const data = await response.json()
      setOrders(data.orders || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadOfferId() {
    try {
      const res = await authFetch(`/api/offers?dealId=${dealId}`)
      if (!res.ok) return
      const data = await res.json()
      const offers: { id: string }[] = data.offers ?? data ?? []
      if (offers.length > 0) setOfferId(offers[0].id)
    } catch {
      // non-critical — button stays hidden
    }
  }

  async function handleGenerateCutListPdf() {
    if (!offerId) return
    setGeneratingPdf(true)
    try {
      const res = await authFetch(`/api/offers/${offerId}/cut-list-pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`שגיאה ביצירת PDF: ${err.error ?? res.statusText}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cut-list-${offerId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      alert(`שגיאה ביצירת PDF: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const cutListButton = offerId ? (
    <button
      onClick={handleGenerateCutListPdf}
      disabled={generatingPdf}
      className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
    >
      {generatingPdf ? 'מייצר...' : 'הפק רשימת חומר PDF'}
    </button>
  ) : null

  if (loading) {
    return <div className="text-white/60">טוען הזמנות חומר...</div>
  }

  if (error) {
    return <div className="text-red-400">שגיאה: {error}</div>
  }

  if (orders.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-white/60 p-4 bg-white/5 rounded-lg">
          אין הזמנות חומר עבור עסקה זו
        </div>
        {cutListButton && <div>{cutListButton}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">הזמנות חומר (חומר הוזמן)</h3>
        {cutListButton}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/20">
              <th className="text-right p-2 text-sm font-semibold text-white/70">סוג חומר</th>
              <th className="text-right p-2 text-sm font-semibold text-white/70">כמות</th>
              <th className="text-right p-2 text-sm font-semibold text-white/70">ספק</th>
              <th className="text-right p-2 text-sm font-semibold text-white/70">תאריך הזמנה</th>
              <th className="text-right p-2 text-sm font-semibold text-white/70">סטטוס</th>
              <th className="text-right p-2 text-sm font-semibold text-white/70">מחיר</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-white/10 hover:bg-white/5">
                <td className="p-2 text-white">
                  <div className="font-medium">{order.material_type}</div>
                  {order.material_description && (
                    <div className="text-sm text-white/60">{order.material_description}</div>
                  )}
                </td>
                <td className="p-2 text-white">
                  {order.quantity} {order.unit || 'יח'}
                </td>
                <td className="p-2 text-white">
                  <div>{order.supplier_name || '-'}</div>
                  {order.supplier_phone && (
                    <a
                      href={`tel:${order.supplier_phone}`}
                      className="text-sm text-white/60 hover:text-white underline"
                    >
                      {order.supplier_phone}
                    </a>
                  )}
                </td>
                <td className="p-2 text-white text-sm">
                  {new Date(order.order_date).toLocaleDateString('he-IL')}
                </td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    order.status === 'delivered' ? 'bg-green-500/20 text-green-300' :
                    order.status === 'in_transit' ? 'bg-blue-500/20 text-blue-300' :
                    order.status === 'confirmed' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    {order.status === 'ordered' ? 'הוזמן' :
                     order.status === 'confirmed' ? 'אושר' :
                     order.status === 'in_transit' ? 'בדרך' :
                     order.status === 'delivered' ? 'התקבל' :
                     'בוטל'}
                  </span>
                </td>
                <td className="p-2 text-white">
                  {order.total_price ? `₪${order.total_price.toLocaleString()}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}




