import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import windows from '@/data/gallery/windows.json'
import servicesJson from '@/data/gallery/index.json'

export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  const items = (windows as { items: { src: string; type: 'image' | 'video' }[] }).items
  // Titles/descriptions taken from ServicesSection constants
  const titleHe = 'חלונות וויטרינות בהתאמה אישית'
  const descHe = 'יצור והתקנה של חלונות וויטרינות מאלומיניום לפי מידה ועיצוב אישי – פתרון אידיאלי למי שמחפש איכות בלתי מתפשרת, בידוד מושלם ומראה מודרני לאורך שנים.'
  const titleRu = 'Индивидуальные окна и витрины'
  const descRu = 'Производство и монтаж алюминиевых окон и витрин по вашим размерам и дизайну — идеальное решение для тех, кто ценит безупречное качество, отличную изоляцию и современный вид.'
  const titleEn = 'Custom Aluminum Windows & Storefronts'
  const descEn = 'Manufacture and installation of made‑to‑measure aluminum windows and storefronts — premium quality, excellent insulation, and a modern look that lasts.'
  return (
    <main className="container py-16">
      <h1 className="text-3xl font-extrabold">{t(titleHe, titleRu, titleEn)}</h1>
      <p className="mt-3 text-white/70">{t(descHe, descRu, descEn)}</p>
      <MediaGallery title={t(titleHe, titleRu, titleEn)} items={items} />
    </main>
  )
}