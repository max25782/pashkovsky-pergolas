"use client";

import { motion } from "framer-motion";

export function HeroSection() {
  // Build WhatsApp link with localized prefilled text (client-safe)
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'he'
  const prefilledMessage = lang === 'ru'
    ? 'Здравствуйте! Хочу получить предложение на перголу.'
    : (lang === 'en' ? 'Hi! I would like to get a quote for a pergola.' : 'היי! אשמח להצעת מחיר לפרגולה.')
  const whatsappUrl = `https://wa.me/972524494848?text=${encodeURIComponent(prefilledMessage)}`

  return (
    <section className="relative h-[100vh] min-h-[600px] bg-black text-white overflow-hidden">
      {/* Background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/hero/photo_2025-10-03_22-07-08_merged.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero/step-1.webp"
      />
      <div className="absolute inset-0 bg-black/30" aria-hidden />

      {/* Text (i18n) */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto h-full grid place-content-center">
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
      
      </div>
    </section>
  );
}
