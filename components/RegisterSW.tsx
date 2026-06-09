'use client';

import { useEffect } from 'react';

// Registers the service worker in production. Skipped in dev so it never
// interferes with hot reloading.
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
