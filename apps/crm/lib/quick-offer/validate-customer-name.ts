const PLACEHOLDER_NAMES = new Set(['הצעה מהירה'])

export function normalizeCustomerNameInput(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

export function isCustomerNameValid(name: string): boolean {
  if (!name) return false
  if (PLACEHOLDER_NAMES.has(name)) return false
  return true
}

export const CUSTOMER_NAME_REQUIRED_ERROR = 'Customer name is required'
