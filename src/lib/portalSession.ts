import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const PORTAL_SESSION_COOKIE = 'paperroute_portal_session';
export const PORTAL_SESSION_TTL_SECONDS = 8 * 60 * 60;

interface PortalSessionPayload {
  version: 1;
  email: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

interface PortalSessionOptions {
  now?: number;
  secret?: string;
}

function getSessionSecret(override?: string): string {
  const secret = override || process.env.PORTAL_SESSION_SECRET || '';
  if (secret.length < 32) {
    throw new Error('PORTAL_SESSION_SECRET must contain at least 32 characters');
  }
  return secret;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function parsePayload(encodedPayload: string): PortalSessionPayload | null {
  try {
    const value = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const payload = value as Record<string, unknown>;
    if (
      payload.version !== 1 ||
      typeof payload.email !== 'string' ||
      typeof payload.issuedAt !== 'number' ||
      typeof payload.expiresAt !== 'number' ||
      typeof payload.nonce !== 'string'
    ) {
      return null;
    }

    return payload as unknown as PortalSessionPayload;
  } catch {
    return null;
  }
}

export function createPortalSessionToken(
  email: string,
  options: PortalSessionOptions = {},
): string {
  const now = options.now ?? Date.now();
  const secret = getSessionSecret(options.secret);
  const payload: PortalSessionPayload = {
    version: 1,
    email: email.trim().toLowerCase(),
    issuedAt: now,
    expiresAt: now + PORTAL_SESSION_TTL_SECONDS * 1000,
    nonce: randomBytes(16).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function verifyPortalSessionToken(
  token: string | null | undefined,
  options: PortalSessionOptions = {},
): PortalSessionPayload | null {
  if (!token) return null;

  const [encodedPayload, suppliedSignature, extra] = token.split('.');
  if (!encodedPayload || !suppliedSignature || extra) return null;

  const secret = getSessionSecret(options.secret);
  const expectedSignature = signPayload(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  const payload = parsePayload(encodedPayload);
  const now = options.now ?? Date.now();
  if (
    !payload ||
    !payload.email ||
    payload.issuedAt > now + 60_000 ||
    payload.expiresAt <= now ||
    payload.expiresAt - payload.issuedAt > PORTAL_SESSION_TTL_SECONDS * 1000
  ) {
    return null;
  }

  return payload;
}

export function portalSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: PORTAL_SESSION_TTL_SECONDS,
  };
}
