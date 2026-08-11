import assert from 'node:assert/strict';
import test from 'node:test';

import { isPortalDocumentVisible } from './portalDocuments.ts';

test('fails closed for every supported false portal visibility value', () => {
  for (const value of [false, 0, 'false', 'FALSE', '0', 'no', 'off']) {
    assert.equal(isPortalDocumentVisible(value), false);
  }
});

test('keeps legacy files visible when no visibility metadata exists', () => {
  assert.equal(isPortalDocumentVisible(undefined), true);
  assert.equal(isPortalDocumentVisible(true), true);
});
