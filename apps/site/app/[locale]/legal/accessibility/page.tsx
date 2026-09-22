import type { Locale } from '@/lib/locales'
import { ACCESSIBILITY_COORDINATOR, ACCESSIBILITY_LAST_UPDATED } from '@/lib/accessibility'

export default function AccessibilityPage({ params }: { params: { locale: Locale } }) {
  const isHebrew = params.locale === 'he'
  const isRussian = params.locale === 'ru'

  const title = isHebrew ? 'הצהרת נגישות' : isRussian ? 'Заявление о доступности' : 'Accessibility Statement'
  const complianceLevel = isHebrew
    ? 'רמת נגישות חלקית — אנו פועלים להשגת עמידה מלאה בתקן ישראלי ת"י 5568 (WCAG 2.0 רמה AA).'
    : isRussian
    ? 'Частичный уровень доступности — мы работаем над полным соответствием израильскому стандарту 5568 (WCAG 2.0 AA).'
    : 'Partial compliance — we are working toward full Israeli Standard 5568 (WCAG 2.0 Level AA).'

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">{title}</h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '1. מחויבות לנגישות' : isRussian ? '1. Обязательство по доступности' : '1. Commitment to Accessibility'}
            </h2>
            <p className="text-white/90">
              {isHebrew
                ? 'Pashkovsky Group מחויבת להנגיש את האתר לכלל האוכלוסייה, כולל אנשים עם מוגבלות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח–1998, ולתקן הישראלי ת"י 5568 המבוסס על WCAG 2.0 רמה AA.'
                : isRussian
                ? 'Pashkovsky Group стремится сделать сайт доступным для всех, включая людей с ограниченными возможностями, в соответствии с Законом о равных правах лиц с ограниченными возможностями и израильским стандартом 5568 (WCAG 2.0 AA).'
                : 'Pashkovsky Group is committed to making this website accessible to everyone, including people with disabilities, in accordance with Israeli accessibility regulations and Standard 5568 (WCAG 2.0 Level AA).'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '2. רמת הנגישות באתר' : isRussian ? '2. Уровень доступности' : '2. Compliance Level'}
            </h2>
            <p className="text-white/90">{complianceLevel}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '3. רכז/ת נגישות' : isRussian ? '3. Координатор по доступности' : '3. Accessibility Coordinator'}
            </h2>
            <ul className="text-white/90 space-y-2">
              <li>
                <strong>{isHebrew ? 'שם:' : isRussian ? 'Имя:' : 'Name:'}</strong> {ACCESSIBILITY_COORDINATOR.name}
              </li>
              <li>
                <strong>{isHebrew ? 'תפקיד:' : isRussian ? 'Должность:' : 'Role:'}</strong> {ACCESSIBILITY_COORDINATOR.role}
              </li>
              <li>
                <strong>{isHebrew ? 'טלפון:' : isRussian ? 'Телефон:' : 'Phone:'}</strong>{' '}
                <a href={`tel:${ACCESSIBILITY_COORDINATOR.phone}`} className="underline hover:text-white">
                  {ACCESSIBILITY_COORDINATOR.phone}
                </a>
              </li>
              <li>
                <strong>{isHebrew ? 'דוא"ל:' : isRussian ? 'Email:' : 'Email:'}</strong>{' '}
                <a href={`mailto:${ACCESSIBILITY_COORDINATOR.email}`} className="underline hover:text-white">
                  {ACCESSIBILITY_COORDINATOR.email}
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '4. דיווח על בעיות נגישות' : isRussian ? '4. Сообщить о проблеме' : '4. Report Accessibility Issues'}
            </h2>
            <p className="text-white/90">
              {isHebrew
                ? 'אם נתקלתם בבעיה בנגישות האתר, נשמח לקבל פנייה. אנא צרו קשר עם רכז/ת הנגישות בטלפון או בדוא"ל, או דרך טופס יצירת הקשר באתר. אנו מתחייבים לטפל בפניות בהקדם האפשרי.'
                : isRussian
                ? 'Если вы столкнулись с проблемой доступности, свяжитесь с координатором по телефону или email, либо через форму обратной связи на сайте. Мы обработаем обращение в кратчайшие сроки.'
                : 'If you encounter an accessibility barrier, please contact the accessibility coordinator by phone or email, or use the contact form on this site. We will address reports as soon as possible.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '5. התאמות שבוצעו' : isRussian ? '5. Реализованные меры' : '5. Implemented Measures'}
            </h2>
            <ul className="list-disc list-inside text-white/90 space-y-2">
              <li>{isHebrew ? 'הצהרת נגישות ופרטי רכז/ת נגישות' : isRussian ? 'Заявление о доступности и контакты координатора' : 'Accessibility statement and coordinator contact'}</li>
              <li>{isHebrew ? 'קישור "דלג לתוכן הראשי"' : isRussian ? 'Ссылка «Перейти к основному содержимому»' : 'Skip to main content link'}</li>
              <li>{isHebrew ? 'תמיכה בשפות מרובות (עברית, רוסית, אנגלית) עם lang ו-dir נכונים' : isRussian ? 'Многоязычность (иврит, русский, английский) с корректными lang и dir' : 'Multilingual support (Hebrew, Russian, English) with correct lang and dir'}</li>
              <li>{isHebrew ? 'תוויות לטפסים וכפתורים' : isRussian ? 'Подписи к формам и кнопкам' : 'Form labels and button labels'}</li>
              <li>{isHebrew ? 'ניווט מקלדת ומיקוד נראה לעין' : isRussian ? 'Клавиатурная навигация и видимый фокус' : 'Keyboard navigation and visible focus indicators'}</li>
              <li>{isHebrew ? 'כיבוי אנימציות עבור משתמשים עם prefers-reduced-motion' : isRussian ? 'Отключение анимаций при prefers-reduced-motion' : 'Reduced motion support via prefers-reduced-motion'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '6. מגבלות ידועות' : isRussian ? '6. Известные ограничения' : '6. Known Limitations'}
            </h2>
            <ul className="list-disc list-inside text-white/90 space-y-2">
              <li>
                {isHebrew
                  ? 'גלריות וקרוסלות: חלק מהתוכן הדינמי עשוי להיות פחות נגיש לקוראי מסך.'
                  : isRussian
                  ? 'Галереи и карусели: часть динамического контента может быть менее доступна для программ чтения с экрана.'
                  : 'Galleries and carousels: some dynamic content may be less accessible to screen readers.'}
              </li>
              <li>
                {isHebrew
                  ? 'תוכן חיצוני (מפות Google, CAPTCHA): כפוף לנגישות של ספקים חיצוניים.'
                  : isRussian
                  ? 'Внешний контент (Google Maps, CAPTCHA): зависит от доступности сторонних поставщиков.'
                  : 'Third-party content (Google Maps, CAPTCHA): subject to external provider accessibility.'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '7. לוח זמנים לשיפור' : isRussian ? '7. График улучшений' : '7. Remediation Timeline'}
            </h2>
            <p className="text-white/90">
              {isHebrew
                ? 'אנו ממשיכים לשפר נגישות האתר באופן שוטף. יעדנו הוא להשיג עמידה מלאה בת"י 5568 / WCAG 2.0 AA עד סוף 2026.'
                : isRussian
                ? 'Мы продолжаем улучшать доступность сайта. Цель — полное соответствие стандарту 5568 / WCAG 2.0 AA к концу 2026 года.'
                : 'We continue to improve site accessibility on an ongoing basis. Our target is full 5568 / WCAG 2.0 AA compliance by end of 2026.'}
            </p>
          </section>

          <div className="pt-8 border-t border-white/10">
            <p className="text-sm text-white/70">
              {isHebrew
                ? `עודכן לאחרונה: ${ACCESSIBILITY_LAST_UPDATED}`
                : isRussian
                ? `Последнее обновление: ${ACCESSIBILITY_LAST_UPDATED}`
                : `Last updated: ${ACCESSIBILITY_LAST_UPDATED}`}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
