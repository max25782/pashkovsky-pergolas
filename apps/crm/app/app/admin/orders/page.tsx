'use client'

import { useLanguage } from '@/lib/language-context'
import { useTranslations } from 'next-intl'
import { OrderCard } from '@/components/admin/orders/OrderCard'
import { OrderEditModal } from '@/components/admin/orders/OrderEditModal'
import { useOrders } from '@/components/admin/orders/useOrders'
import type { Language } from '@/components/admin/orders/order-constants'

export default function OrdersPage() {
  const { language } = useLanguage()
  const lang = language as Language
  const tOrders = useTranslations('orders')

  const {
    orders,
    loading,
    editingOrder,
    setEditingOrder,
    handleSaveOrder,
    handleUpdateItemPrice,
    handleDeleteOrder,
    handleGeneratePdf,
  } = useOrders(lang)

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
        <div className="container py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white/60">{tOrders('loadingOrders')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="container py-8">
        <h1 className="text-4xl font-bold mb-8">
          {tOrders('profileOrdersTitle')}
        </h1>

        {orders.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center text-white/60">
            {tOrders('noOrders')}
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                lang={lang}
                onEdit={setEditingOrder}
                onDelete={handleDeleteOrder}
                onGeneratePdf={handleGeneratePdf}
              />
            ))}
          </div>
        )}

        {editingOrder !== null && (
          <OrderEditModal
            order={editingOrder}
            lang={lang}
            onClose={() => setEditingOrder(null)}
            onSave={handleSaveOrder}
            onUpdateItemPrice={handleUpdateItemPrice}
          />
        )}
      </div>
    </main>
  )
}
