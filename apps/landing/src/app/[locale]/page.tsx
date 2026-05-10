import { setRequestLocale } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import ScreenshotShowcase from '@/components/ScreenshotShowcase';
import ProofSection from '@/components/ProofSection';
import Pricing from '@/components/Pricing';
import TrialBanner from '@/components/TrialBanner';
import Footer from '@/components/Footer';
import ScrollAnimationInit from '@/components/ScrollAnimationInit';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alumincrm.com';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'AluminCRM',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description:
        'AI-powered CRM built for aluminum, pergola and construction companies. Track leads, automate follow-ups, manage workers and payroll.',
      offers: [
        {
          '@type': 'Offer',
          name: 'Starter',
          price: '49',
          priceCurrency: 'USD',
          billingIncrement: 'P1M',
        },
        {
          '@type': 'Offer',
          name: 'Professional',
          price: '99',
          priceCurrency: 'USD',
          billingIncrement: 'P1M',
        },
        {
          '@type': 'Offer',
          name: 'Enterprise',
          price: '199',
          priceCurrency: 'USD',
          billingIncrement: 'P1M',
        },
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '300',
        bestRating: '5',
      },
      featureList: [
        'Visual Deal Pipeline',
        'AI Sales Assistant',
        'WhatsApp Integration',
        'Workers & Payroll Management',
        'Analytics & Reports',
        'Multi-Language Support (EN, RU, SR, HE)',
      ],
    },
    {
      '@type': 'Organization',
      name: 'AluminCRM',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'sales@alumincrm.com',
      },
      sameAs: [],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is AluminCRM?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'AluminCRM is an AI-powered CRM software built specifically for aluminum, pergola and construction companies. It helps track leads, manage deals, automate follow-ups via WhatsApp, and generate professional proposals.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is there a free trial?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. AluminCRM offers a 14-day free trial with full access to all Professional features. No credit card required.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does AluminCRM support Hebrew (RTL)?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. AluminCRM fully supports Hebrew with right-to-left layout, as well as Russian, English and Serbian.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does AluminCRM integrate with WhatsApp?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. AluminCRM has built-in WhatsApp integration — send and receive messages, share documents and automate follow-ups directly from the CRM.',
          },
        },
      ],
    },
  ],
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScrollAnimationInit />
      <Nav />
      <main>
        <Hero />
        <Features />
        <ScreenshotShowcase />
        <ProofSection />
        <Pricing />
        <TrialBanner />
      </main>
      <Footer />
    </>
  );
}
