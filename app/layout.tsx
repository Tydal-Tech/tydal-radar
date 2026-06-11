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
        {/* Pin the app to the real visual viewport height (fixes the iOS PWA
            bottom gap where 100dvh/100vh can be short on load). Runs before paint.
            `resize` keeps the keyboard guard (skip while an input is focused) so
            the layout doesn't jump while typing; but every time the app is
            (re)opened — PWA relaunch, tab refocus, bfcache restore — we force a
            re-assert (no guard) plus scrollTo(0,0) so there's never a stale
            offset/gap. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function h(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');}function s(){var a=document.activeElement;if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'))return;h();}function f(){h();window.scrollTo(0,0);}s();addEventListener('resize',s);addEventListener('orientationchange',s);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')f();});addEventListener('pageshow',f);addEventListener('focus',f);})();",
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
