 

type Locale = "he" | "ru" | "en";

const COPY: Record<Locale, {
  heading: string;
  paragraphs: string[];
  benefits: string[];
}> = {
  he: {
    heading: "לא רק פרגולות – אנחנו בונים איכות, אמינות וחלומות",
    paragraphs: [
      "מאז 2019 אנחנו ב־Pashkovski Group חיים ונושמים אלומיניום – ומגשימים ללקוחות בכל רחבי הארץ את החלום לפינה מושלמת בחצר, במרפסת או בגג. עבורנו זו לא רק עבודה – זו שליחות.",
      "כל פרגולה, מעקה או גדר שאנחנו מתקינים היא תוצאה של שילוב נדיר של ידע מקצועי, חומרי גלם איכותיים ותשומת לב מדוקדקת לכל פרט קטן. אנחנו מלווים את הלקוח משלב הרעיון והייעוץ הראשוני, דרך התכנון המדויק והייצור במפעל, ועד ההתקנה בשטח – הכל תחת קורת גג אחת ובסטנדרטים הגבוהים ביותר.",
      "מה שמייחד אותנו הוא הגישה האישית. אנחנו מאמינים שכל בית שונה, וכל לקוח מגיע עם חלום אחר. לכן כל פתרון שאנחנו מציעים הוא מותאם אישית בדיוק לצרכים שלך, עם עיצוב שמוסיף יוקרה ונוחות לחיים היומיומיים.",
      "עם אלפי מטרים של פרגולות שהותקנו בכל רחבי הארץ ומאות לקוחות מרוצים שממשיכים להמליץ – אנחנו יודעים שהדרך שלנו נכונה: לשלב בין איכות ללא פשרות, עיצוב עכשווי ושירות אנושי בגובה העיניים.",
      "Pashkovski Group – לא רק אלומיניום. אנחנו בונים סגנון חיים."
    ],
    benefits: [
      "🏆 7 שנות אחריות",
      "🏭 ייצור מקומי איכותי",
      "📏 התאמה אישית מלאה",
      "🔩 התקנה מקצועית ואמינה",
      "💬 ליווי אישי משלב הרעיון ועד הסיום",
    ]
  },
  ru: {
    heading: "Не просто перголы — мы создаём качество, надёжность и мечты",
    paragraphs: [
      "С 2019 года Pashkovski Group живёт алюминием — и воплощает мечты клиентов по всей стране о идеальном пространстве во дворе, на террасе или на крыше.",
      "Каждая пергола, перила или забор — результат сочетания профессионального опыта, премиальных материалов и внимания к деталям. Мы сопровождаем клиента от идеи и консультации до проектирования, производства и монтажа — всё под одной крышей и по высочайшим стандартам.",
      "Нас отличает персональный подход: каждый дом уникален, у каждого — свой запрос. Поэтому каждое решение мы настраиваем под клиента, добавляя дому комфорт и премиальный дизайн.",
      "С сотнями довольных клиентов и тысячами квадратных метров установленных конструкций мы уверены в своём пути: качество без компромиссов, современный дизайн и человеческий сервис.",
      "Pashkovski Group — не только алюминий. Мы создаём стиль жизни."
    ],
    benefits: [
      "🏆 7 лет гарантии",
      "🏭 Собственное производство",
      "📏 Индивидуальные решения",
      "🔩 Профессиональный монтаж",
      "💬 Сопровождение от идеи до результата",
    ]
  },
  en: {
    heading: "Not just pergolas – we build quality, trust and dreams",
    paragraphs: [
      "Since 2019, Pashkovski Group has lived and breathed aluminum — turning outdoor dreams into reality across Israel.",
      "Every pergola, railing or fence is the result of rare craftsmanship, premium materials and meticulous attention to detail. We guide clients from concept and consultation through design, in-house manufacturing and on-site installation — under one roof, to the highest standards.",
      "What sets us apart is our personal approach: every home is different, every client unique. We tailor each solution precisely to your needs, adding comfort and premium design to daily life.",
      "With hundreds of happy clients and thousands of square meters installed, we know our path is right: uncompromising quality, contemporary design and human service.",
      "Pashkovski Group — not just aluminum. We build a lifestyle."
    ],
    benefits: [
      "🏆 7-year warranty",
      "🏭 Local in-house manufacturing",
      "📏 Full customization",
      "🔩 Professional installation",
      "💬 Personal guidance from idea to completion",
    ]
  }
};

export default function AboutPage({ params }: { params: { locale: Locale } }) {
  const locale = (params?.locale as Locale) ?? "he";
  const t = COPY[locale];
  const isRTL = locale === "he";

  return (
    <section dir={isRTL ? "rtl" : "ltr"} className="py-24 bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{t.heading}</h2>

        <div className={`mt-8 space-y-5 text-white/90 ${isRTL ? "text-right" : "text-left"}`}>
          {t.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed text-base sm:text-lg">
              {p}
            </p>
          ))}
        </div>

        <div className={`mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 ${isRTL ? "text-right" : "text-left"}`}>
          {t.benefits.map((b, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm sm:text-base">
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
