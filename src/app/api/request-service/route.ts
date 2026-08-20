import { NextRequest, NextResponse } from 'next/server';

import { loadPermittedPortalAccounts } from '@/lib/portalAccounts';
import {
  PortalRateLimitUnavailableError,
  enforcePortalRateLimits,
  getRequestIp,
} from '@/lib/portalRateLimit';
import { parseServiceRequestInput } from '@/lib/serviceRequest';
import {
  sendServiceRequestEmail,
  ServiceRequestEmailConfigurationError,
} from '@/lib/serviceRequestEmail';
import { PORTAL_SESSION_COOKIE, verifyPortalSessionToken } from '@/lib/portalSession';
import { getBusinessConfig, supabaseAdmin } from '@/lib/supabase';

function noStoreJson(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
}

function unauthorizedResponse() {
  const response = noStoreJson({ error: 'Please sign in to request a service' }, { status: 401 });
  response.cookies.set(PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    const session = verifyPortalSessionToken(token);
    if (!session) return unauthorizedResponse();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: 'A valid service request is required' }, { status: 400 });
    }

    const parsed = parseServiceRequestInput(body);
    if (!parsed.ok) return noStoreJson({ error: parsed.error }, { status: 400 });

    const rateLimit = await enforcePortalRateLimits(supabaseAdmin, [
      {
        scope: 'service_request_ip',
        subject: getRequestIp(request.headers),
        limit: 10,
        windowSeconds: 60 * 60,
      },
      {
        scope: 'service_request_session',
        subject: session.email,
        limit: 5,
        windowSeconds: 60 * 60,
      },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { error: 'Too many service requests. Please wait before trying again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const permittedAccounts = await loadPermittedPortalAccounts(supabaseAdmin, session.email);
    const requestedReference = parsed.value.customerReference.toUpperCase();
    const customer = permittedAccounts.find(
      (account) => account.unique_reference?.trim().toUpperCase() === requestedReference,
    );
    if (!customer) {
      return noStoreJson(
        { error: 'This account is not available to your portal login' },
        { status: 403 },
      );
    }

    const config = await getBusinessConfig();
    await sendServiceRequestEmail({
      config,
      customer,
      portalLoginEmail: session.email,
      serviceType: parsed.value.serviceType,
      description: parsed.value.description,
      additionalInfo: parsed.value.additionalInfo,
    });

    return noStoreJson({ success: true });
  } catch (error) {
    if (error instanceof PortalRateLimitUnavailableError) {
      console.error(error.message);
      return noStoreJson(
        { error: 'Service requests are temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }
    if (error instanceof ServiceRequestEmailConfigurationError) {
      console.error(error.message);
      return noStoreJson(
        { error: 'Service requests are not configured for this portal yet.' },
        { status: 503 },
      );
    }
    console.error('Portal service request error:', error);
    return noStoreJson({ error: 'The service request could not be sent' }, { status: 500 });
  }
}
