'use client'

import React, { useState, useEffect } from 'react'
import type { Offer } from '@/types/offer'

/**
 * Get revenue from offers for a project
 * Returns the highest finalPrice from approved offers, or 0 if none
 */
export function useProjectRevenue(dealId: string): number {
  const [revenue, setRevenue] = useState(0)

  useEffect(() => {
    async function fetchRevenue() {
      try {
        const response = await fetch(`/api/offers?dealId=${dealId}`)
        if (!response.ok) return
        const { offers } = await response.json()
        
        if (offers && offers.length > 0) {
          // Get the highest finalPrice from approved offers, or highest from all
          const approvedOffers = offers.filter((o: Offer) => o.approval?.approved)
          const offersToUse = approvedOffers.length > 0 ? approvedOffers : offers
          const maxPrice = Math.max(...offersToUse.map((o: Offer) => o.finalPrice || 0))
          setRevenue(maxPrice > 0 ? maxPrice : 0)
        }
      } catch (err) {
        console.error('Error fetching revenue:', err)
      }
    }

    if (dealId) {
      fetchRevenue()
    }
  }, [dealId])

  return revenue
}






