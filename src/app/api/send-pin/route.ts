import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPinEmail, generatePin } from '@/lib/email';

// Rate limiting for PIN requests (stricter than email check)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // Only 3 PIN requests per minute per IP

// Track email-based rate limiting to prevent spam
const emailRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const EMAIL_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const EMAIL_RATE_LIMIT_MAX = 3; // Only 3 PINs per email per 5 minutes

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

function isEmailRateLimited(email: string): boolean {
  const now = Date.now();
  const record = emailRateLimitMap.get(email);

  if (!record || now > record.resetTime) {
    emailRateLimitMap.set(email, { count: 1, resetTime: now + EMAIL_RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= EMAIL_RATE_LIMIT_MAX) {
    return true;
  }

  record.count++;
  return false;
}

// Sanitize and validate email
function sanitizeEmail(email: string): string {
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }
  return sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    let sanitizedEmail: string;
    try {
      sanitizedEmail = sanitizeEmail(email);
    } catch {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Email-based rate limiting
    if (isEmailRateLimited(sanitizedEmail)) {
      return NextResponse.json(
        { error: 'Too many verification requests for this email. Please wait 5 minutes.' },
        { status: 429 }
      );
    }

    // Check if customer exists
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customer_list')
      .select('id, customer, first_name, email')
      .or(`email.ilike.%${sanitizedEmail}%`)
      .limit(1)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Generate PIN
    const pin = generatePin();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Get the actual email for database operations (without escape chars)
    const dbEmail = email.toLowerCase().trim();

    // Delete any existing unused PINs for this email
    await supabaseAdmin
      .from('verification_pins')
      .delete()
      .eq('email', dbEmail)
      .eq('verified', false);

    // Store PIN in database
    const { error: pinError } = await supabaseAdmin
      .from('verification_pins')
      .insert({
        email: dbEmail,
        pin: pin.toUpperCase(),
        expires_at: expiresAt.toISOString(),
        verified: false,
        customer_id: customer.id,
      });

    if (pinError) {
      console.error('Failed to store PIN:', pinError);
      return NextResponse.json(
        { error: 'Failed to generate verification code' },
        { status: 500 }
      );
    }

    // Send email
    try {
      await sendPinEmail(
        dbEmail,
        pin,
        customer.first_name || customer.customer
      );
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Clean up the PIN if email fails
      await supabaseAdmin
        .from('verification_pins')
        .delete()
        .eq('email', dbEmail)
        .eq('pin', pin);

      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      email: dbEmail,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
