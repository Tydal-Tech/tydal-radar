'use client';

import { createContext, useContext } from 'react';
import { useGeolocation } from '@/lib/useGeolocation';

// One shared GPS watcher for the whole app. Calling useGeolocation() in several
// components would start several watchPosition() watches (battery drain on a
// field device) with independent enabled state; this centralizes it.
type Geo = ReturnType<typeof useGeolocation>;

const GeoContext = createContext<Geo | null>(null);

export function GeolocationProvider({ children }: { children: React.ReactNode }) {
  const geo = useGeolocation();
  return <GeoContext.Provider value={geo}>{children}</GeoContext.Provider>;
}

export function useGeo(): Geo {
  const ctx = useContext(GeoContext);
  if (!ctx) throw new Error('useGeo must be used within GeolocationProvider');
  return ctx;
}
