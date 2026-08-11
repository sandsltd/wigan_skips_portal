import { NextResponse } from 'next/server';

import { PORTAL_SESSION_COOKIE } from '@/lib/portalSession';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
