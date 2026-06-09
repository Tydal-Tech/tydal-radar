'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

// Tracks the device's GPS position. Watching only starts once `enable()` is
// called (the first use), which is when the browser shows the permission
// prompt. Requires a secure context (HTTPS or localhost).
export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const watchId = useRef<number | null>(null);

  const enable = useCallback(() => setEnabled(true), []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('Location is not available on this device.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied.'
            : 'Could not get your location.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    watchId.current = id;
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [enabled]);

  return { position, error, enabled, enable };
}
