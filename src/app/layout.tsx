import type { Metadata, Viewport } from 'next';
import {
  Bebas_Neue,
  Cairo,
  Inter,
  Lalezar,
  Lilita_One,
} from 'next/font/google';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/toast';
import { VideoDemoBridge } from '@/components/layout/VideoDemoBridge';

const lilitaOne = Lilita_One({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-lilita',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const lalezar = Lalezar({
  subsets: ['arabic', 'latin'],
  weight: ['400'],
  variable: '--font-lalezar',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Casino El Al3ab — Ramadan Tournament & Final Night Showcase',
  description:
    'A bold, joyful Ramadan trivia & game-show tournament culminating in a Grand Final against Marwan Serry.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#C4163A',
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
      className={`${lilitaOne.variable} ${bebasNeue.variable} ${inter.variable} ${lalezar.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh theme-paper bg-paper text-ink antialiased selection:bg-gold-400 selection:text-red-900">
        <I18nProvider>
          <AuthProvider>
            <VideoDemoBridge />
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
