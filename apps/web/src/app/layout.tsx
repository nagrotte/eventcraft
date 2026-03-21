import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/AppProviders';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title:       'EventCraft - Invitation Studio',
  description: 'Design and send beautiful event invitations',
  icons: {
    icon:    [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple:    '/favicon.svg',
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