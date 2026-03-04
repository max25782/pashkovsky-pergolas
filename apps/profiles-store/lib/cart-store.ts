'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useEffect, useState } from 'react'

export interface CartItem {
  profileId: string
  code: string
  color: string
  length: number
  quantity: number
  pricePerPiece: number
  weightPerPiece: number
  imageUrl?: string
}

interface CartStore {
  items: CartItem[]
  _hydrated: boolean
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  removeItem: (profileId: string, color: string, length: number) => void
  updateQuantity: (profileId: string, color: string, length: number, quantity: number) => void
  clear: () => void
  totalItems: () => number
  totalPrice: () => number
  totalWeight: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      _hydrated: false,
      addItem: (item, quantity) => {
        const existing = get().items.find(
          (i) =>
            i.profileId === item.profileId &&
            i.color === item.color &&
            i.length === item.length
        )
        if (existing) {
          set({
            items: get().items.map((i) =>
              i === existing ? { ...i, quantity: i.quantity + quantity } : i
            ),
          })
        } else {
          set({ items: [...get().items, { ...item, quantity }] })
        }
      },
      removeItem: (profileId, color, length) => {
        set({
          items: get().items.filter(
            (i) =>
              !(i.profileId === profileId && i.color === color && i.length === length)
          ),
        })
      },
      updateQuantity: (profileId, color, length, quantity) => {
        if (quantity <= 0) {
          get().removeItem(profileId, color, length)
          return
        }
        set({
          items: get().items.map((i) =>
            i.profileId === profileId && i.color === color && i.length === length
              ? { ...i, quantity }
              : i
          ),
        })
      },
      clear: () => {
        set({ items: [] })
      },
      totalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },
      totalPrice: () => {
        return get().items.reduce((sum, item) => sum + item.quantity * item.pricePerPiece, 0)
      },
      totalWeight: () => {
        return get().items.reduce((sum, item) => sum + item.quantity * (item.weightPerPiece ?? 0), 0)
      },
    }),
    {
      name: 'profiles-cart-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migrate old cart items that were saved before weightPerPiece was added
          state.items = state.items.map((item) => ({
            ...item,
            weightPerPiece: item.weightPerPiece ?? 0,
            pricePerPiece: item.pricePerPiece ?? 0,
          }))
        }
        useCart.setState({ _hydrated: true })
      },
    }
  )
)

/**
 * Returns true only after Zustand has rehydrated from localStorage.
 * Use this to avoid server/client hydration mismatches in components
 * that render differently based on cart state.
 */
export function useCartHydrated(): boolean {
  const hydrated = useCart((s) => s._hydrated)
  // Fallback: also track via useEffect in case onRehydrateStorage fires
  // before the component mounts (race condition on fast devices).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return hydrated || mounted
}
