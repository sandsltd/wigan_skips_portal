import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    const [businessResult, colorsResult] = await Promise.all([
      supabaseAdmin.from('business_information').select('*').limit(1).single(),
      supabaseAdmin.from('waste_transfer_note_settings').select('primary_color, section_background_color').limit(1).single(),
    ]);

    if (businessResult.error) {
      console.error('Failed to fetch business info:', businessResult.error);
      return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
    }

    const business = businessResult.data;
    const colors = colorsResult.data;

    return NextResponse.json({
      businessName: business.trading_name || business.business_name || '',
      phoneNumber: business.phone_number || '',
      emailAddress: business.email_address || '',
      websiteUrl: business.website_url || '',
      logoUrl: business.logo_url || '',
      portalUrl: business.portal_url || '',
      tagline: business.description || '',
      primaryColor: colors?.primary_color || '',
      sectionBackgroundColor: colors?.section_background_color || '',
    });
  } catch (error) {
    console.error('Config API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
