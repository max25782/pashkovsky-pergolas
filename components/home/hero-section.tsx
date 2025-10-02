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

  return (
    <section ref={ref} className="relative h-[150vh]">
      {/* Фиксированная область */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center bg-black text-white">
        <motion.div className="absolute inset-0">
          {steps.map((src, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              animate={{ opacity: currentFrame === i ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            >
              <Image
                src={src}
                alt={`Pergola step ${i + 1}`}
                fill
                className="object-cover"
                priority={i === 0}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Текст */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.h1
            className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            הפרגולה המושלמת מתחילה כאן
          </motion.h1>

          <motion.p
            className="text-lg md:text-2xl mb-6 drop-shadow-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            פרגולות אלומיניום בהתאמה מושלמת לבית שלך – פתרון מעוצב, עמיד ויפהפה לאורך שנים
          </motion.p>

          {/* CTA */}
          <motion.a
            href="tel:0524494848"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-full shadow-lg transition-colors"
            initial={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            style={{
              boxShadow: "0 0 20px rgba(59,130,246,0.5)",
            }}
          >
            📞 קבל הצעת מחיר
          </motion.a>
        </div>
      </div>
    </section>
  );
}


