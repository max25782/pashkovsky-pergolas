import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AluminCRM — CRM for Aluminum & Pergola Companies',
  description:
    'Close more deals, manage less chaos. The AI-powered CRM built for aluminum, pergola and construction companies.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
