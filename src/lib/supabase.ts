import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Server-side client with service role (full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Fetch business config from DB (server-side only)
export async function getBusinessConfig() {
  const [businessResult, colorsResult] = await Promise.all([
    supabaseAdmin.from('business_information').select('*').limit(1).single(),
    supabaseAdmin.from('waste_transfer_note_settings').select('primary_color, section_background_color').limit(1).single(),
  ]);

  const business = businessResult.data;
  const colors = colorsResult.data;

  return {
    businessName: business?.trading_name || business?.business_name || '',
    phoneNumber: business?.phone_number || '',
    emailAddress: business?.email_address || '',
    logoUrl: business?.logo_url || '',
    websiteUrl: business?.website_url || '',
    portalUrl: business?.portal_url || '',
    tagline: business?.description || '',
    primaryColor: colors?.primary_color || '',
    sectionBackgroundColor: colors?.section_background_color || '',
  };
}
