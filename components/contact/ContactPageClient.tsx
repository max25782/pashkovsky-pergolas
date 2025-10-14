'use client'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'

interface Props { locale: Locale }

export default function ContactPageClient({ locale }: Props){
  const t = (he: string, ru: string, en: string) => (locale === 'ru' ? ru : locale === 'en' ? en : he)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') || '').trim()
    const phone = String(fd.get('phone') || '').trim()
    const city = String(fd.get('city') || '').trim()
    const utmSource = typeof window !== 'undefined' ? localStorage.getItem('lead_source') : null

    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, city, source: utmSource || 'website' }),
      })
      if (!resp.ok) throw new Error('Failed to save')
      alert(t('✔️ קיבלנו את הפרטים, נחזור אליך בהקדם!', '✔️ Заявка получена, свяжемся с вами в ближайшее время!', '✔️ We received your details, we will contact you shortly!'))
      e.currentTarget.reset()
    } catch (err) {
      console.error(err)
      alert(t('אירעה שגיאה בשליחה. נסה שוב בבקשה.', 'Произошла ошибка при отправке. Попробуйте ещё раз.', 'An error occurred. Please try again.'))
    }
  }

  const whatsappText = encodeURIComponent(
    t(
      'שלום, אשמח לקבל הצעת מחיר לפרגולה/מעקה/גדר. שם: ____ | עיר: ____ | פרטים:',
      'Здравствуйте! Хочу получить предложение по перголе/перилам/забору. Имя: ____ | Город: ____ | Детали:',
      'Hello! I would like a quote for a pergola/railing/fence. Name: ____ | City: ____ | Details:'
    )
  )

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      {/* Hero */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{t('צור קשר','Связаться','Contact')}</h1>
          <p className="text-white/80 max-w-2xl">
            {t(
              'נשמח לייעץ, למדוד ולהציע את הפתרון המדויק עבורך. אפשר לפנות אלינו בטלפון, בווטסאפ או דרך הטופס.',
              'Мы с радостью проконсультируем, приедем на замер и предложим точное решение. Свяжитесь по телефону, WhatsApp или через форму.',
              'We are happy to advise, measure and propose the right solution. Reach us by phone, WhatsApp or via the form.'
            )}
          </p>
        </div>
      </section>

      {/* Grid: contacts + form */}
      <section className="pb-24">
        <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contacts */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
              <h2 className="text-2xl font-bold mb-4">{t('פרטי התקשרות ישירים','Прямые контакты','Direct contacts')}</h2>
              <div className="space-y-3 text-white/90">
                <div>
                  <div className="text-sm text-white/60">{t('דוא״ל','Email','Email')}</div>
                  <button
                    onClick={()=>{ const a='office'; const b='pashkovsky-group.com'; window.location.href=`mailto:${a}@${b}`; }}
                    className="underline hover:opacity-90"
                    aria-label={t('שליחת מייל','Send email','Send email')}
                  >
                    {t('שליחת מייל','Send email','Send email')}
                  </button>
                </div>
                <div>
                  <div className="text-sm text-white/60">{t('טלפון','Телефон','Phone')}</div>
                  <div className="space-x-reverse space-x-3">
                    <Link href="tel:0524494848" className="underline hover:opacity-90">052-449-4848</Link>
                    <span className="text-white/40">|</span>
                    <Link href="tel:0527062995" className="underline hover:opacity-90">052-706-2995</Link>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-white/60">WhatsApp</div>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <Link className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 transition" href={`https://wa.me/972524494848?text=${whatsappText}`} target="_blank">
                      {t('שלח הודעה ל-WhatsApp (052-449-4848)','Написать в WhatsApp (052-449-4848)','Message on WhatsApp (052-449-4848)')}
                    </Link>
                    <Link className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 transition" href={`https://wa.me/972527062995?text=${whatsappText}`} target="_blank">
                      {t('שלח הודעה ל-WhatsApp (052-706-2995)','Написать в WhatsApp (052-706-2995)','Message on WhatsApp (052-706-2995)')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-0 overflow-hidden">
              <iframe title="map" className="w-full h-72" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2839.9493801366434!2d35.13717859408354!3d32.16950742901451!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1500492432a7c98b%3A0x6a6b422013352cba!2sIsrael!5e0!3m2!1sen!2sil!4v1760463870080!5m2!1sen!2sil" style={{ border: 0 }} allowFullScreen />
            </div>
          </div>

          {/* Form */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
            <h2 className="text-2xl font-bold mb-6">{t('השאירו פרטים ונחזור אליכם','Оставьте контакты — мы перезвоним','Leave your details and we will call you')}</h2>
            <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm text-white/70 mb-1">{t('שם מלא','Полное имя','Full name')}</label>
                <input name="name" required placeholder={t('שם ושם משפחה','Имя и фамилия','First and last name')} className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 outline-none focus:border-white/40" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">{t('טלפון','Телефон','Phone')}</label>
                  <input name="phone" required placeholder={t('05X-XXXXXXX','05X-XXXXXXX','05X-XXXXXXX')} className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 outline-none focus:border-white/40" />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">{t('עיר','Город','City')}</label>
                  <input name="city" placeholder={t('עיר/אזור','Город/регион','City/region')} className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 outline-none focus:border-white/40" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">{t('הודעה','Сообщение','Message')}</label>
                <textarea name="message" rows={5} placeholder={t('ספרו לנו בקצרה מה תרצו (מידות/סוג פרגולה/מרפסת וכו׳)','Коротко опишите, что вы хотите (размеры/тип перголы/балкон и т.д.)','Briefly tell us what you need (sizes/type of pergola/balcony, etc.)')} className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 outline-none focus:border-white/40" />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="inline-flex items-center px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 transition font-semibold">
                  {t('שליחת פרטים','Отправить данные','Send details')}
                </button>
                <Link href={`https://wa.me/972524494848?text=${whatsappText}`} target="_blank" className="inline-flex items-center px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 transition font-semibold">
                  {t('פתיחת WhatsApp עכשיו','Открыть WhatsApp','Open WhatsApp')}
                </Link>
              </div>
              <input type="hidden" name="source" value="contact_page" />
            </form>
          </div>
        </div>

        {/* SEO Content Blocks */}
        <div className="container mx-auto px-4 mt-10 space-y-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
            <h2 className="text-2xl font-bold mb-4">{t('על החברה','О компании','About the company')}</h2>
            <p className="text-white/80 leading-relaxed">
              {t(
                'מאז 2019 אנחנו מתכננים, מייצרים ומתקינים פרגולות אלומיניום, מעקות וגדרות ברמת גימור גבוהה במיוחד. אנו עובדים בכל הארץ, עם דגש על עמידות, עיצוב ושירות אישי מהיר.',
                'С 2019 года мы проектируем, производим и устанавливаем алюминиевые перголы, перила и заборы премиум‑качества. Работаем по всей стране с акцентом на долговечность, дизайн и быстрый персональный сервис.',
                'Since 2019 we design, manufacture and install premium aluminum pergolas, railings and fences nationwide, focusing on durability, design and fast personal service.'
              )}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
            <h3 className="text-xl font-semibold mb-2">{t('איך זה עובד','Как это работает','How it works')}</h3>
            <ol className="list-decimal ms-6 text-white/80 leading-relaxed">
              <li className="mb-1">{t('שיחת היכרות קצרה והבנת הצורך','Короткий звонок и уточнение задачи','Short intro call to understand your needs')}</li>
              <li className="mb-1">{t('מדידה ותכנון ראשוני','Замер и первичное планирование','On‑site measurements and initial plan')}</li>
              <li className="mb-1">{t('הצעת מחיר מפורטת ושקופה','Прозрачное детальное предложение','Transparent detailed quote')}</li>
              <li>{t('ייצור והתקנה בלוחות זמנים מהירים','Производство и монтаж в сжатые сроки','Fast production and installation')}</li>
            </ol>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
            <h3 className="text-xl font-semibold mb-2">{t('אזורים בהם אנו פועלים','Регионы работы','Service areas')}</h3>
            <p className="text-white/80 leading-relaxed">
              {t('מרכז, שרון, שפלה, שומרון, ירושלים והסביבה. אנו מגיעים גם ליישובים מרוחקים – דברו איתנו.', 'Центр, Шарон, Шфела, Самария, Иерусалим и окрестности. Работаем и с удалёнными населёнными пунктами — свяжитесь с нами.', 'Center, Sharon, Shfela, Samaria, Jerusalem and surroundings. We also serve remote areas — contact us.')}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
            <h3 className="text-xl font-semibold mb-2">{t('למה לבחור בנו','Почему выбирают нас','Why choose us')}</h3>
            <ul className="list-disc ms-6 text-white/80 leading-relaxed">
              <li className="mb-1">{t('ייצור אלומיניום איכותי ועמיד לאקלים הישראלי','Качественный алюминий, устойчивый к израильскому климату','High‑quality aluminum built for local climate')}</li>
              <li className="mb-1">{t('שקיפות במחיר וללא אותיות קטנות','Прозрачные цены без скрытых платежей','Transparent pricing without small print')}</li>
              <li className="mb-1">{t('שירות אישי ומהיר – משלב הייעוץ ועד ההתקנה','Личный и быстрый сервис от консультации до монтажа','Personal fast service from consult to install')}</li>
              <li>{t('אחריות מלאה וליווי לאחר התקנה','Полная гарантия и сопровождение после монтажа','Full warranty and post‑install support')}</li>
            </ul>
            <div className="mt-4 text-white/80">
              <span className="me-2">{t('עיינו גם:','Смотрите также:','See also:')}</span>
              <Link href={`/${locale}/pergulas`} className="underline me-3">{t('פרגולות','Перголы','Pergolas')}</Link>
              <Link href={`/${locale}/railings`} className="underline me-3">{t('מעקות','Перила','Railings')}</Link>
              <Link href={`/${locale}/fences`} className="underline">{t('גדרות','Заборы','Fences')}</Link>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
            <h2 className="text-2xl font-bold mb-4">FAQ</h2>
            <div className="space-y-4 text-white/80">
              <div>
                <h3 className="font-semibold">{t('תוך כמה זמן חוזרים אליי?','Как быстро вы перезваниваете?','How fast do you respond?')}</h3>
                <p>{t('בדרך כלל בתוך 1–3 שעות עסקים.','Обычно в течение 1–3 рабочих часов.','Usually within 1–3 business hours.')}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('מה זמן האספקה המשוער?','Какой ориентировочный срок поставки?','What is the expected lead time?')}</h3>
                <p>{t('רוב הפרויקטים מסופקים תוך 7–21 ימי עסקים, בהתאם להיקף.','Большинство проектов выполняются за 7–21 рабочий день в зависимости от объёма.','Most projects are delivered in 7–21 business days, depending on scope.')}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('האם יש אחריות?','Есть ли гарантия?','Do you provide warranty?')}</h3>
                <p>{t('כן, אחריות מלאה על ייצור והתקנה. פירוט יינתן בהצעת המחיר.','Да, полная гарантия на производство и монтаж. Подробности в коммерческом предложении.','Yes, full warranty on production and installation. Details in the quote.')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}


