// Subscription Plans and Usage Types

export type PlanName = 'free' | 'basic' | 'pro'

export interface SubscriptionPlan {
  id: string
  name: PlanName
  displayName: string
  description?: string
  
  // Pricing
  priceMonthly: number
  priceYearly?: number
  currency: string
  
  // Limits
  maxUsers?: number // null = unlimited
  maxDealsPerMonth?: number
  maxStorageMb?: number
  
  // Features
  features: PlanFeatures
  
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PlanFeatures {
  pdfGeneration: boolean
  whatsappIntegration: boolean
  emailIntegration: boolean
  workerLogs: boolean
  aiAnalytics: boolean
  leadScoring: boolean
  automation: boolean
  apiAccess: boolean
  customBranding: boolean
  prioritySupport: boolean
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial'

export interface CompanySubscription {
  id: string
  companyId: string
  planId: string
  plan?: SubscriptionPlan
  
  status: SubscriptionStatus
  trialEndsAt?: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  
  paymentMethod?: string
  externalSubscriptionId?: string
  lastPaymentAt?: string
  nextPaymentAt?: string
  
  createdAt: string
  updatedAt: string
}

export interface CompanyUsage {
  id: string
  companyId: string
  
  periodStart: string
  periodEnd: string
  
  dealsCreated: number
  offersCreated: number
  pdfsGenerated: number
  whatsappSent: number
  emailsSent: number
  storageUsedMb: number
  apiCalls: number
  
  createdAt: string
  updatedAt: string
}

export interface PlanLimitCheck {
  allowed: boolean
  current: number
  limit: number | null
  plan: PlanName
}

// Plan comparison data for pricing page
export const PLAN_COMPARISON: Record<PlanName, {
  price: string
  features: string[]
  limits: string[]
}> = {
  free: {
    price: 'חינם',
    features: [
      'משתמש 1',
      '30 לידים לחודש',
      'ללא PDF',
      'ללא אינטגרציות',
    ],
    limits: [
      '1 משתמש',
      '30 עסקאות/חודש',
      '100 MB אחסון',
    ],
  },
  basic: {
    price: '₪249/חודש',
    features: [
      'עד 3 משתמשים',
      'יצירת PDF',
      'WhatsApp + Email',
      'רישום משמרות',
      '500 עסקאות/חודש',
    ],
    limits: [
      '3 משתמשים',
      '500 עסקאות/חודש',
      '1 GB אחסון',
    ],
  },
  pro: {
    price: '₪499/חודש',
    features: [
      'משתמשים ללא הגבלה',
      'כל התכונות של Basic',
      'AI אנליטיקה',
      'Lead Scoring',
      'אוטומציות',
      'API גישה',
      'מיתוג מותאם',
      'תמיכה מועדפת',
    ],
    limits: [
      'משתמשים ללא הגבלה',
      'עסקאות ללא הגבלה',
      '10 GB אחסון',
    ],
  },
}

export function formatPrice(amount: number, currency: string = '₪'): string {
  return `${currency}${amount.toFixed(0)}`
}

export function getPlanBadgeColor(plan: PlanName): string {
  switch (plan) {
    case 'free': return 'bg-gray-100 text-gray-800'
    case 'basic': return 'bg-blue-100 text-blue-800'
    case 'pro': return 'bg-purple-100 text-purple-800'
  }
}

