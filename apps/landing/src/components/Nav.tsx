'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { routing, type Locale } from '@/i18n/routing';
import { LINKS } from '@/lib/config';

const FLAG: Record<Locale, string> = {
  en: '🇬🇧',
  ru: '🇷🇺',
  sr: '🇷🇸',
  he: '🇮🇱',
};

export default function Nav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const segments = window.location.pathname.split('/');
    const loc = segments[1] as Locale;
    if (routing.locales.includes(loc)) setLocale(loc);
  }, []);

  function switchLocale(next: Locale) {
    setLocale(next);
    setIsOpen(false);
    router.replace(pathname, { locale: next });
  }

  const navLinks = [
    { key: 'features', href: '#features' },
    { key: 'pricing', href: '#pricing' },
    { key: 'testimonials', href: '#testimonials' },
  ] as const;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0c0c14]/90 backdrop-blur-xl border-b border-white/5 shadow-xl shadow-black/30'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white" />
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" fillOpacity="0.7" />
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" fillOpacity="0.7" />
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white" />
            </svg>
          </div>
          <span className="font-syne font-700 text-lg text-white tracking-tight">
            Alumin<span className="gradient-text">CRM</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(({ key, href }) => (
            <a
              key={key}
              href={href}
              className="text-sm text-text-2 hover:text-white transition-colors duration-200 font-medium"
            >
              {t(key)}
            </a>
          ))}
        </div>

        {/* Desktop CTA + Locale */}
        <div className="hidden md:flex items-center gap-3">
          {/* Locale switcher */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-sm text-text-2 hover:text-white transition-all">
              <span>{FLAG[locale]}</span>
              <span className="uppercase font-medium">{locale}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute top-full mt-1 end-0 w-32 bg-[#1c1c2e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              {routing.locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => switchLocale(loc)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-violet-600/20 transition-colors ${
                    loc === locale ? 'text-violet-400 bg-violet-600/10' : 'text-text-2 hover:text-white'
                  }`}
                >
                  <span>{FLAG[loc]}</span>
                  <span className="uppercase font-medium">{loc}</span>
                </button>
              ))}
            </div>
          </div>

          <a
            href={LINKS.login}
            className="text-sm text-text-2 hover:text-white transition-colors font-medium px-3 py-1.5"
          >
            {t('login')}
          </a>
          <a
            href={LINKS.register}
            className="btn-shimmer text-sm font-semibold text-white px-4 py-2 rounded-lg shadow-lg shadow-violet-500/20 transition-transform hover:scale-105"
          >
            {t('trial')}
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <div className="w-5 h-4 flex flex-col justify-between">
            <span className={`block h-0.5 bg-white transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`block h-0.5 bg-white transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 bg-white transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </div>
        </button>
      </nav>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-[#13131f]/95 backdrop-blur-xl border-t border-white/5 px-4 py-4 space-y-3">
          {navLinks.map(({ key, href }) => (
            <a
              key={key}
              href={href}
              onClick={() => setIsOpen(false)}
              className="block text-text-2 hover:text-white py-2 text-sm font-medium transition-colors"
            >
              {t(key)}
            </a>
          ))}
          <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                onClick={() => switchLocale(loc)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                  loc === locale
                    ? 'border-violet-500/50 bg-violet-600/15 text-violet-300'
                    : 'border-white/10 bg-white/5 text-text-2 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{FLAG[loc]}</span>
                <span className="uppercase">{loc}</span>
              </button>
            ))}
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href={LINKS.login}
              className="block text-center text-sm text-text-2 hover:text-white py-2 font-medium"
            >
              {t('login')}
            </a>
            <a
              href={LINKS.register}
              onClick={() => setIsOpen(false)}
              className="btn-shimmer block text-center text-sm font-semibold text-white py-2.5 rounded-lg"
            >
              {t('trial')}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
