// Company Settings Types

export interface CompanySettings {
  id: string
  companyId: string
  
  // Branding
  companyName?: string
  logoUrl?: string
  primaryColor: string
  
  // Financial
  currency: string
  vatPercent: number
  
  // Default Pricing
  defaultPergolaPricePerSqm: number
  defaultSantafBasicPrice: number
  defaultSantafStructurePrice: number
  defaultZipManualPrice: number
  defaultZipElectricPrice: number
  defaultLightingPricePerMeter: number
  defaultDrainagePricePerMeter: number
  
  // PDF Templates
  paymentTermsTemplate: string
  warrantyYears: number
  warrantyCovers: string[]
  
  // Communication Templates
  whatsappTemplate: string
  emailSubjectTemplate: string
  emailBodyTemplate: string
  
  // Features (from subscription plan)
  features?: Record<string, boolean>
  
  createdAt: string
  updatedAt: string
}

export const DEFAULT_COMPANY_SETTINGS: Partial<CompanySettings> = {
  currency: '₪',
  vatPercent: 18,
  primaryColor: '#3b82f6',
  
  defaultPergolaPricePerSqm: 750,
  defaultSantafBasicPrice: 220,
  defaultSantafStructurePrice: 450,
  defaultZipManualPrice: 650,
  defaultZipElectricPrice: 800,
  defaultLightingPricePerMeter: 100,
  defaultDrainagePricePerMeter: 80,
  
  paymentTermsTemplate: 'תשלום: 40% מקדמה, 30% באמצע עבודה, 30% בסיום',
  warrantyYears: 10,
  warrantyCovers: ['מבנה אלומיניום', 'צביעה', 'מנגנונים'],
  
  whatsappTemplate: 'שלום {customerName},\n\nלצפייה ואישור הצעת המחיר שלך לחץ כאן:\n{offerUrl}\n\nתודה!\n{companyName}',
  emailSubjectTemplate: 'הצעת מחיר - {companyName}',
  emailBodyTemplate: '<p>שלום {customerName},</p><p>בצירוף הצעת המחיר שלך.</p>',
}

// Template variable replacement
export function fillTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return result
}

