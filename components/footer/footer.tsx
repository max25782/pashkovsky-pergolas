// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-200 py-10 px-6 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Company info */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Pashkovski Group</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            מאז 2019 אנחנו מייצרים פרגולות, מעקות ומסתורים באיכות הגבוהה ביותר בישראל — 
            שילוב של יוקרה, עיצוב ושירות ללא פשרות.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-2">
          <h4 className="text-lg font-semibold mb-2">ניווט מהיר</h4>
          <a href="/" className="hover:text-white transition">דף הבית</a>
          <a href="/pergolas" className="hover:text-white transition">פרגולות</a>
          <a href="/railings" className="hover:text-white transition">מעקות</a>
          <a href="/screens" className="hover:text-white transition">מסתורים</a>
          <a href="/about" className="hover:text-white transition">אודות</a>
          <a href="/contact" className="hover:text-white transition">צור קשר</a>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-lg font-semibold mb-2">צור קשר</h4>
          <p className="text-sm">📍 אזור תעשיה עמנואל</p>
          <p className="text-sm">📞 052-449-4848</p>
          <p className="text-sm">✉️ pash</p>
          <p className="text-sm mt-1">🕒 א׳–ה׳ 08:00–18:00, ו׳ 08:00–13:00</p>
          <div className="flex gap-3 mt-3">
            <a href="https://wa.me/972524494848" target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">TikTok</a>
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
