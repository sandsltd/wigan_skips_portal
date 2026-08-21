import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPortalReport,
  parsePortalReportRange,
} from './portalReporting.ts';

test('defaults to an inclusive 90-day reporting period', () => {
  assert.deepEqual(
    parsePortalReportRange(null, null, new Date('2026-08-21T14:00:00Z')),
    { range: { from: '2026-05-24', to: '2026-08-21' } },
  );
});

test('rejects invalid, reversed, and excessive date ranges', () => {
  assert.deepEqual(
    parsePortalReportRange('2026-02-30', '2026-03-01'),
    { error: 'Dates must use the YYYY-MM-DD format' },
  );
  assert.deepEqual(
    parsePortalReportRange('2026-03-02', '2026-03-01'),
    { error: 'The start date must be on or before the end date' },
  );
  assert.deepEqual(
    parsePortalReportRange('2020-01-01', '2026-03-01'),
    { error: 'The selected period cannot be longer than five years' },
  );
});

test('groups split visits into one commercial collection and totals customer revenue', () => {
  const report = buildPortalReport([
    {
      id: 101,
      status: 'completed',
      stop_type: 'collection',
      service_request_id: 'sr-1',
      completed_at: '2026-08-10T09:00:00Z',
      collection_data: { service_request_reference: 'SR-00000001' },
      financial_data: { revenue: 125, cost: 900 },
      actual_items: [{
        type: 'collection',
        waste_stream: 'Paper',
        actual_quantity: 3,
        actual_weight_kg: 240,
      }],
    },
    {
      id: 102,
      status: 'completed',
      stop_type: 'collection',
      service_request_id: 'sr-1',
      completed_at: '2026-08-11T10:00:00Z',
      collection_data: { service_request_reference: 'SR-00000001' },
      financial_data: { revenue: 0, cost: 700 },
      actual_items: [{
        type: 'collection',
        waste_stream: 'Cardboard',
        actual_quantity: 2,
        actual_weight_kg: 110,
      }],
    },
  ]);

  assert.deepEqual(report.summary, {
    collections: 1,
    totalCostExVat: 125,
    totalWeightKg: 350,
    pendingWeightCollections: 0,
    estimatedWeightCollections: 0,
    pendingCostCollections: 0,
    averageCostExVat: 125,
  });
  assert.deepEqual(report.collections[0], {
    id: 'service:sr-1',
    date: '2026-08-11T10:00:00.000Z',
    reference: 'SR-00000001',
    materials: ['Cardboard', 'Paper'],
    quantity: 5,
    weightKg: 350,
    weightPending: false,
    weightEstimated: false,
    costExVat: 125,
    costPending: false,
  });
});

test('uses raised-invoice pricing and applicable invoice surcharges', () => {
  const report = buildPortalReport([{
    id: 4632,
    status: 'completed',
    stop_type: 'collection',
    service_request_id: 4462,
    completed_at: '2026-07-10T10:11:45Z',
    collection_data: { service_request_reference: 'SR-00004462' },
    financial_data: { revenue: 0 },
    actual_items: [{
      type: 'collection',
      waste_stream: 'Confidential Paper',
      actual_quantity: 3,
    }],
  }], {
    serviceRequests: [{
      id: 4462,
      metadata: {
        collection_type: 'ad_hoc',
        fixed_price_total: 120,
        invoice_raised: true,
        invoice_number: 'SI-424267',
      },
      items: [{
        service_request_id: 4462,
        total_price: 120,
        quantity: 3,
        is_chargeable: true,
        container_data: { billing_type: 'PU', estimated_filled_weight: 320 },
        waste_stream_data: { name: 'Confidential Paper' },
      }],
    }],
    surcharges: [
      { surcharge_type: 'fixed', value: 2, effective_from: '2026-04-13' },
      { surcharge_type: 'percentage', value: 5, effective_from: '2026-08-01' },
    ],
  });

  assert.equal(report.summary.totalCostExVat, 122);
  assert.equal(report.summary.pendingCostCollections, 0);
  assert.equal(report.summary.averageCostExVat, 122);
  assert.equal(report.summary.totalWeightKg, 960);
  assert.equal(report.summary.pendingWeightCollections, 0);
  assert.equal(report.summary.estimatedWeightCollections, 1);
  assert.equal(report.monthly[0].costExVat, 122);
  assert.equal(report.collections[0].costExVat, 122);
  assert.equal(report.collections[0].weightKg, 960);
  assert.equal(report.collections[0].weightPending, false);
  assert.equal(report.collections[0].weightEstimated, true);
  assert.equal(report.wasteStreams[0].weightKg, 960);
  assert.equal(report.wasteStreams[0].estimatedWeightCollections, 1);
});

test('keeps an actual collection weight ahead of the service-request estimate', () => {
  const report = buildPortalReport([{
    id: 30,
    status: 'completed',
    stop_type: 'collection',
    service_request_id: 30,
    completed_at: '2026-07-10T10:11:45Z',
    actual_items: [{
      type: 'collection',
      waste_stream: 'Paper',
      actual_quantity: 2,
      actual_weight_kg: 75,
    }],
  }], {
    serviceRequests: [{
      id: 30,
      metadata: { invoice_raised: true },
      items: [{
        quantity: 2,
        container_data: { estimated_filled_weight: 250 },
        waste_stream_data: { name: 'Paper' },
      }],
    }],
  });

  assert.equal(report.summary.totalWeightKg, 75);
  assert.equal(report.summary.pendingWeightCollections, 0);
  assert.equal(report.summary.estimatedWeightCollections, 0);
  assert.equal(report.collections[0].weightEstimated, false);
});

test('shows pending or approved invoice costs as pending and excludes them from averages', () => {
  const report = buildPortalReport([
    {
      id: 20,
      status: 'completed',
      stop_type: 'collection',
      service_request_id: 20,
      completed_at: '2026-07-10T10:11:45Z',
      financial_data: { revenue: 85 },
    },
    {
      id: 21,
      status: 'completed',
      stop_type: 'collection',
      service_request_id: 21,
      completed_at: '2026-07-11T10:11:45Z',
      financial_data: { revenue: 90 },
    },
    {
      id: 22,
      status: 'completed',
      stop_type: 'collection',
      service_request_id: 22,
      completed_at: '2026-07-12T10:11:45Z',
      financial_data: { revenue: 50 },
    },
  ], {
    serviceRequests: [
      { id: 20, metadata: { fixed_price_total: 120 } },
      { id: 21, metadata: { fixed_price_total: 140, invoice_approved: true } },
      { id: 22, metadata: { fixed_price_total: 100, invoice_raised: true } },
    ],
  });

  assert.equal(report.summary.totalCostExVat, 100);
  assert.equal(report.summary.averageCostExVat, 100);
  assert.equal(report.summary.pendingCostCollections, 2);
  assert.equal(report.monthly[0].pendingCostCollections, 2);
  assert.equal(report.collections.find((row) => row.id === 'service:20')?.costPending, true);
  assert.equal(report.collections.find((row) => row.id === 'service:21')?.costPending, true);
  assert.equal(report.collections.find((row) => row.id === 'service:22')?.costPending, false);
});

test('excludes skipped stops, deliveries, and uncollected items', () => {
  const report = buildPortalReport([
    {
      id: 1,
      status: 'skipped',
      stop_type: 'collection',
      completed_at: '2026-08-01T10:00:00Z',
      financial_data: { revenue: 50 },
    },
    {
      id: 2,
      status: 'completed',
      stop_type: 'depot',
      completed_at: '2026-08-02T10:00:00Z',
      financial_data: { revenue: 50 },
    },
    {
      id: 3,
      status: 'completed',
      stop_type: 'collection',
      completed_at: '2026-08-03T10:00:00Z',
      financial_data: { revenue: 80 },
      actual_items: [
        { type: 'delivery', waste_stream: 'Container', actual_quantity: 1 },
        { type: 'collection', waste_stream: 'Paper', actual_quantity: 2, uncollected: true },
        { type: 'collection', waste_stream: 'Cardboard', actual_quantity: 4, actual_weight_kg: 60 },
      ],
    },
  ]);

  assert.equal(report.summary.collections, 1);
  assert.equal(report.summary.totalCostExVat, 80);
  assert.equal(report.summary.totalWeightKg, 60);
  assert.deepEqual(report.collections[0].materials, ['Cardboard']);
  assert.equal(report.collections[0].quantity, 4);
});

test('uses the collection total as an estimated weight when item weights are unavailable', () => {
  const report = buildPortalReport([{
    id: 9,
    status: 'completed',
    stop_type: 'collection',
    completed_at: '2026-07-01T12:00:00Z',
    collection_data: { total_weight: 75 },
    financial_data: { revenue: '45.50' },
    planned_items: [{ type: 'collection', container: '140L bin', quantity: 2 }],
  }]);

  assert.equal(report.summary.totalWeightKg, 75);
  assert.equal(report.summary.totalCostExVat, 45.5);
  assert.deepEqual(report.wasteStreams, [{
    name: '140L bin',
    collections: 1,
    quantity: 2,
    weightKg: 75,
    pendingWeightCollections: 0,
    estimatedWeightCollections: 1,
  }]);
  assert.equal(report.summary.pendingWeightCollections, 0);
  assert.equal(report.summary.estimatedWeightCollections, 1);
  assert.equal(report.collections[0].weightPending, false);
  assert.equal(report.collections[0].weightEstimated, true);
});

test('marks missing weights as pending but preserves an explicitly recorded zero', () => {
  const report = buildPortalReport([
    {
      id: 10,
      status: 'completed',
      stop_type: 'collection',
      completed_at: '2026-07-02T12:00:00Z',
      financial_data: { revenue: 20 },
      actual_items: [{ type: 'collection', container: 'Bag', actual_quantity: 1 }],
    },
    {
      id: 11,
      status: 'completed',
      stop_type: 'collection',
      completed_at: '2026-07-03T12:00:00Z',
      financial_data: { revenue: 20 },
      actual_items: [{
        type: 'collection',
        container: 'Empty container',
        actual_quantity: 1,
        actual_weight_kg: 0,
      }],
    },
  ]);

  assert.equal(report.summary.totalWeightKg, 0);
  assert.equal(report.summary.pendingWeightCollections, 1);
  assert.equal(report.summary.estimatedWeightCollections, 0);
  assert.equal(report.collections.find((row) => row.id === 'stop:10')?.weightPending, true);
  assert.equal(report.collections.find((row) => row.id === 'stop:11')?.weightPending, false);
});

test('marks driver-estimated and planned weights as estimated', () => {
  const report = buildPortalReport([
    {
      id: 12,
      status: 'completed',
      stop_type: 'collection',
      completed_at: '2026-07-04T12:00:00Z',
      actual_items: [{
        type: 'collection',
        waste_stream: 'Paper',
        actual_quantity: 2,
        actual_weight_kg: 42,
        weight_estimated: true,
      }],
    },
    {
      id: 13,
      status: 'completed',
      stop_type: 'collection',
      completed_at: '2026-07-05T12:00:00Z',
      planned_items: [{
        type: 'collection',
        waste_stream: 'Cardboard',
        quantity: 3,
        total_weight: 90,
      }],
    },
  ]);

  assert.equal(report.summary.totalWeightKg, 132);
  assert.equal(report.summary.pendingWeightCollections, 0);
  assert.equal(report.summary.estimatedWeightCollections, 2);
  assert.ok(report.collections.every((row) => row.weightEstimated));
  assert.ok(report.collections.every((row) => !row.weightPending));
});
