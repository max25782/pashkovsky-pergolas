/**
 * Integration Pricing Module
 * Pricing packages and helpers for website integrations
 */

import type { IntegrationPackageType } from '@/types/integration'

export interface IntegrationPackage {
  name: {
    en: string
    he: string
    ru: string
  }
  price_ils: number | null
  description: {
    en: string
    he: string
    ru: string
  }
  features: {
    en: string[]
    he: string[]
    ru: string[]
  }
}

export const INTEGRATION_PRICING: Record<IntegrationPackageType, IntegrationPackage> = {
  basic: {
    name: {
      en: 'Basic Integration',
      he: 'אינטגרציה בסיסית',
      ru: 'Базовая интеграция',
    },
    price_ils: 500,
    description: {
      en: 'Simple websites and standard lead forms',
      he: 'אתרים פשוטים וטפסי ליד סטנדרטיים',
      ru: 'Простые сайты и стандартные формы лидов',
    },
    features: {
      en: [
        '1 website',
        'Lead reception',
        'Basic webhook',
        'Standard fields (name, phone, email, message)',
      ],
      he: [
        'אתר אחד',
        'קבלת לידים',
        'Webhook בסיסי',
        'שדות סטנדרטיים (שם, טלפון, אימייל, הודעה)',
      ],
      ru: [
        '1 сайт',
        'Прием лидов',
        'Базовый webhook',
        'Стандартные поля (имя, телефон, email, сообщение)',
      ],
    },
  },
  advanced: {
    name: {
      en: 'Advanced Integration',
      he: 'אינטגרציה מתקדמת',
      ru: 'Продвинутая интеграция',
    },
    price_ils: 1200,
    description: {
      en: 'Complex forms, file uploads and custom workflows',
      he: 'טפסים מורכבים, העלאת קבצים וזרימות מותאמות אישית',
      ru: 'Сложные формы, загрузка файлов и кастомные процессы',
    },
    features: {
      en: [
        'Multiple forms',
        'File uploads',
        'Custom fields',
        'Field mapping',
        'Advanced logic',
      ],
      he: [
        'מספר טפסים',
        'העלאת קבצים',
        'שדות מותאמים',
        'מיפוי שדות',
        'לוגיקה מתקדמת',
      ],
      ru: [
        'Несколько форм',
        'Загрузка файлов',
        'Кастомные поля',
        'Маппинг полей',
        'Продвинутая логика',
      ],
    },
  },
  custom: {
    name: {
      en: 'Custom Integration',
      he: 'אינטגרציה מותאמת אישית',
      ru: 'Индивидуальная интеграция',
    },
    price_ils: null,
    description: {
      en: 'Multiple websites, custom logic, legacy systems',
      he: 'מספר אתרים, לוגיקה מותאמת, מערכות מורשת',
      ru: 'Несколько сайтов, кастомная логика, legacy системы',
    },
    features: {
      en: [
        'Unlimited websites',
        'Custom integration',
        'Full API access',
        'Dedicated support',
        'Legacy system support',
      ],
      he: [
        'אתרים ללא הגבלה',
        'אינטגרציה מותאמת',
        'גישה מלאה ל-API',
        'תמיכה ייעודית',
        'תמיכה במערכות מורשת',
      ],
      ru: [
        'Неограниченно сайтов',
        'Кастомная интеграция',
        'Полный доступ к API',
        'Выделенная поддержка',
        'Поддержка legacy систем',
      ],
    },
  },
}

/**
 * Format price in ILS (₪)
 */
export function formatPriceILS(price: number | null, locale: 'en' | 'he' | 'ru' = 'en'): string {
  if (price === null) {
    switch (locale) {
      case 'he':
        return 'הצעת מחיר'
      case 'ru':
        return 'По запросу'
      default:
        return 'Quote'
    }
  }
  return `₪${price.toLocaleString()}`
}

/**
 * Get one-time setup fee text
 */
export function getOneTimeFeeText(locale: 'en' | 'he' | 'ru' = 'en'): string {
  switch (locale) {
    case 'he':
      return 'תשלום חד-פעמי להתקנה'
    case 'ru':
      return 'Разовый платеж за подключение'
    default:
      return 'One-time setup fee'
  }
}




