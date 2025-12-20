import type { Locale } from '@/lib/locales'

export default function TermsPage({ params }: { params: { locale: Locale } }) {
  const isHebrew = params.locale === 'he'
  const isRussian = params.locale === 'ru'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">
          {isHebrew ? 'תנאי שימוש' : isRussian ? 'Условия использования' : 'Terms of Service'}
        </h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '1. קבלת התנאים' : isRussian ? '1. Принятие условий' : '1. Acceptance of Terms'}
            </h2>
            <p className="text-white/80">
              {isHebrew 
                ? 'באמצעות גישה לשירות זה ושימוש בו, אתה מסכים להיות מחויב לתנאי שימוש אלה. אם אינך מסכים לתנאים אלה, אנא אל תשתמש בשירות.'
                : isRussian
                ? 'Используя этот сервис, вы соглашаетесь соблюдать эти условия использования. Если вы не согласны с этими условиями, пожалуйста, не используйте сервис.'
                : 'By accessing and using this service, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '2. תיאור השירות' : isRussian ? '2. Описание сервиса' : '2. Service Description'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'השירות מספק פלטפורמת CRM לניהול לידים, עסקאות, פרויקטים ועובדים. השירות כולל כלי ניתוח, אוטומציה ודיווח.'
                : isRussian
                ? 'Сервис предоставляет CRM-платформу для управления лидами, сделками, проектами и сотрудниками. Сервис включает инструменты аналитики, автоматизации и отчетности.'
                : 'The service provides a CRM platform for managing leads, deals, projects, and workers. The service includes analytics, automation, and reporting tools.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '3. חשבון משתמש' : isRussian ? '3. Учетная запись' : '3. User Account'}
            </h2>
            <p className="text-white/80 mb-2">
              {isHebrew
                ? 'אתה אחראי לשמירה על סודיות חשבונך ואתה מסכים:'
                : isRussian
                ? 'Вы несете ответственность за сохранность вашей учетной записи и соглашаетесь:'
                : 'You are responsible for maintaining the confidentiality of your account and agree to:'}
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>{isHebrew ? 'לספק מידע מדויק ועדכני' : isRussian ? 'Предоставлять точную и актуальную информацию' : 'Provide accurate and current information'}</li>
              <li>{isHebrew ? 'לשמור על סודיות פרטי הגישה' : isRussian ? 'Сохранять конфиденциальность данных доступа' : 'Maintain the confidentiality of access credentials'}</li>
              <li>{isHebrew ? 'להודיע לנו מיד על כל שימוש לא מורשה' : isRussian ? 'Немедленно сообщать о несанкционированном использовании' : 'Notify us immediately of any unauthorized use'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '4. מחירים ותשלום' : isRussian ? '4. Цены и оплата' : '4. Pricing and Payment'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'המחירים מפורטים בעמוד התמחור שלנו. התשלום מתבצע מראש על בסיס חודשי או שנתי. אנו שומרים לעצמנו את הזכות לשנות את המחירים בהודעה מראש של 30 יום.'
                : isRussian
                ? 'Цены указаны на странице тарифов. Оплата производится авансом на ежемесячной или годовой основе. Мы оставляем за собой право изменять цены с уведомлением за 30 дней.'
                : 'Pricing is detailed on our pricing page. Payment is made in advance on a monthly or annual basis. We reserve the right to change prices with 30 days notice.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '5. ביטול והחזר כספי' : isRussian ? '5. Отмена и возврат средств' : '5. Cancellation and Refunds'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'ניתן לבטל את המנוי בכל עת. לא יינתן החזר כספי עבור חלק לא מנוצל של תקופת החיוב הנוכחית, אך תוכל להמשיך להשתמש בשירות עד לסוף התקופה ששולמה.'
                : isRussian
                ? 'Вы можете отменить подписку в любое время. Возврат средств за неиспользованную часть текущего платежного периода не производится, но вы сможете продолжать использовать сервис до конца оплаченного периода.'
                : 'You may cancel your subscription at any time. No refunds will be provided for the unused portion of the current billing period, but you may continue to use the service until the end of the paid period.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '6. בעלות על נתונים' : isRussian ? '6. Владение данными' : '6. Data Ownership'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'הנתונים שלך שייכים לך. אתה שומר על כל הזכויות, הבעלות והאינטרס בנתונים שלך. אנו לא נשתמש בנתונים שלך למטרות אחרות מלבד אספקת השירות.'
                : isRussian
                ? 'Ваши данные принадлежат вам. Вы сохраняете все права, собственность и интерес к вашим данным. Мы не будем использовать ваши данные для других целей, кроме предоставления сервиса.'
                : 'Your data belongs to you. You retain all rights, ownership, and interest in your data. We will not use your data for purposes other than providing the service.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '7. הגבלת אחריות' : isRussian ? '7. Ограничение ответственности' : '7. Limitation of Liability'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'השירות מסופק "כמות שהוא". אנו לא נישא באחריות לנזקים עקיפים, מקריים או תוצאתיים הנובעים משימוש או אי-יכולת להשתמש בשירות.'
                : isRussian
                ? 'Сервис предоставляется "как есть". Мы не несем ответственности за косвенные, случайные или косвенные убытки, возникшие в результате использования или невозможности использования сервиса.'
                : 'The service is provided "as is". We shall not be liable for indirect, incidental, or consequential damages arising from the use or inability to use the service.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '8. שינויים בתנאים' : isRussian ? '8. Изменения условий' : '8. Changes to Terms'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'אנו שומרים לעצמנו את הזכות לשנות תנאים אלה בכל עת. נודיע לך על שינויים מהותיים באמצעות דואר אלקטרוני או הודעה בשירות.'
                : isRussian
                ? 'Мы оставляем за собой право изменять эти условия в любое время. Мы уведомим вас о существенных изменениях по электронной почте или через уведомление в сервисе.'
                : 'We reserve the right to modify these terms at any time. We will notify you of material changes via email or service notification.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '9. דין וסמכות שיפוט' : isRussian ? '9. Применимое право' : '9. Governing Law'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'תנאים אלה יהיו כפופים לחוקי מדינת ישראל. כל מחלוקת תתברר בבתי המשפט המוסמכים בישראל.'
                : isRussian
                ? 'Эти условия регулируются законодательством Государства Израиль. Любые споры будут рассматриваться в компетентных судах Израиля.'
                : 'These terms shall be governed by the laws of the State of Israel. Any disputes shall be adjudicated in the competent courts of Israel.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {isHebrew ? '10. יצירת קשר' : isRussian ? '10. Контакты' : '10. Contact'}
            </h2>
            <p className="text-white/80">
              {isHebrew
                ? 'לשאלות לגבי תנאי שימוש אלה, אנא צור איתנו קשר בכתובת: info@pashkovsky-group.com'
                : isRussian
                ? 'По вопросам об этих условиях использования, пожалуйста, свяжитесь с нами по адресу: info@pashkovsky-group.com'
                : 'For questions about these Terms of Service, please contact us at: info@pashkovsky-group.com'}
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

