"use client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import type { Locale } from "@/lib/locales";

interface ServiceItem {
  title: { he: string; ru: string; en: string }
  desc: { he: string; ru: string; en: string }
  img: string
  link: string
}

const services: ServiceItem[] = [
  {
    title: { he: "מעקות אלומיניום בשילוב זכוכית", ru: "Перила из алюминия с стеклом", en: "Aluminum & Glass Railings" },
    desc: { he: "שילוב של יוקרה ובטיחות למרפסות, מדרגות וגגות – בהתאמה מושלמת לבית שלך.", ru: "Сочетание эстетики и безопасности для балконов, лестниц и крыш — под ваш дом.", en: "A blend of elegance and safety for balconies, stairs and roofs — tailored to your home." },
    img: "/images/services/railings.webp",
    link: "/railings",
  },
  {
    title: { he: "פרגולות  יוקרה מאלומיניום", ru: "Премиальные перголы из алюминия", en: "Premium Aluminum Pergolas" },
    desc: { he: "פתרונות הצללה יוקרתיים בעיצוב מודרני בהתאמה אישית מלאה – פרגולות אלומיניום שמוסיפות יוקרה, נוחות וערך לכל בית וסגנון חיים.", ru: "Премиальные навесы в современном дизайне и полной кастомизации — добавляют дому комфорт, стиль и ценность.", en: "Luxury shading in a modern, fully custom design — adding comfort, style and value to any home." },
    img: "/images/services/pergola.webp",
    link: "/pergulas",
  },
  {
    title: { he: "גדרות אלומיניום", ru: "Алюминиевые заборы", en: "Aluminum Fences" },
    desc: { he: "פתרון עמיד ואסתטי להגנה על הבית שלך – ללא תחזוקה וללא דאגות.", ru: "Долговечная и эстетичная защита дома — без обслуживания.", en: "Durable, aesthetic home protection — zero maintenance." },
    img: "/images/services/fence.webp",
    link: "/fences",
  },
  {
    title: { he: "מסתורי כביסה", ru: "Экраны для прачечной", en: "Laundry Screens" },
    desc: { he: "שילוב של פונקציונליות ועיצוב להסתרת אזורי כביסה בצורה אלגנטית ומודרנית.", ru: "Функциональный и стильный способ скрыть зону стирки.", en: "A functional and elegant way to conceal laundry areas." },
    img: "/images/services/mistora.webp",
    link: "/mistora",
  },
  {
    title: { he: "חלונות וויטרינות בהתאמה אישית", ru: "Индивидуальные окна и витрины", en: "Custom Aluminum Windows & Storefronts" },
    desc: { he: "יצור והתקנה של חלונות וויטרינות מאלומיניום לפי מידה ועיצוב אישי – פתרון אידיאלי למי שמחפש איכות בלתי מתפשרת, בידוד מושלם ומראה מודרני לאורך שנים.", ru: "Производство и монтаж алюминиевых окон и витрин по вашим размерам и дизайну — качество, изоляция и современный вид.", en: "Manufacture and installation of made‑to‑measure aluminum windows and storefronts — premium quality, insulation, and a modern look." },
    img: "/images/windows/video_2025-10-03_22-01-15.webp",
    link: "/windows",
  },
  {
    title: { he: "מהשטח – רגעים אמיתיים מהעבודה שלנו", ru: "С объектов — настоящие моменты нашей работы", en: "From the Field — Real Moments of Our Work" },
    desc: { he: "כאן זה קורה באמת – מאחורי הקלעים של כל פרויקט. רגעים של עבודה קשה, דיוק, יצירתיות וגם קצת צחוק.", ru: "Закулисье наших проектов: труд, точность, креатив — и немного улыбок.", en: "Behind the scenes of our projects: craft, precision and creativity — with a smile." },
    img: "/images/fromShetah/video_2025-10-03_22-10-19.webp",
    link: "/fromShetah",
  },
];

export function ServicesSection({ locale }: { locale: Locale }) {
  return (
    <section
      id="services"
      className="relative py-24 text-white cv-auto no-motion"
      style={{
        background: 'bg-gradient-to-br from-zinc-900 to-zinc-700)'
      }}
    >
      <div className="container mx-auto px-4 text-center ">
        <h2 className="text-4xl font-extrabold mb-14">{locale==='he' ? 'השירותים שלנו' : locale==='ru' ? 'Наши услуги' : 'Our Services'}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <Link
              key={index}
              href={`/${locale}${service.link}`}
              prefetch={false}
              className="group bg-[#1e293b] hover:bg-[#334155] rounded-3xl shadow-lg hover:shadow-2xl transition-transform duration-150 overflow-hidden transform-gpu md:hover:-translate-y-2 cursor-pointer"
            >
              <div className="relative w-full h-[300px] overflow-hidden bg-gray-800">
                <Image
                  src={service.img}
                  alt={service.title[locale]}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-150 will-change-transform"
                  loading={index < 2 ? "eager" : "lazy"}
                  quality={80}
                  placeholder="blur"
                  blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAW9JTEQAAAABJRU5ErkJggg=="
                  decoding="async"
                />
              </div>
              <div className="p-6 text-right">
                <h3 className="text-2xl font-semibold mb-3">{service.title[locale]}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {service.desc[locale]}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </section>
  );
}
