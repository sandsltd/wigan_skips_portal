export interface AccountFamilyRow {
  id: string | number;
  unique_reference?: unknown;
  parent_account?: unknown;
  disabled?: unknown;
}

function cleanReference(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isDisabled(value: unknown): boolean {
  if (value === true || value === 1) return true;
  return typeof value === 'string' &&
    ['true', '1', 'yes'].includes(value.trim().toLowerCase());
}

export function getAccountFamilyRoot(account: AccountFamilyRow): string | null {
  const reference = cleanReference(account.unique_reference);
  const explicitParent = cleanReference(account.parent_account);

  if (explicitParent) return explicitParent;
  if (!reference) return null;

  // Compatibility for legacy rows that pre-date the parent_account field.
  return reference.replace(/-C\d+$/i, '') || reference;
}

export function getAccountFamilyRoots(accounts: AccountFamilyRow[]): string[] {
  return Array.from(
    new Set(accounts.map(getAccountFamilyRoot).filter((value): value is string => Boolean(value))),
  );
}

export function mergeActiveFamilyAccounts<T extends AccountFamilyRow>(
  ...groups: Array<T[] | null | undefined>
): T[] {
  const accounts: T[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const account of group || []) {
      if (isDisabled(account.disabled)) continue;

      const id = String(account.id);
      if (seen.has(id)) continue;

      seen.add(id);
      accounts.push(account);
    }
  }

  return accounts;
}
