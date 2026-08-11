import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PORTAL_SESSION_TTL_SECONDS,
  createPortalSessionToken,
  verifyPortalSessionToken,
} from './portalSession.ts';

const SECRET = 'test-session-secret-with-at-least-thirty-two-characters';
const NOW = Date.UTC(2026, 7, 11, 12, 0, 0);

test('creates and verifies a normalized portal session', () => {
  const token = createPortalSessionToken(' Customer@Example.com ', { now: NOW, secret: SECRET });
  const session = verifyPortalSessionToken(token, { now: NOW + 1_000, secret: SECRET });

  assert.equal(session?.email, 'customer@example.com');
  assert.equal(session?.expiresAt, NOW + PORTAL_SESSION_TTL_SECONDS * 1000);
});

test('rejects tampered portal sessions', () => {
  const token = createPortalSessionToken('customer@example.com', { now: NOW, secret: SECRET });
  const [payload, signature] = token.split('.');
  const tampered = `${payload.slice(0, -1)}A.${signature}`;

  assert.equal(verifyPortalSessionToken(tampered, { now: NOW, secret: SECRET }), null);
});

test('rejects expired portal sessions', () => {
  const token = createPortalSessionToken('customer@example.com', { now: NOW, secret: SECRET });

  assert.equal(
    verifyPortalSessionToken(token, {
      now: NOW + PORTAL_SESSION_TTL_SECONDS * 1000 + 1,
      secret: SECRET,
    }),
    null,
  );
});

test('requires a strong session secret', () => {
  assert.throws(
    () => createPortalSessionToken('customer@example.com', { now: NOW, secret: 'too-short' }),
    /at least 32 characters/,
  );
});
