import type { Locale } from '@/lib/locales'
export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he:string, ru:string, en:string)=> locale==='he'?he: locale==='ru'?ru: en
  return <main className="container py-16">
    <h1 className="text-3xl font-extrabold">{t('על החברה','О компании','About')}</h1>
    <p className="mt-4 text-white/70">{t('תוכן יתעדכן בהמשך.','Контент скоро добавим.','Content coming soon.')}</p>
  </main>
}
