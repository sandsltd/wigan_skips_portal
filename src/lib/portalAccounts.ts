import type { SupabaseClient } from '@supabase/supabase-js';

import { getAccountFamilyRoots, mergeActiveFamilyAccounts } from './accountFamilies.ts';

export interface PortalAccount {
  id: string | number;
  customer: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  portal_login: string | null;
  business_name: string | null;
  unique_reference: string | null;
  parent_account: string | null;
  billing_address: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_postcode: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_postcode: string | null;
  collection_address: string | null;
  collection_city: string | null;
  collection_postcode: string | null;
  phone: string | null;
  contact_number_1: string | null;
  contact_number_2: string | null;
  customer_type: string | null;
  payment_terms: string | null;
  create_date: string | null;
  what3words: string | null;
  special_instructions: string | null;
  disabled: boolean | string | null;
}

export const PORTAL_ACCOUNT_SELECT = `
  id,
  customer,
  first_name,
  last_name,
  full_name,
  email,
  portal_login,
  business_name,
  unique_reference,
  parent_account,
  billing_address,
  billing_street,
  billing_city,
  billing_postcode,
  shipping_address,
  shipping_city,
  shipping_postcode,
  collection_address,
  collection_city,
  collection_postcode,
  phone,
  contact_number_1,
  contact_number_2,
  customer_type,
  payment_terms,
  create_date,
  what3words,
  special_instructions,
  disabled
` as const;

const PORTAL_EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

export function normalizePortalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && PORTAL_EMAIL_PATTERN.test(email) ? email : null;
}

export function matchesPortalEmail(
  account: Pick<PortalAccount, 'email' | 'portal_login'>,
  normalizedEmail: string,
): boolean {
  if (account.email?.trim().toLowerCase() === normalizedEmail) return true;
  return (account.portal_login || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function asPortalAccounts(value: unknown): PortalAccount[] {
  return Array.isArray(value) ? value as PortalAccount[] : [];
}

export async function findDirectPortalAccounts(
  client: SupabaseClient,
  normalizedEmail: string,
): Promise<PortalAccount[]> {
  const pattern = `%${escapeLikePattern(normalizedEmail)}%`;
  const [emailResult, portalLoginResult] = await Promise.all([
    client.from('customer_list').select(PORTAL_ACCOUNT_SELECT).ilike('email', pattern),
    client.from('customer_list').select(PORTAL_ACCOUNT_SELECT).ilike('portal_login', pattern),
  ]);

  if (emailResult.error || portalLoginResult.error) {
    throw new Error(
      `Could not load portal accounts: ${emailResult.error?.message || portalLoginResult.error?.message}`,
    );
  }

  return mergeActiveFamilyAccounts(
    asPortalAccounts(emailResult.data),
    asPortalAccounts(portalLoginResult.data),
  ).filter((account) => matchesPortalEmail(account, normalizedEmail));
}

export async function loadPermittedPortalAccounts(
  client: SupabaseClient,
  normalizedEmail: string,
): Promise<PortalAccount[]> {
  const directAccounts = await findDirectPortalAccounts(client, normalizedEmail);
  const familyRoots = getAccountFamilyRoots(directAccounts);
  if (familyRoots.length === 0) return directAccounts;

  const [rootAccountsResult, childAccountsResult] = await Promise.all([
    client
      .from('customer_list')
      .select(PORTAL_ACCOUNT_SELECT)
      .in('unique_reference', familyRoots),
    client
      .from('customer_list')
      .select(PORTAL_ACCOUNT_SELECT)
      .in('parent_account', familyRoots),
  ]);

  if (rootAccountsResult.error || childAccountsResult.error) {
    throw new Error(
      `Could not load portal account families: ${rootAccountsResult.error?.message || childAccountsResult.error?.message}`,
    );
  }

  return mergeActiveFamilyAccounts(
    directAccounts,
    asPortalAccounts(rootAccountsResult.data),
    asPortalAccounts(childAccountsResult.data),
  );
}

export function formatPortalAccount(account: PortalAccount) {
  return {
    id: account.id,
    name: account.business_name || account.customer || account.full_name || `${account.first_name || ''} ${account.last_name || ''}`.trim(),
    firstName: account.first_name,
    lastName: account.last_name,
    businessName: account.business_name,
    reference: account.unique_reference,
    email: account.email,
    phone: account.contact_number_1 || account.phone,
    phone2: account.contact_number_2,
    billingAddress: account.billing_address,
    billingCity: account.billing_city,
    billingPostcode: account.billing_postcode,
    shippingAddress: account.shipping_address,
    shippingCity: account.shipping_city,
    shippingPostcode: account.shipping_postcode,
    collectionAddress: account.collection_address,
    collectionCity: account.collection_city,
    collectionPostcode: account.collection_postcode,
    customerType: account.customer_type,
    paymentTerms: account.payment_terms,
    customerSince: account.create_date,
    what3words: account.what3words,
    specialInstructions: account.special_instructions,
  };
}
