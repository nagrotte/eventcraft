import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/AppProviders';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title:       'EventCraft - Invitation Studio',
  description: 'Design and send beautiful event invitations',
  icons: {
    icon: [
      { url: '/favicon.svg',       type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon.ico',       type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple:    '/apple-touch-icon.png',
    other: [
      { rel: 'icon', url: '/icon-192.png', sizes: '192x192' },
      { rel: 'icon', url: '/icon-512.png', sizes: '512x512' },
    ],
  },
  openGraph: {
    title:       'EventCraft - Invitation Studio',
    description: 'Design and send beautiful event invitations',
    url:         'https://eventcraft.irotte.com',
    siteName:    'EventCraft',
    images: [{ url: 'https://eventcraft.irotte.com/og-image.png', width: 1200, height: 630, alt: 'EventCraft' }],
    type:        'website',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'EventCraft - Invitation Studio',
    description: 'Design and send beautiful event invitations',
    images:      ['https://eventcraft.irotte.com/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body style={{ fontFamily: 'var(--ec-font)' }} className={inter.variable}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}