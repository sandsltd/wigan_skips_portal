import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Brute force protection - track failed attempts
const failedAttemptsMap = new Map<string, { count: number; lockoutUntil: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes lockout after too many failures
const ATTEMPT_WINDOW = 5 * 60 * 1000; // Count attempts within 5 minute window

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 attempts per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }

  record.count++;
  return false;
}

function checkBruteForce(email: string): { blocked: boolean; remainingTime?: number } {
  const now = Date.now();
  const record = failedAttemptsMap.get(email);

  if (!record) {
    return { blocked: false };
  }

  // Check if currently locked out
  if (record.lockoutUntil > now) {
    return { blocked: true, remainingTime: Math.ceil((record.lockoutUntil - now) / 1000 / 60) };
  }

  // Reset if window has passed
  if (now - record.lockoutUntil > ATTEMPT_WINDOW) {
    failedAttemptsMap.delete(email);
    return { blocked: false };
  }

  return { blocked: false };
}

function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const record = failedAttemptsMap.get(email);

  if (!record || now > record.lockoutUntil + ATTEMPT_WINDOW) {
    failedAttemptsMap.set(email, { count: 1, lockoutUntil: 0 });
    return;
  }

  record.count++;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockoutUntil = now + LOCKOUT_DURATION;
  }
}

function clearFailedAttempts(email: string): void {
  failedAttemptsMap.delete(email);
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait and try again.' },
        { status: 429 }
      );
    }

    const { email, pin } = await request.json();

    if (!email || !pin) {
      return NextResponse.json(
        { error: 'Email and PIN are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPin = pin.toUpperCase().trim();

    // Check brute force protection
    const bruteForceCheck = checkBruteForce(normalizedEmail);
    if (bruteForceCheck.blocked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Please try again in ${bruteForceCheck.remainingTime} minutes.` },
        { status: 429 }
      );
    }

    // Find the PIN record
    const { data: pinRecord, error: pinError } = await supabaseAdmin
      .from('verification_pins')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('pin', normalizedPin)
      .eq('verified', false)
      .single();

    if (pinError || !pinRecord) {
      // Record failed attempt for brute force protection
      recordFailedAttempt(normalizedEmail);
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if PIN has expired
    const expiresAt = new Date(pinRecord.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired PIN
      await supabaseAdmin
        .from('verification_pins')
        .delete()
        .eq('id', pinRecord.id);

      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark PIN as verified
    await supabaseAdmin
      .from('verification_pins')
      .update({ verified: true })
      .eq('id', pinRecord.id);

    // Clear failed attempts on successful verification
    clearFailedAttempts(normalizedEmail);

    // Sanitize email for ILIKE query
    const sanitizedEmail = normalizedEmail.replace(/%/g, '\\%').replace(/_/g, '\\_');

    // Get ALL customer accounts linked to this email (excluding disabled accounts)
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('customer_list')
      .select(`
        id,
        customer,
        first_name,
        last_name,
        full_name,
        email,
        business_name,
        unique_reference,
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
      `)
      .or(`email.ilike.%${sanitizedEmail}%`);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    // Find all parent/child account families
    // Extract base references (e.g. "MR-00373" from "MR-00373-C1")
    const activeAccounts = (accounts || []).filter(
      account => account.disabled !== true && account.disabled !== 'true'
    );
    const baseRefs = new Set<string>();
    for (const account of activeAccounts) {
      const ref = account.unique_reference || '';
      // Strip child suffix like -C1, -C2 to get parent reference
      const baseRef = ref.replace(/-C\d+$/, '');
      if (baseRef) baseRefs.add(baseRef);
    }

    // Fetch all related parent/child accounts for matched families
    let allFamilyAccounts = activeAccounts;
    if (baseRefs.size > 0) {
      // Match exact parent ref OR children with -C suffix only (avoids over-matching)
      const orFilter = Array.from(baseRefs)
        .flatMap(ref => [
          `unique_reference.eq.${ref}`,
          `unique_reference.like.${ref}-C%`
        ])
        .join(',');
      const { data: familyAccounts, error: familyError } = await supabaseAdmin
        .from('customer_list')
        .select(`
          id, customer, first_name, last_name, full_name, email,
          business_name, unique_reference, billing_address, billing_street,
          billing_city, billing_postcode, shipping_address, shipping_city,
          shipping_postcode, collection_address, collection_city,
          collection_postcode, phone, contact_number_1, contact_number_2,
          customer_type, payment_terms, create_date, what3words,
          special_instructions, disabled
        `)
        .or(orFilter);

      if (familyError) {
        console.error('Error fetching family accounts:', familyError);
      }

      if (familyAccounts) {
        // Merge: use family accounts but deduplicate by id
        const seen = new Set<number>();
        allFamilyAccounts = [];
        for (const acc of familyAccounts) {
          if (acc.disabled === true || acc.disabled === 'true') continue;
          if (!seen.has(acc.id)) {
            seen.add(acc.id);
            allFamilyAccounts.push(acc);
          }
        }
      }
    }

    // Format accounts
    const formattedAccounts = allFamilyAccounts
      .map(account => ({
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
      }));

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      accounts: formattedAccounts,
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
