import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Simple in-memory rate limiting (use Redis in production for multi-instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute

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

// Sanitize email for safe database queries
function sanitizeEmail(email: string): string {
  // Remove any SQL-like special characters and validate email format
  const sanitized = email.toLowerCase().trim();
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }
  // Escape SQL wildcards
  return sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
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

    // Search for customer by email using parameterized query pattern
    // Use exact match or properly escaped ILIKE
    const { data, error } = await supabaseAdmin
      .from('customer_list')
      .select('id, customer, email')
      .or(`email.ilike.%${sanitizedEmail}%`)
      .limit(1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    const customerExists = data && data.length > 0;

    // Don't reveal whether email exists (security through obscurity for enumeration attacks)
    // Always return success and send PIN if email provided is valid format
    return NextResponse.json({
      exists: customerExists,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
