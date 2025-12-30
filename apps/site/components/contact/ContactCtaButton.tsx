'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FaWhatsapp } from 'react-icons/fa'
import type { Locale } from '@/lib/locales'

interface ContactCtaButtonProps {
  locale?: Locale
  className?: string
  buttonText?: React.ReactNode
}

function getCopy(locale: Locale) {
  if (locale === 'ru') {
    return {
      buttonCta: 'Связаться с нами',
      modalTitle: 'Оставьте данные и мы свяжемся с вами',
      modalSubtitle: 'Не обязательно WhatsApp — можем позвонить 🙂',
      namePlaceholder: 'Полное имя',
      phonePlaceholder: 'Телефон',
      cityPlaceholder: 'Город',
      submitButton: 'Отправить',
      sending: 'Отправка...',
      step2Title: 'Как вам удобнее продолжить?',
      whatsappButton: 'Написать в WhatsApp',
      callButton: 'Перезвоните мне',
      whatsappMessage: (name: string, phone: string, city: string) =>
        `Здравствуйте! Меня зовут ${name}. Город: ${city}. Телефон: ${phone}. Хочу получить предложение на перголу.`,
    }
  }
  if (locale === 'en') {
    return {
      buttonCta: 'Contact Us',
      modalTitle: "Leave your details and we'll get back to you",
      modalSubtitle: 'WhatsApp is optional — we can call too 🙂',
      namePlaceholder: 'Full Name',
      phonePlaceholder: 'Phone',
      cityPlaceholder: 'City',
      submitButton: 'Submit',
      sending: 'Sending...',
      step2Title: 'How would you like to continue?',
      whatsappButton: 'Message on WhatsApp',
      callButton: 'Call me back',
      whatsappMessage: (name: string, phone: string, city: string) =>
        `Hi! My name is ${name}. City: ${city}. Phone: ${phone}. I would like to get a quote for a pergola.`,
    }
  }
  return {
    buttonCta: 'דברו איתנו',
    modalTitle: 'השאירו פרטים ונחזור אליכם',
    modalSubtitle: 'לא חייבים וואטסאפ – אפשר גם שיחה רגילה 🙂',
    namePlaceholder: 'שם מלא',
    phonePlaceholder: 'טלפון',
    cityPlaceholder: 'עיר',
    submitButton: 'שלח',
    sending: 'שולח...',
    step2Title: 'איך נוח לך להמשיך?',
    whatsappButton: 'דברו איתי בוואטסאפ',
    callButton: 'תחזרו אליי בטלפון',
    whatsappMessage: (name: string, phone: string, city: string) =>
      `שלום! שמי ${name}. עיר: ${city}. טלפון: ${phone}. אשמח להצעת מחיר לפרגולה.`,
  }
}

export default function ContactCtaButton({ locale = 'he', className, buttonText }: ContactCtaButtonProps) {
  const copy = getCopy(locale)
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', city: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const utmSource = typeof window !== 'undefined' ? localStorage.getItem('lead_source') : null
    
    // Send to CRM Public Leads API
    const crmUrl = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://localhost:3001'
    const siteToken = process.env.NEXT_PUBLIC_CRM_SITE_TOKEN || 'dev-token'
    
    try {
      const resp = await fetch(`${crmUrl}/api/public/leads`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-site-token': siteToken,
        },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: '',
          message: form.city ? `City: ${form.city}` : '',
          source: utmSource || 'website',
        }),
      })
      if (!resp.ok) {
        // Fallback alert messages based on locale
        alert(locale === 'he' ? 'שגיאה בשמירה, נסה שוב' : locale === 'ru' ? 'Ошибка сохранения, попробуйте снова' : 'Save failed, try again')
        setLoading(false)
        return
      }
      setLoading(false)
      setStep(2)
    } catch (err) {
      alert(locale === 'he' ? 'שגיאת רשת, בדוק חיבור' : locale === 'ru' ? 'Ошибка сети, проверьте соединение' : 'Network error')
      setLoading(false)
    }
  }

  const handleWhatsApp = () => {
    const message = encodeURIComponent(copy.whatsappMessage(form.name, form.phone, form.city))
    window.open(`https://wa.me/972524494848?text=${message}`, '_blank')
    setIsOpen(false)
    setStep(1)
    setForm({ name: '', phone: '', city: '' })
  }

  const handleCallLater = () => {
    setIsOpen(false)
    setStep(1)
    setForm({ name: '', phone: '', city: '' })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center gap-3 px-12 py-4 rounded-full text-lg font-semibold text-white bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 shadow-lg shadow-green-600/20 transition-all duration-300 ${className || ''}`}
      >
        {buttonText ? buttonText : (
          <>
            <FaWhatsapp size={22} />
            {copy.buttonCta}
          </>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              dir={locale === 'he' ? 'rtl' : 'ltr'}
              className="bg-white text-gray-900 rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setIsOpen(false); setStep(1) }}
                className={`absolute top-4 text-gray-400 hover:text-gray-700 transition ${locale === 'he' ? 'left-4' : 'right-4'}`}
              >
                ✕
              </button>

              {step === 1 && (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">{copy.modalTitle}</h2>
                  <p className="text-sm text-gray-500 mb-6">{copy.modalSubtitle}</p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                      type="text"
                      name="name"
                      placeholder={copy.namePlaceholder}
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="tel"
                      name="phone"
                      placeholder={copy.phonePlaceholder}
                      value={form.phone}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      name="city"
                      placeholder={copy.cityPlaceholder}
                      value={form.city}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-500 transition disabled:opacity-50"
                    >
                      {loading ? copy.sending : copy.submitButton}
                    </button>
                  </form>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">{copy.step2Title}</h2>
                  <div className="space-y-3">
                    <button
                      onClick={handleWhatsApp}
                      className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-500 flex justify-center items-center gap-2 transition"
                    >
                      <FaWhatsapp size={22} />
                      {copy.whatsappButton}
                    </button>
                    <button
                      onClick={handleCallLater}
                      className="w-full border-2 border-gray-300 py-4 rounded-xl hover:bg-gray-50 font-semibold text-gray-700 transition"
                    >
                      {copy.callButton}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}



