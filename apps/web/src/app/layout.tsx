import type { Metadata } from 'next';
import { Noto_Sans_Telugu, Noto_Serif, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/AppProviders';

const notoSerif = Noto_Serif({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-noto-serif', display: 'swap' });
const playfair  = Playfair_Display({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-playfair', display: 'swap' });
const notoTelugu = Noto_Sans_Telugu({ subsets: ['telugu'], weight: ['400', '700'], variable: '--font-telugu', display: 'swap' });

export const metadata: Metadata = {
  title:       'EventCraft — Invitation Studio',
  description: 'Create beautiful Indian & Hindu event invitations with AI',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${notoSerif.variable} ${playfair.variable} ${notoTelugu.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
