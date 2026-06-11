'use client';

import { useEffect } from 'react';

// The build id this page was built from (baked in at build time).
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;

// Registers the service worker (offline + caching) AND keeps a running PWA
// current. An installed iOS PWA resumed from background never re-navigates, so
// it can run a stale build indefinitely (network-first HTML only helps on a
// fresh launch). On every foreground we ask the SW to re-check and compare our
// baked build id against the live deployment's `/api/build`; if a newer build
// is live, reload once to pick it up. Skipped in dev (no SW, no stale builds).
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    let reg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((r) => {
          reg = r;
        })
        .catch(() => {});
    }

    let reloading = false;
    const checkForUpdate = async () => {
      if (document.visibilityState !== 'visible' || reloading) return;
      reg?.update().catch(() => {});
      if (!BUILD_ID) return;
      try {
        const res = await fetch('/api/build', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== BUILD_ID) {
          reloading = true;
          window.location.reload();
        }
      } catch {
        // offline / transient — ignore
      }
    };

    document.addEventListener('visibilitychange', checkForUpdate);
    return () => document.removeEventListener('visibilitychange', checkForUpdate);
  }, []);

  return null;
}
