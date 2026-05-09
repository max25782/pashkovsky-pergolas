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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
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
