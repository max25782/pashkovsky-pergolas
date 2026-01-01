'use client'
import { ShieldCheck, Target, Lightbulb, Heart, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/locales'

const features = [
  {
    icon: ShieldCheck,
    title: {
      he: 'אמינות',
      ru: 'Надёжность',
      en: 'Reliability'
    },
    text: {
      he: 'אנו מבטיחים איכות ועמידות לכל פרגולה, תוך שימוש רק בחומרים מאושרים.',
      ru: 'Мы гарантируем качество и долговечность каждой перголы, используя только сертифицированные материалы.',
      en: 'We guarantee quality and durability for every pergola, using only certified materials.'
    }
  },
  {
    icon: Target,
    title: {
      he: 'דיוק',
      ru: 'Точность',
      en: 'Precision'
    },
    text: {
      he: 'מהמדידה ועד ההתקנה — הכל מבוצע בדיוק של מילימטר.',
      ru: 'От замера до установки — всё выполняется с точностью до миллиметра.',
      en: 'From measurement to installation — everything is executed with millimeter precision.'
    }
  },
  {
    icon: Lightbulb,
    title: {
      he: 'חדשנות',
      ru: 'Инновации',
      en: 'Innovation'
    },
    text: {
      he: 'פתרונות מודרניים — מערכות אוטומטיות, LED, טכנולוגיות חכמות ועיצוב אלגנטי.',
      ru: 'Современные решения — автоматические системы, LED, умные технологии и элегантный дизайн.',
      en: 'Modern solutions — automatic systems, LED, smart technologies and elegant design.'
    }
  },
  {
    icon: Heart,
    title: {
      he: 'גישה אישית',
      ru: 'Индивидуальный подход',
      en: 'Personal Approach'
    },
    text: {
      he: 'כל פרגולה נוצרת בהתאמה לסגנון, מידות ואווירה של הבית שלך.',
      ru: 'Каждая пергола создаётся под стиль, размеры и атмосферу вашего дома.',
      en: 'Each pergola is created to match the style, dimensions and atmosphere of your home.'
    }
  },
  {
    icon: Wrench,
    title: {
      he: 'מעטפת מלא',
      ru: 'Полный цикл',
      en: 'Full Cycle'
    },
    text: {
      he: 'מהמדידה ועד התחזוקה — הכל במקום אחד, ללא מתווכים.',
      ru: 'От замера до обслуживания — всё под ключ, без посредников.',
      en: 'From measurement to maintenance — everything turnkey, without intermediaries.'
    }
  },
  // Added: 7-year warranty feature
  {
    icon: ShieldCheck,
    title: {
      he: 'אחריות 7 שנים על הכל',
      ru: 'Гарантия 7 лет на всё',
      en: '7-year warranty on everything'
    },
    text: {
      he: 'אחריות מלאה לכל רכיבי המערכת — מבנה, מנגנונים, צבע והתקנה.',
      ru: 'Полная гарантия на все элементы системы — каркас, механизмы, покрытие и монтаж.',
      en: 'Full warranty for all system components — structure, mechanisms, finish and installation.'
    }
  },
]

const content = {
  title: {
    he: 'למה בוחרים ב',
    ru: 'Почему выбирают',
    en: 'Why Choose'
  },
  subtitle: {
    he: 'אנו משלבים טכנולוגיה, אסתטיקה ואמינות כדי ליצור פרגולות שמעוררות השראה.',
    ru: 'Мы соединяем технологии, эстетику и надёжность, чтобы создавать перголы, которые вдохновляют.',
    en: 'We combine technology, aesthetics and reliability to create pergolas that inspire.'
  }
}

export default function WhyChooseUs({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <section className="w-full py-20 bg-gradient-to-b from-neutral-950 to-neutral-900 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 
          className={`text-3xl sm:text-4xl font-bold mb-4 text-white transition-all duration-700 ease-out
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          {content.title[locale]} <span className="text-white">Pashkovsky Group</span>
        </h2>
        <p 
          className={`text-white/70 mb-12 text-lg transition-all duration-700 ease-out delay-150
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          {content.subtitle[locale]}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 justify-items-center">
          {features.map((f, i) => (
            <div 
              key={i} 
              className={`flex flex-col items-center text-center max-w-xs group transition-all duration-700 ease-out
              ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${300 + i * 150}ms` }}
            >
              <div className="
                w-20 h-20 flex items-center justify-center rounded-full 
                bg-white/10 shadow-inner mb-4 transition-all duration-500 transform
                group-hover:scale-110 group-hover:bg-white/20 group-hover:shadow-md
              ">
                <f.icon size={36} strokeWidth={1.5} className="text-white transition-colors group-hover:text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">{f.title[locale]}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{f.text[locale]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
