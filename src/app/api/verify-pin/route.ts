import { NextRequest, NextResponse } from 'next/server';

import { formatPortalAccount, loadPermittedPortalAccounts, normalizePortalEmail } from '@/lib/portalAccounts';
import {
  PortalRateLimitUnavailableError,
  enforcePortalRateLimits,
  getRequestIp,
} from '@/lib/portalRateLimit';
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  portalSessionCookieOptions,
} from '@/lib/portalSession';
import { supabaseAdmin } from '@/lib/supabase';

function noStoreJson(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const normalizedEmail = normalizePortalEmail(body?.email);
    const normalizedPin = typeof body?.pin === 'string'
      ? body.pin.toUpperCase().trim()
      : '';

    if (!normalizedEmail || !/^[A-Z0-9]{6}$/.test(normalizedPin)) {
      return noStoreJson(
        { error: 'A valid email and six-character verification code are required' },
        { status: 400 },
      );
    }

    const rateLimit = await enforcePortalRateLimits(supabaseAdmin, [
      {
        scope: 'verify_pin_ip',
        subject: getRequestIp(request.headers),
        limit: 20,
        windowSeconds: 5 * 60,
      },
      {
        scope: 'verify_pin_email',
        subject: normalizedEmail,
        limit: 5,
        windowSeconds: 15 * 60,
      },
    ]);

    if (!rateLimit.allowed) {
      return noStoreJson(
        { error: 'Too many verification attempts. Please request a new code later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    // Atomically claim a valid PIN. Concurrent replays re-check verified=false
    // after the winning update commits, so only one request can receive a session.
    const { data: pinRecord, error: pinError } = await supabaseAdmin
      .from('verification_pins')
      .update({ verified: true })
      .eq('email', normalizedEmail)
      .eq('pin', normalizedPin)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle();

    if (pinError) {
      console.error('Could not claim portal PIN:', pinError);
      return noStoreJson({ error: 'Could not verify the code' }, { status: 500 });
    }
    if (!pinRecord) {
      return noStoreJson(
        { error: 'Invalid or expired verification code' },
        { status: 400 },
      );
    }

    const accounts = await loadPermittedPortalAccounts(supabaseAdmin, normalizedEmail);
    if (accounts.length === 0) {
      return noStoreJson(
        { error: 'No active portal accounts are available for this login' },
        { status: 403 },
      );
    }

    const response = noStoreJson({
      success: true,
      message: 'Verification successful',
      accounts: accounts.map(formatPortalAccount),
    });
    response.cookies.set(
      PORTAL_SESSION_COOKIE,
      createPortalSessionToken(normalizedEmail),
      portalSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof PortalRateLimitUnavailableError) {
      console.error(error.message);
      return noStoreJson(
        { error: 'Verification is temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }
    console.error('Portal verification error:', error);
    return noStoreJson({ error: 'Server error' }, { status: 500 });
  }
}
