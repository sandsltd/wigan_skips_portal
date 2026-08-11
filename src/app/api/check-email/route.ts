import { NextRequest, NextResponse } from 'next/server';

import { normalizePortalEmail } from '@/lib/portalAccounts';
import {
  PortalRateLimitUnavailableError,
  enforcePortalRateLimits,
  getRequestIp,
} from '@/lib/portalRateLimit';
import { supabaseAdmin } from '@/lib/supabase';

function noStoreJson(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

// Retained for compatibility with older clients. It deliberately performs no
// customer lookup and returns the same response for every valid email.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const normalizedEmail = normalizePortalEmail(body?.email);
    if (!normalizedEmail) {
      return noStoreJson({ error: 'A valid email is required' }, { status: 400 });
    }

    const rateLimit = await enforcePortalRateLimits(supabaseAdmin, [{
      scope: 'check_email_ip',
      subject: getRequestIp(request.headers),
      limit: 5,
      windowSeconds: 60,
    }]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { error: 'Too many requests. Please wait and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    return noStoreJson({
      success: true,
      message: 'If this email is registered, a verification code can be requested.',
    });
  } catch (error) {
    if (error instanceof PortalRateLimitUnavailableError) {
      console.error(error.message);
      return noStoreJson({ error: 'Service temporarily unavailable' }, { status: 503 });
    }
    console.error('Portal email check error:', error);
    return noStoreJson({ error: 'Server error' }, { status: 500 });
  }
}
