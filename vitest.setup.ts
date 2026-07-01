// Shared test setup. Guarded so it's a no-op under the node environment (pure
// lib tests) and only patches the DOM for jsdom component tests.
if (typeof window !== 'undefined' && !window.matchMedia) {
  // MUI/emotion may query matchMedia; jsdom doesn't implement it.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
