import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alumincrm.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AluminCRM — CRM for Aluminum & Pergola Companies',
    template: '%s | AluminCRM',
  },
  description:
    'Close more deals, manage less chaos. The AI-powered CRM built for aluminum, pergola and construction companies.',
  applicationName: 'AluminCRM',
  referrer: 'origin-when-cross-origin',
  authors: [{ name: 'AluminCRM', url: SITE_URL }],
  creator: 'AluminCRM',
  publisher: 'AluminCRM',
  formatDetection: { email: false, address: false, telephone: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
