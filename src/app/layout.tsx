import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from 'src/components/ServiceWorkerRegister';
import Navigation from 'src/components/Navigation';
import { APP_DESCRIPTION, APP_SHORT_TITLE, APP_TITLE } from 'src/config';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_SHORT_TITLE,
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased font-sans pb-[safe-area-inset-bottom]`}>
        <div className="flex flex-col min-h-screen w-full max-w-md mx-auto bg-white dark:bg-slate-800 shadow-lg relative pb-20">
          {children}
          <Navigation />
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
