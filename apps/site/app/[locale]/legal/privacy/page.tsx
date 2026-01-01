import type { Locale } from '@/lib/locales'

export default function PrivacyPage({ params }: { params: { locale: Locale } }) {
  const isHebrew = params.locale === 'he'
  const isRussian = params.locale === 'ru'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">
          {isHebrew ? 'מדיניות פרטיות' : isRussian ? 'Политика конфиденциальности' : 'Privacy Policy'}
        </h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '1. מידע שאנו אוספים' : isRussian ? '1. Информация, которую мы собираем' : '1. Information We Collect'}
            </h2>
            <p className="text-white/80 mb-2">
              {isHebrew
                ? 'אנו אוספים את סוגי המידע הבאים:'
                : isRussian
                ? 'Мы собираем следующие виды информации:'
                : 'We collect the following types of information:'}
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>{isHebrew ? 'מידע אישי: שם, כתובת דואר אלקטרוני, מספר טלפון' : isRussian ? 'Личная информация: имя, email, номер телефона' : 'Personal information: name, email, phone number'}</li>
              <li>{isHebrew ? 'מידע חברה: שם חברה, כתובת, פרטי מס' : isRussian ? 'Информация о компании: название, адрес, налоговые данные' : 'Company information: company name, address, tax details'}</li>
              <li>{isHebrew ? 'נתוני שימוש: כתובת IP, סוג דפדפן, פעילות במערכת' : isRussian ? 'Данные использования: IP-адрес, тип браузера, активность в системе' : 'Usage data: IP address, browser type, system activity'}</li>
              <li>{isHebrew ? 'נתוני עסק: לידים, עסקאות, פרויקטים' : isRussian ? 'Бизнес-данные: лиды, сделки, проекты' : 'Business data: leads, deals, projects'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '2. כיצד אנו משתמשים במידע' : isRussian ? '2. Как мы используем информацию' : '2. How We Use Information'}
            </h2>
            <p className="text-white/80 mb-2">
              {isHebrew
                ? 'אנו משתמשים במידע שלך כדי:'
                : isRussian
                ? 'Мы используем вашу информацию для:'
                : 'We use your information to:'}
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>{isHebrew ? 'לספק ולתחזק את השירות' : isRussian ? 'Предоставления и поддержки сервиса' : 'Provide and maintain the service'}</li>
              <li>{isHebrew ? 'לשפר ולייעל את חוויית המשתמש' : isRussian ? 'Улучшения пользовательского опыта' : 'Improve and optimize user experience'}</li>
              <li>{isHebrew ? 'לתקשר איתך לגבי השירות' : isRussian ? 'Коммуникации с вами о сервисе' : 'Communicate with you about the service'}</li>
              <li>{isHebrew ? 'לעבד תשלומים ולנהל חיובים' : isRussian ? 'Обработки платежей и управления счетами' : 'Process payments and manage billing'}</li>
              <li>{isHebrew ? 'למנוע הונאה ולהגן על אבטחת המערכת' : isRussian ? 'Предотвращения мошенничества и защиты безопасности' : 'Prevent fraud and protect security'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '3. שיתוף מידע' : isRussian ? '3. Раскрытие информации' : '3. Information Sharing'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'אנו לא נמכור, נשכיר או נשתף את המידע האישי שלך עם צדדים שלישיים, למעט במקרים הבאים:'
                : isRussian
                ? 'Мы не продаем, не сдаем в аренду и не передаем вашу личную информацию третьим лицам, за исключением следующих случаев:'
                : 'We will not sell, rent, or share your personal information with third parties, except in the following cases:'}
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2 mt-2">
              <li>{isHebrew ? 'עם הסכמתך המפורשת' : isRussian ? 'С вашего явного согласия' : 'With your explicit consent'}</li>
              <li>{isHebrew ? 'עם ספקי שירות הנחוצים למתן השירות (אחסון, תשלומים)' : isRussian ? 'С поставщиками услуг, необходимыми для предоставления сервиса (хостинг, платежи)' : 'With service providers necessary for providing the service (hosting, payments)'}</li>
              <li>{isHebrew ? 'כנדרש על פי חוק או צו שיפוטי' : isRussian ? 'По требованию закона или судебного приказа' : 'As required by law or court order'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '4. אבטחת מידע' : isRussian ? '4. Безопасность данных' : '4. Data Security'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'אנו נוקטים באמצעי אבטחה סבירים כדי להגן על המידע שלך, כולל הצפנה, גישה מוגבלת, ומערכות ניטור. עם זאת, שום שיטה של העברה באינטרנט או אחסון אלקטרוני אינה מאובטחת ב-100%.'
                : isRussian
                ? 'Мы принимаем разумные меры безопасности для защиты вашей информации, включая шифрование, ограниченный доступ и системы мониторинга. Однако ни один метод передачи через интернет или электронного хранения не является на 100% безопасным.'
                : 'We take reasonable security measures to protect your information, including encryption, restricted access, and monitoring systems. However, no method of transmission over the internet or electronic storage is 100% secure.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '5. שמירת מידע' : isRussian ? '5. Хранение данных' : '5. Data Retention'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'אנו שומרים את המידע שלך כל עוד חשבונך פעיל או כנדרש לספק לך שירותים. לאחר סגירת חשבון, נשמור את המידע במשך 90 יום לצורכי גיבוי ואז נמחק אותו לצמיתות.'
                : isRussian
                ? 'Мы храним вашу информацию до тех пор, пока ваша учетная запись активна или требуется для предоставления услуг. После закрытия учетной записи мы сохраняем информацию в течение 90 дней для резервного копирования, а затем удаляем ее навсегда.'
                : 'We retain your information as long as your account is active or as needed to provide you services. After account closure, we retain information for 90 days for backup purposes and then permanently delete it.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '6. זכויותיך' : isRussian ? '6. Ваши права' : '6. Your Rights'}
            </h2>
            <p className="text-white/80 mb-2">
              {isHebrew
                ? 'יש לך את הזכויות הבאות לגבי המידע האישי שלך:'
                : isRussian
                ? 'У вас есть следующие права в отношении вашей личной информации:'
                : 'You have the following rights regarding your personal information:'}
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>{isHebrew ? 'גישה: לבקש עותק של המידע שיש לנו עליך' : isRussian ? 'Доступ: запросить копию информации, которую мы храним о вас' : 'Access: Request a copy of the information we have about you'}</li>
              <li>{isHebrew ? 'תיקון: לעדכן או לתקן מידע לא מדויק' : isRussian ? 'Исправление: обновить или исправить неточную информацию' : 'Correction: Update or correct inaccurate information'}</li>
              <li>{isHebrew ? 'מחיקה: לבקש למחוק את המידע שלך' : isRussian ? 'Удаление: запросить удаление вашей информации' : 'Deletion: Request deletion of your information'}</li>
              <li>{isHebrew ? 'ייצוא: לקבל את הנתונים שלך בפורמט ניתן להעברה' : isRussian ? 'Экспорт: получить ваши данные в переносимом формате' : 'Export: Receive your data in a portable format'}</li>
              <li>{isHebrew ? 'התנגדות: להתנגד לעיבוד מסוים של המידע שלך' : isRussian ? 'Возражение: возразить против определенной обработки вашей информации' : 'Object: Object to certain processing of your information'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '7. עוגיות' : isRussian ? '7. Файлы cookie' : '7. Cookies'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'אנו משתמשים בעוגיות כדי לשפר את חוויית המשתמש, לנתח שימוש באתר ולזכור את ההעדפות שלך. ניתן לנהל את העדפות העוגיות בהגדרות הדפדפן שלך.'
                : isRussian
                ? 'Мы используем файлы cookie для улучшения пользовательского опыта, анализа использования сайта и запоминания ваших предпочтений. Вы можете управлять настройками cookie в настройках вашего браузера.'
                : 'We use cookies to improve user experience, analyze site usage, and remember your preferences. You can manage cookie preferences in your browser settings.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '8. עדכונים למדיניות' : isRussian ? '8. Обновления политики' : '8. Policy Updates'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. נודיע לך על שינויים מהותיים באמצעות דואר אלקטרוני או הודעה בשירות.'
                : isRussian
                ? 'Мы можем обновлять эту политику конфиденциальности время от времени. Мы уведомим вас о существенных изменениях по электронной почте или через уведомление в сервисе.'
                : 'We may update this Privacy Policy from time to time. We will notify you of material changes via email or service notification.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '9. יצירת קשר' : isRussian ? '9. Контакты' : '9. Contact'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'לשאלות לגבי מדיניות פרטיות זו או לבקשות הקשורות לנתונים האישיים שלך, אנא צור איתנו קשר בכתובת: privacy@pashkovsky-group.com'
                : isRussian
                ? 'По вопросам об этой политике конфиденциальности или запросам, связанным с вашими личными данными, пожалуйста, свяжитесь с нами по адресу: privacy@pashkovsky-group.com'
                : 'For questions about this Privacy Policy or requests related to your personal data, please contact us at: privacy@pashkovsky-group.com'}
            </p>
          </section>

          <div className="pt-8 border-t border-white/10">
            <p className="text-sm text-white/60">
              {isHebrew
                ? 'עודכן לאחרונה: דצמבר 2025'
                : isRussian
                ? 'Последнее обновление: Декабрь 2025'
                : 'Last updated: December 2025'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}



