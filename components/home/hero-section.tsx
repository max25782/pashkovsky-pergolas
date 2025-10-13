"use client";

export function HeroSection() {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'he'

  return (
    <section className="relative h-[100vh] min-h-[600px] bg-black text-white overflow-hidden">
      {/* Background video only (no poster) */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/hero/photo_2025-10-03_22-07-08_merged.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-black/30" aria-hidden />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto h-full grid place-content-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
          {lang === 'ru' ? 'Идеальная пергола начинается здесь' : (lang === 'en' ? 'The perfect pergola starts here' : 'הפרגולה המושלמת מתחילה כאן')}
        </h1>
        <p className="text-lg md:text-2xl mb-6 drop-shadow-md">
          {lang === 'ru' ? 'Алюминиевые перголы, идеально подходящие к вашему дому — стильное, долговечное и красивое решение на годы' : (lang === 'en' ? 'Aluminum pergolas, perfectly tailored to your home — stylish, durable and beautiful for years' : 'פרגולות אלומיניום בהתאמה מושלמת לבית שלך – פתרון מעוצב, עמיד ויפהפה לאורך שנים')}
        </p>
      </div>
    </section>
  );
}
