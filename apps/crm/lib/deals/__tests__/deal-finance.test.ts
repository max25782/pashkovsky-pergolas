import {
  allocateByPayments,
  computeDealFinance,
  normalizeVatPercent,
  splitVat,
  vatPayableByPaymentMonth,
} from '../deal-finance'
import { roundMoney, splitByWeights } from '@/lib/finance/money'

describe('splitVat', () => {
  it('divides by (1 + rate) instead of taking a percent of the gross', () => {
    expect(splitVat(118000, 18)).toEqual({ net: 100000, vat: 18000 })
    expect(splitVat(59000, 18)).toEqual({ net: 50000, vat: 9000 })
  })

  it('follows the company rate, not a constant', () => {
    expect(splitVat(117000, 17)).toEqual({ net: 100000, vat: 17000 })
    expect(splitVat(100, 0)).toEqual({ net: 100, vat: 0 })
  })

  it('falls back to 18 only when no rate is saved, and rejects a bad rate', () => {
    expect(normalizeVatPercent(null)).toBe(18)
    expect(normalizeVatPercent('17')).toBe(17)
    expect(() => normalizeVatPercent(-1)).toThrow(RangeError)
    expect(() => normalizeVatPercent('abc')).toThrow(RangeError)
  })
})

describe('computeDealFinance', () => {
  it('price 118 000, materials 59 000, workers 10 000', () => {
    const f = computeDealFinance({ price: 118000, materials: 59000, labor: 10000, vatPercent: 18 })
    expect(f.priceNet).toBe(100000)
    expect(f.vatOnSale).toBe(18000)
    expect(f.materialsNet).toBe(50000)
    expect(f.vatOnMaterials).toBe(9000)
    expect(f.vatPayable).toBe(9000)
    expect(f.profitWithVat).toBe(49000)
    expect(f.netProfit).toBe(40000)
  })

  it('a deal without materials leaves the whole sale VAT payable', () => {
    const f = computeDealFinance({ price: 59000, materials: null, labor: 5000, vatPercent: 18 })
    expect(f.materialsNet).toBe(0)
    expect(f.vatOnMaterials).toBe(0)
    expect(f.priceNet).toBe(50000)
    expect(f.vatPayable).toBe(9000)
    expect(f.profitWithVat).toBe(54000)
    expect(f.netProfit).toBe(45000)
  })

  it('a discounted deal: the price entering the deal is already after the discount', () => {
    // 100 000 before VAT, 10% discount -> 90 000 + 18% VAT = 106 200 client price.
    const f = computeDealFinance({ price: 106200, materials: 40000, labor: 20000, vatPercent: 18 })
    expect(f.priceNet).toBe(90000)
    expect(f.vatOnSale).toBe(16200)
    expect(f.materialsNet).toBe(33898.31)
    expect(f.vatOnMaterials).toBe(6101.69)
    expect(f.vatPayable).toBe(10098.31)
    expect(f.profitWithVat).toBe(46200)
    expect(f.netProfit).toBe(36101.69)
  })

  it('shows a refund as a negative VAT, never zero', () => {
    const f = computeDealFinance({ price: 11800, materials: 59000, labor: 0, vatPercent: 18 })
    expect(f.vatPayable).toBe(-7200) // 1 800 on the sale - 9 000 on materials
    expect(f.netProfit).toBe(-40000)
  })

  it('takes string amounts from the database and treats null as zero', () => {
    const f = computeDealFinance({ price: '118000.00', materials: '59000', labor: null, vatPercent: 18 })
    expect(f.vatPayable).toBe(9000)
    expect(f.netProfit).toBe(50000)
  })

  it('does not subtract VAT from workers', () => {
    const withWorkers = computeDealFinance({ price: 118000, materials: 59000, labor: 2500, vatPercent: 18 })
    expect(withWorkers.vatPayable).toBe(9000)
    expect(withWorkers.netProfit).toBe(47500)
  })
})

describe('roundMoney / splitByWeights', () => {
  it('rounds half away from zero in agorot', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(1640.625)).toBe(1640.63)
    expect(roundMoney(-1640.625)).toBe(-1640.63)
    expect(roundMoney(Number.NaN)).toBe(0)
  })

  it('splits into whole agorot that add up exactly', () => {
    const parts = splitByWeights(100, [1, 1, 1])
    expect(parts.reduce((s, x) => s + x, 0)).toBeCloseTo(100, 10)
    expect(parts).toEqual([33.34, 33.33, 33.33])
  })
})

describe('allocateByPayments', () => {
  const payments = [
    { id: 'p1', amount: 59000 },
    { id: 'p2', amount: 59000 },
  ]

  it('splits the VAT in proportion to the received amounts, adding up exactly when fully paid', () => {
    const parts = allocateByPayments(9000, 118000, payments)
    expect(parts.get('p1')).toBe(4500)
    expect(parts.get('p2')).toBe(4500)
  })

  it('carries only the received share while the deal is not fully paid', () => {
    const parts = allocateByPayments(9000, 118000, [{ id: 'p1', amount: 59000 }])
    expect(parts.get('p1')).toBe(4500)
  })

  it('never exceeds the total when payments add up to more than the price', () => {
    const parts = allocateByPayments(9000, 100000, [
      { id: 'p1', amount: 80000 },
      { id: 'p2', amount: 40000 },
    ])
    const sum = [...parts.values()].reduce((s, x) => s + x, 0)
    expect(sum).toBeCloseTo(9000, 10)
  })

  it('allocates nothing without payments or without a price', () => {
    expect([...allocateByPayments(9000, 118000, []).values()]).toEqual([])
    expect(allocateByPayments(9000, 0, payments).get('p1')).toBe(0)
  })

  it('keeps a negative (refund) total negative', () => {
    const parts = allocateByPayments(-7200, 11800, [{ id: 'p1', amount: 11800 }])
    expect(parts.get('p1')).toBe(-7200)
  })
})

describe('vatPayableByPaymentMonth', () => {
  it('puts each payment share in the month the money was received', () => {
    const f = computeDealFinance({ price: 118000, materials: 59000, labor: 10000, vatPercent: 18 })
    const byMonth = vatPayableByPaymentMonth(f, [
      { id: 'p1', amount: 47200, paidAt: '2026-10-28T10:00:00Z' },
      { id: 'p2', amount: 70800, paidAt: '2026-11-03T10:00:00Z' },
    ])
    expect(byMonth.get('2026-10')).toBe(3600)
    expect(byMonth.get('2026-11')).toBe(5400)
  })
})
