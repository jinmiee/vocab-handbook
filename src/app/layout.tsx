import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "src/components/ServiceWorkerRegister";
import Navigation from "src/components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "진미경 개발 단어장",
  description: "아이폰 모바일 학습용 개발 용어 단어장",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "진미경 단어장",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full bg-slate-50 text-slate-900 antialiased font-sans select-none pb-[safe-area-inset-bottom]`}
      >
        <div className="flex flex-col min-h-screen w-full max-w-md mx-auto bg-white shadow-lg relative pb-20">
          {children}
          <Navigation />
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
