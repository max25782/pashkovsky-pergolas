import { normalizeSupplierName } from '@/lib/tazrim/expense-invoices/validate'

export interface VendorNameHit {
  id: string
  name: string
  exact: boolean
}

function levenshtein(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index)
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = rows[0]
    rows[0] = rightIndex
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = rows[leftIndex]
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      rows[leftIndex] = Math.min(rows[leftIndex] + 1, rows[leftIndex - 1] + 1, previous + cost)
      previous = current
    }
  }
  return rows[left.length]
}

/** Exact name, or a close name the user should pick instead of creating a duplicate. */
export function vendorNameSuggestions(
  supplierName: string,
  vendors: readonly { id: string; name: string }[],
): VendorNameHit[] {
  const wanted = normalizeSupplierName(supplierName)
  if (!wanted) return []
  const tokens = wanted.split(' ').filter((token) => token.length >= 3)
  const hits: VendorNameHit[] = []
  for (const vendor of vendors) {
    const name = normalizeSupplierName(vendor.name)
    if (!name) continue
    if (name === wanted) {
      hits.push({ id: vendor.id, name: vendor.name, exact: true })
      continue
    }
    const otherTokens = name.split(' ').filter((token) => token.length >= 3)
    const sharedToken = tokens.some((token) => otherTokens.includes(token))
    const contains =
      (wanted.length >= 4 && name.includes(wanted)) || (name.length >= 4 && wanted.includes(name))
    const distance = Math.abs(wanted.length - name.length) > 3 ? 99 : levenshtein(wanted, name)
    const close = distance <= (Math.max(wanted.length, name.length) <= 8 ? 1 : 2)
    if (sharedToken || contains || close) hits.push({ id: vendor.id, name: vendor.name, exact: false })
  }
  return hits
}
