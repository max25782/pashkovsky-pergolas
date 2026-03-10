// components/Footer.tsx
import { createTranslator, type Locale } from '@/lib/locales'
import { FaWhatsapp, FaInstagram, FaFacebook } from 'react-icons/fa'
import { SiTiktok } from 'react-icons/si'

export default function Footer({ locale = 'he' }: { locale?: Locale }) {
  const t = createTranslator(locale)
  return (
    <footer className="bg-neutral-900 text-neutral-200 py-10 px-6 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Company info */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Pashkovski Group</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            {t(
              'מאז 2019 אנחנו מייצרים פרגולות, מעקות ומסתורים באיכות הגבוהה ביותר בישראל — שילוב של יוקרה, עיצוב ושירות ללא פשרות.',
              'С 2019 года мы изготавливаем перголы, перила и экраны высочайшего качества в Израиле — сочетание премиального дизайна и сервиса без компромиссов.',
              'Since 2019 we have been producing premium pergolas, railings and screens in Israel — combining luxury design and uncompromising service.'
            )}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-2">
          <h4 className="text-lg font-semibold mb-2">{t('ניווט מהיר','Быстрая навигация','Quick navigation')}</h4>
          <a href={`/${locale}`} className="hover:text-white transition">{t('דף הבית','Главная','Home')}</a>
          <a href={`/${locale}/pergulas`} className="hover:text-white transition">{t('פרגולות','Перголы','Pergolas')}</a>
          <a href={`/${locale}/railings`} className="hover:text-white transition">{t('מעקות','Перила','Railings')}</a>
          <a href={`/${locale}/profiles`} className="hover:text-white transition">{t('פרופילים','Профили','Profiles')}</a>
          <a href={`/${locale}/blog`} className="hover:text-white transition">{t('בלוג','Блог','Blog')}</a>
          <a href={`/${locale}/about`} className="hover:text-white transition">{t('אודות','О нас','About')}</a>
          <a href={`/${locale}/contact`} className="hover:text-white transition">{t('צור קשר','Контакты','Contact')}</a>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-lg font-semibold mb-2">{t('צור קשר','Связаться','Contact')}</h4>
          <p className="text-sm">📍 {t('אזור תעשיה עמנואל','Промзона Эммануэль','Emmanuel Industrial Zone')}</p>
          <p className="text-sm">📞 +972524494848</p>
          <p className="text-sm">✉️ office@pashkovsky-group.com</p>
          <p className="text-sm mt-1">🕒 {t('א׳–ה׳ 08:00–18:00, ו׳ 08:00–13:00','Вс–Чт 08:00–18:00, Пт 08:00–13:00','Sun–Thu 08:00–18:00, Fri 08:00–13:00')}</p>
          <div className="flex gap-3 mt-3">
            <a
              href="https://wa.me/972524494848"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition"
            >
              <FaWhatsapp size={18} />
            </a>
            <a
              href="https://www.instagram.com/pashkovsky_maakot/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition"
            >
              <FaInstagram size={18} />
            </a>
            <a
              href="https://www.facebook.com/pashcovskimaakot"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition"
            >
              <FaFacebook size={18} />
            </a>
            <a
              href="https://www.tiktok.com/@pashkovsky.group"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
              className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition"
            >
              <SiTiktok size={18} />
            </a>
          </div>
        </div>

      </div>

      {/* Bottom line */}
      <div className="border-t border-neutral-800 mt-10 pt-4 text-center text-xs text-neutral-500">
        © 2025 Pashkovski Group. כל הזכויות שמורות.
      </div>
    </footer>
  );
}
