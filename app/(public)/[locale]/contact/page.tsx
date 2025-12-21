import type { Metadata } from 'next'
import type { Locale } from '@/lib/locales'
import ContactPageClient from '@/components/contact/ContactPageClient'

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const l = params.locale
  const title = l === 'ru'
    ? 'Связаться | Прогулы и перила из алюминия в Израиле | Pashkovski Group'
    : l === 'en'
    ? 'Contact | Aluminum Pergolas & Railings in Israel | Pashkovski Group'
    : 'צור קשר | פרגולות ומעקות אלומיניום בישראל | Pashkovski Group'
  const description = l === 'ru'
    ? 'Свяжитесь с нами: консультация, замер и предложение по алюминиевым перголам, перилам и заборам. Работаем по всей стране. Ответ в течение 1–3 часов.'
    : l === 'en'
    ? 'Contact us for consultation, measurement and quote for aluminum pergolas, railings and fences. Nationwide service. Response within 1–3 hours.'
    : 'צור קשר לייעוץ, מדידה והצעת מחיר לפרגולות אלומיניום, מעקות וגדרות. שירות בכל הארץ. מענה תוך 1–3 שעות.'
  return {
    title,
    description,
    alternates: { canonical: `https://pashkovsky-group.com/${l}/contact` }
  }
}

export default function Page({ params: { locale } }: { params: { locale: Locale } }){
  return <ContactPageClient locale={locale} />
}

