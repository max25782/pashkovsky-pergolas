import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Syne, DM_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alumincrm.com';

const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  sr: 'sr_RS',
  he: 'he_IL',
};

const KEYWORDS_MAP: Record<string, string[]> = {
  en: [
    'CRM for pergola companies', 'aluminum CRM software', 'construction CRM',
    'pergola business management', 'aluminum windows CRM', 'sales pipeline construction',
    'AI CRM construction', 'WhatsApp CRM', 'deal pipeline software',
  ],
  ru: [
    'CRM для строительных компаний', 'CRM алюминий', 'CRM для пергол',
    'управление сделками строительство', 'CRM с WhatsApp', 'программа для строительного бизнеса',
  ],
  sr: [
    'CRM za građevinske kompanije', 'CRM za pergole', 'aluminijum CRM softver',
    'upravljanje poslovima gradnja', 'CRM sa WhatsApp integracijom',
  ],
  he: [
    'CRM לחברות בנייה', 'CRM לפרגולות', 'תוכנת CRM לאלומיניום',
    'ניהול עסקאות בנייה', 'CRM עם WhatsApp', 'ניהול לידים בנייה',
  ],
};

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'hero' });
  const tMeta = await getTranslations({ locale, namespace: 'footer' });

  const title = `AluminCRM — ${t('headline_1')} ${t('headline_2')}`;
  const description = t('subheadline');
  const canonicalUrl = `${SITE_URL}/${locale}`;
  const ogLocale = OG_LOCALE_MAP[locale] ?? 'en_US';

  return {
    title,
    description,
    keywords: KEYWORDS_MAP[locale] ?? KEYWORDS_MAP.en,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${SITE_URL}/en`,
        ru: `${SITE_URL}/ru`,
        sr: `${SITE_URL}/sr`,
        he: `${SITE_URL}/he`,
        'x-default': `${SITE_URL}/en`,
      },
    },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      alternateLocale: Object.values(OG_LOCALE_MAP).filter((l) => l !== ogLocale),
      url: canonicalUrl,
      siteName: 'AluminCRM',
      title,
      description,
      images: [
        {
          url: '/og.png',
          width: 1200,
          height: 630,
          alt: 'AluminCRM — CRM for Aluminum & Pergola Companies',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og.png'],
      creator: '@alumincrm',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  setRequestLocale(locale as Locale);

  const messages = await getMessages();
  const isRtl = locale === 'he';

  return (
    <html
      lang={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`${syne.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
