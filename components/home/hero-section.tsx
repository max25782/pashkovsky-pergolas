"use client";

import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRef, useState } from "react";
import { uiStore } from "@/stores/ui-store";
import Image from "next/image";

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // 10 картинок
  const steps = Array.from({ length: 7 }, (_, i) => `/hero/step-${i + 1}.webp`);

  // вычисляем какой индекс картинки показывать при скролле
  const [currentFrame, setCurrentFrame] = useState(0);
  const frameMv = useTransform(scrollYProgress, [0, 1], [0, steps.length - 1]);
  useMotionValueEvent(frameMv, "change", (v) => {
    const frame = Math.round(v)
    setCurrentFrame(frame)
    uiStore.setHeroFrame(frame)
  });

  // Build WhatsApp link with localized prefilled text (client-safe)
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'he'
  const prefilledMessage = lang === 'ru'
    ? 'Здравствуйте! Хочу получить предложение на перголу.'
    : (lang === 'en' ? 'Hi! I would like to get a quote for a pergola.' : 'היי! אשמח להצעת מחיר לפרגולה.')
  const whatsappUrl = `https://wa.me/972524494848?text=${encodeURIComponent(prefilledMessage)}`

  return (
    <section ref={ref} className="relative h-[150vh]" style={{ minHeight: '150vh' }}>
      {/* Фиксированная область */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center bg-black text-white" style={{ minHeight: '100vh' }}>
        <motion.div className="absolute inset-0">
          {steps.map((src, i) => {
            // На первом экране рендерим только 0-й кадр; после прокрутки — текущий и соседние
            const shouldRender = currentFrame === 0 ? i === 0 : Math.abs(i - currentFrame) <= 1;
            if (!shouldRender) return null;
            
            return (
              <motion.div
                key={i}
                className="absolute inset-0"
                animate={{ opacity: currentFrame === i ? 1 : 0 }}
                transition={{ duration: 0.3, ease: "linear" }}
              >
                <Image
                  src={src}
                  alt={`Pergola step ${i + 1}`}
                  fill
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  quality={70}
                  className="object-cover"
                  priority={i === 0}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  loading={i === 0 ? "eager" : "lazy"}
                  placeholder="blur"
                  blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAW9JTEQAAAABJRU5ErkJggg=="
                  decoding="async"
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Text (i18n) */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.h1
            className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {typeof document !== 'undefined' && document.documentElement.lang === 'ru' ? 'Идеальная пергола начинается здесь' : (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'The perfect pergola starts here' : 'הפרגולה המושלמת מתחילה כאן')}
          </motion.h1>

          <motion.p
            className="text-lg md:text-2xl mb-6 drop-shadow-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            {typeof document !== 'undefined' && document.documentElement.lang === 'ru' ? 'Алюминиевые перголы, идеально подходящие к вашему дому — стильное, долговечное и красивое решение на годы' : (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'Aluminum pergolas, perfectly tailored to your home — stylish, durable and beautiful for years' : 'פרגולות אלומיניום בהתאמה מושלמת לבית שלך – פתרון מעוצב, עמיד ויפהפה לאורך שנים')}
          </motion.p>

          {/* CTA */}
          <motion.a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-full shadow-lg transition-colors"
            initial={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            style={{
              boxShadow: "0 0 20px rgba(59,130,246,0.5)",
            }}
          >
            {typeof document !== 'undefined' && document.documentElement.lang === 'ru' ? '📞 Получить предложение' : (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? '📞 Get a quote' : '📞 קבל הצעת מחיר')}
          </motion.a>
        </div>
      </div>
    </section>
  );
}


