import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export const metadata: Metadata = {
  title: 'Letably - Property Management Platform',
  description: 'Modern property management software for letting agents. Manage properties, tenancies, and payments all in one place.',
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  ...(isDevMode && {
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  }),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: '/',
    siteName: 'Letably',
    title: 'Letably - Property Management Platform',
    description: 'Modern property management software for letting agents. Manage properties, tenancies, and payments all in one place.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Letably - Property Management Platform',
    description: 'Modern property management software for letting agents.',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', sizes: '32x32', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
