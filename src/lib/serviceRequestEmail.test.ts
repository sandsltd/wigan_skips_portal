import assert from 'node:assert/strict';
import test from 'node:test';

import type { PortalAccount } from './portalAccounts.ts';
import {
  buildServiceRequestEmail,
  ServiceRequestEmailConfigurationError,
} from './serviceRequestEmail.ts';

const customer = {
  business_name: 'Example & Sons <Ltd>',
  unique_reference: 'CUST-123',
  collection_address: '1 Test Street',
  collection_city: 'Wigan',
  collection_postcode: 'WN1 1AA',
  contact_number_1: '01942 000000',
} as PortalAccount;

test('builds a tenant-only service request email with escaped customer content', () => {
  const message = buildServiceRequestEmail({
    config: { businessName: 'Tenant Waste', emailAddress: 'Jobs@Tenant.test' },
    customer,
    portalLoginEmail: 'Customer@Example.test',
    serviceType: 'exchange',
    description: '<script>alert("x")</script> exchange one skip',
    additionalInfo: 'Call me & confirm',
  });

  assert.equal(message.to, 'jobs@tenant.test');
  assert.equal(message.replyTo, 'customer@example.test');
  assert.match(message.subject, /New exchange request/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /Call me &amp; confirm/);
  assert.match(message.text, /Service type: Exchange/);
});

test('fails closed when the tenant email is missing', () => {
  assert.throws(
    () => buildServiceRequestEmail({
      config: { businessName: 'Tenant Waste', emailAddress: '' },
      customer,
      portalLoginEmail: 'customer@example.test',
      serviceType: 'collection',
      description: 'One skip',
      additionalInfo: '',
    }),
    ServiceRequestEmailConfigurationError,
  );
});
