// Open turn-by-turn directions to a destination, preferring the native app.
//
// iOS: try the Google Maps app via the comgooglemaps:// scheme. If the app
// isn't installed the page stays visible (no app takes over), so after a short
// timeout we fall back to Apple Maps (always present on iOS). If the app DOES
// open, the page is backgrounded (visibilitychange → hidden) and we cancel the
// fallback.
//
// Other platforms (Android/desktop): the google.com/maps universal URL opens
// the Google Maps app on Android and the website elsewhere.

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as Mac with touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function openDirections(destination: string) {
  const enc = encodeURIComponent(destination);
  const web = `https://www.google.com/maps/dir/?api=1&destination=${enc}`;

  if (!isIOS()) {
    window.open(web, '_blank', 'noopener');
    return;
  }

  const googleApp = `comgooglemaps://?daddr=${enc}&directionsmode=driving`;
  const appleMaps = `https://maps.apple.com/?daddr=${enc}&dirflg=d`;

  let handled = false;
  const cleanup = () => {
    document.removeEventListener('visibilitychange', onHide);
    clearTimeout(timer);
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') {
      handled = true; // Google Maps app opened
      cleanup();
    }
  };
  document.addEventListener('visibilitychange', onHide);

  const timer = setTimeout(() => {
    cleanup();
    if (!handled) {
      // Google Maps app not installed → Apple Maps (universal link).
      window.location.href = appleMaps;
    }
  }, 1500);

  // Attempt to launch the Google Maps app.
  window.location.href = googleApp;
}
