import { NextResponse } from 'next/server';
import { AUTH_COOKIE, AUTH_MAX_AGE, expectedToken } from '@/lib/auth';

export async function POST(req: Request) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    return NextResponse.json(
      { error: 'App password is not configured on the server.' },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== pw) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const token = await expectedToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token!, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
