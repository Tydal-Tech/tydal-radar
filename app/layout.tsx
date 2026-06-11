import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import Providers from './providers';
import RegisterSW from '@/components/RegisterSW';
import './globals.css';

const montserrat = Montserrat({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Tydal Radar',
  description: 'Door-to-door sales radar for commercial cleaning prospects in Montreal.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tydal Radar',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F0F0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>
        {/* Pin the app to the real visual viewport height (fixes the iOS PWA
            bottom gap where 100dvh/100vh can be short on load). Runs before paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function s(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');}s();addEventListener('resize',s);addEventListener('orientationchange',s);})();",
          }}
        />
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
