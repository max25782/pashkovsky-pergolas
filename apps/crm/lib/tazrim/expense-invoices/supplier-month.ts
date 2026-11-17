import { roundMoney } from '@/lib/finance/money'

/** Shown when a monthly tax invoice is uploaded. VAT itself uses the tax invoice only. */
export function supplierMonthVariance(input: {
  taxTotal: number
  preliminaryTotals: readonly number[]
}): { taxTotal: number; preliminaryTotal: number; unallocated: number } {
  const taxTotal = roundMoney(input.taxTotal)
  const preliminaryTotal = roundMoney(input.preliminaryTotals.reduce((sum, amount) => sum + amount, 0))
  return {
    taxTotal,
    preliminaryTotal,
    unallocated: roundMoney(taxTotal - preliminaryTotal),
  }
}
