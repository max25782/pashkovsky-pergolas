'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  profileId: string
  code: string
  color: string
  length: number
  quantity: number
  pricePerPiece: number
  imageUrl?: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  removeItem: (profileId: string, color: string, length: number) => void
  updateQuantity: (profileId: string, color: string, length: number, quantity: number) => void
  clear: () => void
  totalItems: () => number
  totalPrice: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
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
    }),
    {
      name: 'profiles-cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
