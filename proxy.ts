import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, expectedToken } from '@/lib/auth';

// Gate every page behind the shared password. When APP_PASSWORD is not set
// (unconfigured), the gate stays OPEN so local setup isn't blocked — set
// APP_PASSWORD to activate it. Static assets and the login endpoints are
// excluded via the matcher below. (Next 16 "proxy" convention, formerly
// "middleware".)
export async function proxy(req: NextRequest) {
  const expected = await expectedToken();
  if (!expected) return NextResponse.next(); // unconfigured → open

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except: the login page, login/logout APIs, Next internals,
    // the service worker, manifest, and icon/static assets.
    '/((?!login|api/login|api/logout|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)',
  ],
};
