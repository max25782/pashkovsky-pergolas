/** Shown when a non-monthly supplier document was classified as a receipt or other, so it is not loaded as a credit. */
export const AWAIT_TAX_INVOICE_MESSAGE = 'טען חשבונית מס כשמתקבלת'

export const TAX_INVOICE_WORDS_WARNING =
  'המסמך אינו מציין "חשבונית מס": ודא מול רואה החשבון שהוא מקנה קיזוז מע״מ'

export const SELLER_TAX_ID_WARNING =
  'אין מספר עוסק של המוכר במסמך. אחוז הזיכוי הוא 0 עד שתשנה אותו ידנית ותאשר מול רואה החשבון.'

export const DOC_TYPE_LABELS = {
  tax_invoice: 'חשבונית מס / חשבונית מס קבלה',
  receipt: 'קבלה',
  other: 'אחר',
} as const
