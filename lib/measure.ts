// Resolve a CSS length (including env()/var()) to pixels via a one-off hidden
// probe element — used to turn safe-area insets / CSS vars into numbers for the
// JS-driven sheet detents.
export function cssPx(value: string): number {
  if (typeof document === 'undefined') return 0;
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;visibility:hidden;height:${value};`;
  document.body.appendChild(el);
  const px = el.getBoundingClientRect().height;
  el.remove();
  return px;
}
