import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAccountFamilyRoot,
  getAccountFamilyRoots,
  mergeActiveFamilyAccounts,
} from './accountFamilies.ts';

test('uses parent_account for children whose references do not share the parent prefix', () => {
  assert.equal(
    getAccountFamilyRoot({ id: 7411, unique_reference: 'U6HVHK', parent_account: '4DWTE0' }),
    '4DWTE0',
  );
});

test('uses the explicit parent instead of an unrelated legacy-looking suffix', () => {
  assert.equal(
    getAccountFamilyRoot({
      id: 7115,
      unique_reference: 'MJB-00373-C3',
      parent_account: 'MJB-01814',
    }),
    'MJB-01814',
  );
});

test('keeps a suffix fallback for legacy rows without parent_account', () => {
  assert.equal(
    getAccountFamilyRoot({ id: 2, unique_reference: 'MJB-00373-C2', parent_account: null }),
    'MJB-00373',
  );
});

test('deduplicates family roots from parent and child matches', () => {
  assert.deepEqual(
    getAccountFamilyRoots([
      { id: 1, unique_reference: '4DWTE0', parent_account: null },
      { id: 2, unique_reference: 'U6HVHK', parent_account: '4DWTE0' },
      { id: 3, unique_reference: 'MJB-00373-C4', parent_account: '4DWTE0' },
    ]),
    ['4DWTE0'],
  );
});

test('merges query results without disabled or duplicate accounts', () => {
  assert.deepEqual(
    mergeActiveFamilyAccounts(
      [{ id: 1, unique_reference: '4DWTE0' }],
      [
        { id: 1, unique_reference: '4DWTE0' },
        { id: 2, unique_reference: 'U6HVHK', parent_account: '4DWTE0' },
        { id: 3, unique_reference: 'OLD', disabled: true },
      ],
    ).map((account) => account.unique_reference),
    ['4DWTE0', 'U6HVHK'],
  );
});

test('recognises legacy disabled values', () => {
  assert.deepEqual(
    mergeActiveFamilyAccounts([
      { id: 1, unique_reference: 'ACTIVE', disabled: false },
      { id: 2, unique_reference: 'NUMERIC', disabled: 1 },
      { id: 3, unique_reference: 'TEXT', disabled: 'yes' },
    ]).map((account) => account.unique_reference),
    ['ACTIVE'],
  );
});
