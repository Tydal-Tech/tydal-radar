import { describe, it, expect } from 'vitest';
import { directionsUrls } from './directions';

describe('directionsUrls', () => {
  it('builds the google web, google app, and apple maps URLs', () => {
    const enc = encodeURIComponent('123 Main St, Montréal');
    const u = directionsUrls('123 Main St, Montréal');
    expect(u.web).toBe(`https://www.google.com/maps/dir/?api=1&destination=${enc}`);
    expect(u.googleApp).toBe(`comgooglemaps://?daddr=${enc}&directionsmode=driving`);
    expect(u.appleMaps).toBe(`https://maps.apple.com/?daddr=${enc}&dirflg=d`);
  });

  it('percent-encodes spaces, ampersands, and accents in the destination', () => {
    const u = directionsUrls('Café & Bar, Montréal');
    expect(u.web).toContain('Caf%C3%A9'); // é
    expect(u.web).toContain('%20'); // space
    expect(u.web).toContain('%26'); // &
    // no raw spaces anywhere in the built URL
    expect(u.web).not.toContain(' ');
  });

  it('handles an empty destination', () => {
    expect(directionsUrls('').web).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=',
    );
  });
});
