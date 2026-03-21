import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/AppProviders';

export const metadata: Metadata = {
  title:       'EventCraft — Invitation Studio',
  description: 'Create beautiful Indian & Hindu event invitations with AI',
  icons: {
    icon:  '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title:       'EventCraft',
    description: 'Create beautiful event invitations',
    siteName:    'EventCraft',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu&family=Noto+Serif+Devanagari&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
