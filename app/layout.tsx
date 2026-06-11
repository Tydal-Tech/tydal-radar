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
  // The on-screen keyboard OVERLAYS the page instead of resizing it, so the app
  // (map + nav) stays static when the search field is focused; only the search
  // sheet lifts above the keyboard (it tracks visualViewport itself).
  interactiveWidget: 'overlays-content',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>
        {/* The layout fills 100dvh via CSS (globals.css + AppShell). This only
            resets any scroll offset whenever the app is (re)opened / foregrounded
            (PWA relaunch, tab refocus, bfcache restore), so an iOS keyboard or
            focus scroll can't leave a stale gap behind. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function r(){window.scrollTo(0,0);}addEventListener('pageshow',r);addEventListener('focus',r);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')r();});})();",
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
