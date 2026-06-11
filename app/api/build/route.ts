import { NextResponse } from 'next/server';

// Returns the build id of the LIVE deployment. The running client compares this
// against its own baked-in NEXT_PUBLIC_BUILD_ID on each foreground; when they
// differ a newer build is live, so it reloads (see components/RegisterSW.tsx).
// Dynamic + no-store so a resumed PWA always reads the current deployment.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? '' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
