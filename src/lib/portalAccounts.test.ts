import assert from 'node:assert/strict';
import test from 'node:test';

import { matchesPortalEmail, normalizePortalEmail } from './portalAccounts.ts';

test('normalizes valid portal emails and rejects filter syntax', () => {
  assert.equal(normalizePortalEmail(' User@Example.COM '), 'user@example.com');
  assert.equal(normalizePortalEmail('user@example.com,parent_account.not.is.null'), null);
});

test('matches exact primary and comma-separated portal emails only', () => {
  const account = {
    email: 'accounts@example.com',
    portal_login: 'manager@example.com, second@example.com',
  };

  assert.equal(matchesPortalEmail(account, 'accounts@example.com'), true);
  assert.equal(matchesPortalEmail(account, 'second@example.com'), true);
  assert.equal(matchesPortalEmail(account, 'count@example.com'), false);
});
