"use client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import type { Locale } from "@/lib/locales";

const services = [
  {
    title: "פרגולות אלומיניום",
    desc: "פתרונות הצללה איכותיים בעיצוב מודרני לכל בית ולכל סגנון חיים.",
    img: "/images/services/pergola.webp",
    link: "/pergulas",
  },
  {
    title: "מעקות אלומיניום בשילוב זכוכית",
    desc: "שילוב של יוקרה ובטיחות למרפסות, מדרגות וגגות – בהתאמה מושלמת לבית שלך.",
    img: "/images/services/railings.webp",
    link: "/railings",
  },
  {
    title: "גדרות אלומיניום",
    desc: "פתרון עמיד ואסתטי להגנה על הבית שלך – ללא תחזוקה וללא דאגות.",
    img: "/images/services/fence.webp",
    link: "/fences",
  },
  {
    title: "מסתורי כביסה",
    desc: "שילוב של פונקציונליות ועיצוב להסתרת אזורי כביסה בצורה אלגנטית ומודרנית.",
    img: "/images/services/mistora.webp",
    link: "/mistora",
  },
];

export function ServicesSection({ locale }: { locale: Locale }) {
  return (
    <section
      id="services"
      className="relative py-24 text-white"
      style={{
        background: 'linear-gradient(to bottom, #0f172a, #1e293b)'
      }}
    >
      <div className="container mx-auto px-4 text-center ">
        <h2 className="text-4xl font-extrabold mb-14">השירותים שלנו</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {services.map((service, index) => (
            <Link
              key={index}
              href={`/${locale}${service.link}`}
              className="group bg-[#1e293b] hover:bg-[#334155] rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2 cursor-pointer"
            >
              <div className="relative w-full h-56 overflow-hidden bg-gray-800">
                <Image
                  src={service.img}
                  alt={service.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  loading={index < 2 ? "eager" : "lazy"}
                  quality={80}
                  placeholder="blur"
                  blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAW9JTEQAAAABJRU5ErkJggg=="
                />
              </div>
              <div className="p-6 text-right">
                <h3 className="text-2xl font-semibold mb-3">{service.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {service.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </section>
  );
}
