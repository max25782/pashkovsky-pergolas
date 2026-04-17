'use client'

/**
 * Example: FinanceBlock with mock state (for Storybook / manual QA).
 * Not used in production routes.
 */
import { useState } from 'react'
import { FinanceBlock, type FinanceBlockLabels } from './FinanceBlock'

const mockLabels: FinanceBlockLabels = {
  clientPrice: 'Project price',
  totalCosts: 'Material & direct (deal field)',
  profit: 'Profit',
  margin: 'Margin',
  warnNoCostsYet: 'Profit is not accurate (no costs yet)',
  warnAddPriceCosts: 'Add price and costs to see profit',
  warnZeroCostsNoMargin: 'Enter your costs — margin is not meaningful while costs are ₪0',
  placeholderPrice: 'Enter project price',
  placeholderCosts: 'Enter your costs',
  costBreakdownTitle: 'Cost breakdown (system)',
  laborFromShifts: 'Labor (work shifts)',
  materialOrdersFromSystem: 'Material orders total (from system)',
  materialOrdersOrderCountTemplate: '{count} orders',
  noMaterialOrdersDash: '—',
  totalInternalForProfit: 'Total for profit below',
  loadingBreakdown: '…',
  financeProfitFootnote:
    'Profit uses the field above plus shift labor. Material orders total is for reference.',
}

function formatILS(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)
}

export function FinanceBlockExample() {
  const [clientPrice, setClientPrice] = useState<number | null>(120000)
  const [totalCosts, setTotalCosts] = useState<number | null>(78000)

  return (
    <div className="max-w-2xl space-y-4 bg-gray-950 p-6">
      <p className="text-sm text-white/50">Mock example — adjust numbers to see warnings.</p>
      <FinanceBlock
        clientPrice={clientPrice}
        totalCosts={totalCosts}
        onClientPriceChange={setClientPrice}
        onTotalCostsChange={setTotalCosts}
        formatCurrency={formatILS}
        labels={mockLabels}
      />
    </div>
  )
}
