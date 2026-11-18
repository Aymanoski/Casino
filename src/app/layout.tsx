import type { Metadata } from 'next';
import {
  Bebas_Neue,
  Cairo,
  Cormorant_Garamond,
  Inter,
  Reem_Kufi,
} from 'next/font/google';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/toast';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const reemKufi = Reem_Kufi({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700'],
  variable: '--font-reem-kufi',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Casino El Al3ab — Ramadan Tournament & Final Night Showcase',
  description:
    'A luxury Ramadan trivia & game-show tournament culminating in a Grand Final against Marwan Serry.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${cormorant.variable} ${bebas.variable} ${inter.variable} ${reemKufi.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg text-ivory antialiased selection:bg-gold-500 selection:text-bg">
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
