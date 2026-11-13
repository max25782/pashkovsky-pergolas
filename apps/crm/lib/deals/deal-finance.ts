/**
 * Deal VAT and profit: the single place for the formulas.
 *
 * Money in a deal as stored:
 *   price      client price, VAT included, after any discount (deals.price)
 *   materials  material cost, VAT included (deals.my_cost)
 *   labor      worker cost, no VAT, already with the employer coefficient
 *
 * CRM cards, statistics, the profit ranking and Tazrim all call this module.
 * Pure: no React, no Supabase.
 */

import { roundMoney, splitByWeights, toAmount } from '@/lib/finance/money'

/** Used only when the company has no vat_percent saved (company_settings.vat_percent). */
export const DEFAULT_VAT_PERCENT = 18

export interface DealFinanceInput {
  price: number | string | null | undefined
  materials: number | string | null | undefined
  labor: number | string | null | undefined
  vatPercent: number
}

export interface DealFinance {
  vatPercent: number
  /** Client price, VAT included. */
  price: number
  priceNet: number
  vatOnSale: number
  /** Material cost, VAT included. */
  materials: number
  materialsNet: number
  vatOnMaterials: number
  /** Workers: no VAT. */
  labor: number
  /** vatOnSale - vatOnMaterials. Negative means a refund is due; never clamped to 0. */
  vatPayable: number
  /** price - materials - labor, all as entered (VAT included). */
  profitWithVat: number
  /** priceNet - materialsNet - labor. */
  netProfit: number
}

export function normalizeVatPercent(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return DEFAULT_VAT_PERCENT
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(`Invalid VAT percent: ${String(value)}`)
  }
  return n
}

/**
 * Takes the VAT out of an amount that includes it: net = gross / (1 + rate),
 * vat = gross - net. Never "gross minus rate percent of gross".
 * 118 000 at 18% -> net 100 000, vat 18 000.
 */
export function splitVat(
  gross: number,
  vatPercent: number,
): { net: number; vat: number } {
  const rate = normalizeVatPercent(vatPercent) / 100
  const net = roundMoney(gross / (1 + rate))
  return { net, vat: roundMoney(gross - net) }
}

export function computeDealFinance(input: DealFinanceInput): DealFinance {
  const vatPercent = normalizeVatPercent(input.vatPercent)
  const price = roundMoney(toAmount(input.price))
  const materials = roundMoney(toAmount(input.materials))
  const labor = roundMoney(toAmount(input.labor))

  const sale = splitVat(price, vatPercent)
  const material = splitVat(materials, vatPercent)

  return {
    vatPercent,
    price,
    priceNet: sale.net,
    vatOnSale: sale.vat,
    materials,
    materialsNet: material.net,
    vatOnMaterials: material.vat,
    labor,
    vatPayable: roundMoney(sale.vat - material.vat),
    profitWithVat: roundMoney(price - materials - labor),
    netProfit: roundMoney(sale.net - material.net - labor),
  }
}

export interface PaymentForAllocation {
  id: string
  amount: number
}

/**
 * Spreads a deal-level amount (VAT payable, net profit, ...) over the deal's
 * payments in proportion to what was received. A payment of 40 000 on a
 * 118 000 deal carries 40 000 / 118 000 of the amount; payments that do not
 * yet cover the price leave the rest unallocated. If payments add up to more
 * than the price they are scaled down to the price, so the total is never
 * exceeded. The parts add up exactly to the allocated total in agorot.
 */
export function allocateByPayments(
  total: number,
  price: number,
  payments: readonly PaymentForAllocation[],
): Map<string, number> {
  const result = new Map<string, number>()
  const received = payments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0)
  if (price <= 0 || received <= 0) {
    payments.forEach((p) => result.set(p.id, 0))
    return result
  }

  const denominator = Math.max(price, received)
  const allocatedTotal = (total * received) / denominator
  const parts = splitByWeights(
    allocatedTotal,
    payments.map((p) => (p.amount > 0 ? p.amount : 0)),
  )
  payments.forEach((p, index) => result.set(p.id, parts[index]))
  return result
}

/** "YYYY-MM" of an ISO date or timestamp. */
export function monthOfDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export interface DatedPayment extends PaymentForAllocation {
  /** ISO date or timestamp the money was received. */
  paidAt: string
}

/**
 * VAT payable of one deal by the month each payment was received. A deal
 * without payments carries nothing: Tazrim places a payment-less deal on its
 * own forecast date instead.
 */
export function vatPayableByPaymentMonth(
  finance: Pick<DealFinance, 'price' | 'vatPayable'>,
  payments: readonly DatedPayment[],
): Map<string, number> {
  const perPayment = allocateByPayments(finance.vatPayable, finance.price, payments)
  const byMonth = new Map<string, number>()
  for (const payment of payments) {
    const month = monthOfDate(payment.paidAt)
    byMonth.set(
      month,
      roundMoney((byMonth.get(month) ?? 0) + (perPayment.get(payment.id) ?? 0)),
    )
  }
  return byMonth
}
