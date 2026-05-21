import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alumincrm.com';
const LOCALES = ['en', 'ru', 'sr', 'he'] as const;

// English is served at the root path (localePrefix: 'as-needed').
function localeUrl(locale: string): string {
  return locale === 'en' ? `${SITE_URL}/` : `${SITE_URL}/${locale}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return LOCALES.map((locale) => ({
    url: localeUrl(locale),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: locale === 'en' ? 1.0 : 0.8,
  }));
}
