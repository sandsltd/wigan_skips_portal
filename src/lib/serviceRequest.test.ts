import assert from 'node:assert/strict';
import test from 'node:test';

import { parseServiceRequestInput } from './serviceRequest.ts';

test('normalizes a valid service request', () => {
  assert.deepEqual(
    parseServiceRequestInput({
      customerReference: ' CUST-123 ',
      serviceType: 'DELIVERY',
      description: ' Two empty skips ',
      additionalInfo: ' Please call first ',
    }),
    {
      ok: true,
      value: {
        customerReference: 'CUST-123',
        serviceType: 'delivery',
        description: 'Two empty skips',
        additionalInfo: 'Please call first',
      },
    },
  );
});

test('rejects invalid service requests', () => {
  for (const input of [
    null,
    {},
    { customerReference: '../other', serviceType: 'collection', description: 'A skip' },
    { customerReference: 'CUST-123', serviceType: 'removal', description: 'A skip' },
    { customerReference: 'CUST-123', serviceType: 'collection', description: '   ' },
    {
      customerReference: 'CUST-123',
      serviceType: 'collection',
      description: 'x'.repeat(2_001),
    },
  ]) {
    assert.equal(parseServiceRequestInput(input).ok, false);
  }
});
