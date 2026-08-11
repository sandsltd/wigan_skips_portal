import assert from 'node:assert/strict';
import test from 'node:test';

import { getRequestIp, hashRateLimitSubject } from './portalRateLimit.ts';

const SECRET = 'test-rate-limit-secret-with-at-least-thirty-two-characters';

test('hashes rate-limit subjects without retaining their raw value', () => {
  const first = hashRateLimitSubject('send_pin_email', 'User@Example.com', SECRET);
  const second = hashRateLimitSubject('send_pin_email', ' user@example.com ', SECRET);

  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.equal(first.includes('example.com'), false);
});

test('uses the first forwarded address supplied by the trusted proxy', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
  assert.equal(getRequestIp(headers), '203.0.113.5');
});
