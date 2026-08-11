import { after, NextRequest, NextResponse } from 'next/server';

import { sendPinEmail, generatePin } from '@/lib/email';
import { findDirectPortalAccounts, normalizePortalEmail } from '@/lib/portalAccounts';
import {
  PortalRateLimitUnavailableError,
  enforcePortalRateLimits,
  getRequestIp,
} from '@/lib/portalRateLimit';
import { supabaseAdmin } from '@/lib/supabase';

const MINIMUM_RESPONSE_TIME_MS = 600;
const GENERIC_RESPONSE = {
  success: true,
  message: 'If this email is registered, a verification code has been sent.',
};

function noStoreJson(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function waitForMinimumResponseTime(startedAt: number) {
  const remaining = MINIMUM_RESPONSE_TIME_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const normalizedEmail = normalizePortalEmail(body?.email);
    if (!normalizedEmail) {
      return noStoreJson({ error: 'A valid email is required' }, { status: 400 });
    }

    const rateLimit = await enforcePortalRateLimits(supabaseAdmin, [
      {
        scope: 'send_pin_ip',
        subject: getRequestIp(request.headers),
        limit: 3,
        windowSeconds: 60,
      },
      {
        scope: 'send_pin_email',
        subject: normalizedEmail,
        limit: 3,
        windowSeconds: 5 * 60,
      },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { error: 'Too many verification requests. Please wait and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const accounts = await findDirectPortalAccounts(supabaseAdmin, normalizedEmail);
    const customer = accounts[0];
    if (!customer) {
      await waitForMinimumResponseTime(startedAt);
      return noStoreJson(GENERIC_RESPONSE);
    }

    const pin = generatePin();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const { error: deleteError } = await supabaseAdmin
      .from('verification_pins')
      .delete()
      .eq('email', normalizedEmail)
      .eq('verified', false);
    if (deleteError) throw deleteError;

    const { data: pinRecord, error: pinError } = await supabaseAdmin
      .from('verification_pins')
      .insert({
        email: normalizedEmail,
        pin,
        expires_at: expiresAt.toISOString(),
        verified: false,
        customer_id: customer.id,
      })
      .select('id')
      .single();
    if (pinError || !pinRecord) throw pinError || new Error('PIN record was not created');

    // Run provider delivery after the uniform HTTP response. This prevents
    // email-provider latency from becoming an account-enumeration signal.
    after(async () => {
      try {
        await sendPinEmail(
          normalizedEmail,
          pin,
          customer.first_name || customer.customer || undefined,
        );
      } catch (emailError) {
        console.error('Portal PIN delivery failed:', emailError);
        await supabaseAdmin.from('verification_pins').delete().eq('id', pinRecord.id);
      }
    });

    await waitForMinimumResponseTime(startedAt);
    return noStoreJson(GENERIC_RESPONSE);
  } catch (error) {
    if (error instanceof PortalRateLimitUnavailableError) {
      console.error(error.message);
      return noStoreJson(
        { error: 'Verification is temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }
    console.error('Portal PIN request error:', error);
    return noStoreJson(
      { error: 'Verification is temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }
}
