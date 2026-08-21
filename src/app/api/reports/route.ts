import { NextRequest, NextResponse } from 'next/server';

import { loadPermittedPortalAccounts } from '@/lib/portalAccounts';
import {
  buildPortalReport,
  parsePortalReportRange,
  type PortalReportPricingContext,
  type PortalReportSourceServiceRequest,
  type PortalReportSourceServiceRequestItem,
  type PortalReportSourceStop,
} from '@/lib/portalReporting';
import {
  PortalRateLimitUnavailableError,
  enforcePortalRateLimits,
  getRequestIp,
} from '@/lib/portalRateLimit';
import { PORTAL_SESSION_COOKIE, verifyPortalSessionToken } from '@/lib/portalSession';
import { supabaseAdmin } from '@/lib/supabase';

const PAGE_SIZE = 1_000;
const MAX_REPORT_STOPS = 10_000;
const PRICING_BATCH_SIZE = 200;

function noStoreJson(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
}

function unauthorizedResponse() {
  const response = noStoreJson({ error: 'Please sign in to view reports' }, { status: 401 });
  response.cookies.set(PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}

function isValidReference(reference: string): boolean {
  return Boolean(reference)
    && reference.length <= 50
    && !reference.includes('..')
    && !reference.includes('/')
    && !reference.includes('\\')
    && /^[A-Za-z0-9\-_ ]+$/.test(reference);
}

async function loadReportStops(
  customerReference: string,
  from: string,
  to: string,
): Promise<PortalReportSourceStop[]> {
  const stops: PortalReportSourceStop[] = [];
  const fromTimestamp = `${from}T00:00:00.000Z`;
  const toTimestamp = `${to}T23:59:59.999Z`;

  for (let offset = 0; offset < MAX_REPORT_STOPS; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('route_stops_v2')
      .select(`
        id,
        status,
        stop_type,
        customer_reference,
        completed_at,
        service_request_id,
        actual_items,
        planned_items,
        collection_data,
        financial_data
      `)
      .eq('customer_reference', customerReference)
      .eq('status', 'completed')
      .eq('stop_type', 'collection')
      .gte('completed_at', fromTimestamp)
      .lte('completed_at', toTimestamp)
      .order('completed_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = Array.isArray(data) ? data as PortalReportSourceStop[] : [];
    stops.push(...page);
    if (page.length < PAGE_SIZE) return stops;
  }

  throw new Error('The selected report contains too many collection records');
}

async function loadReportPricing(
  stops: PortalReportSourceStop[],
): Promise<PortalReportPricingContext> {
  const serviceRequestIds = [...new Set(
    stops
      .map((stop) => stop.service_request_id)
      .filter((id): id is string | number => id !== null && id !== undefined && id !== ''),
  )];
  if (serviceRequestIds.length === 0) return {};

  const serviceRequests: PortalReportSourceServiceRequest[] = [];
  const items: PortalReportSourceServiceRequestItem[] = [];
  for (let offset = 0; offset < serviceRequestIds.length; offset += PRICING_BATCH_SIZE) {
    const ids = serviceRequestIds.slice(offset, offset + PRICING_BATCH_SIZE);
    const [requestsResult, itemsResult] = await Promise.all([
      supabaseAdmin
        .from('service_requests')
        .select('id,metadata')
        .in('id', ids),
      supabaseAdmin
        .from('service_request_items')
        .select(`
          service_request_id,
          container_id,
          base_price,
          total_price,
          total_weight,
          manual_price,
          quantity,
          manual_quantity,
          is_chargeable,
          is_delivery,
          billing_type,
          container_data,
          waste_stream_data,
          pricing_package_data
        `)
        .in('service_request_id', ids),
    ]);
    if (requestsResult.error) throw requestsResult.error;
    if (itemsResult.error) throw itemsResult.error;
    serviceRequests.push(...(requestsResult.data || []));
    items.push(...(itemsResult.data || []));
  }

  const itemsByRequest = new Map<string, PortalReportSourceServiceRequestItem[]>();
  for (const item of items) {
    const requestId = String(item.service_request_id);
    const requestItems = itemsByRequest.get(requestId) || [];
    requestItems.push(item);
    itemsByRequest.set(requestId, requestItems);
  }

  const currentSurchargeResult = await supabaseAdmin
    .from('invoice_surcharges')
    .select('surcharge_type,value,effective_from')
    .eq('is_active', true);
  let surchargeRows: PortalReportPricingContext['surcharges'] = currentSurchargeResult.data || [];
  let surchargeError = currentSurchargeResult.error;
  if (surchargeError?.code === '42703') {
    const legacyResult = await supabaseAdmin
      .from('invoice_surcharges')
      .select('surcharge_type,value')
      .eq('is_active', true);
    surchargeRows = legacyResult.data?.map((surcharge) => ({
      ...surcharge,
      effective_from: null,
    }));
    surchargeError = legacyResult.error;
  }
  if (surchargeError?.code === 'PGRST205') {
    surchargeRows = [];
    surchargeError = null;
  }
  if (surchargeError) throw surchargeError;

  return {
    serviceRequests: serviceRequests.map((request) => ({
      ...request,
      items: itemsByRequest.get(String(request.id)) || [],
    })),
    surcharges: surchargeRows || [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    const session = verifyPortalSessionToken(token);
    if (!session) return unauthorizedResponse();

    const customerReference = request.nextUrl.searchParams.get('ref')?.trim().toUpperCase() || '';
    if (!isValidReference(customerReference)) {
      return noStoreJson({ error: 'A valid customer reference is required' }, { status: 400 });
    }

    const parsedRange = parsePortalReportRange(
      request.nextUrl.searchParams.get('from'),
      request.nextUrl.searchParams.get('to'),
    );
    if ('error' in parsedRange) {
      return noStoreJson({ error: parsedRange.error }, { status: 400 });
    }

    const rateLimit = await enforcePortalRateLimits(supabaseAdmin, [
      {
        scope: 'reports_ip',
        subject: getRequestIp(request.headers),
        limit: 60,
        windowSeconds: 60,
      },
      {
        scope: 'reports_session',
        subject: session.email,
        limit: 30,
        windowSeconds: 60,
      },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { error: 'Too many report requests. Please wait and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const permittedAccounts = await loadPermittedPortalAccounts(supabaseAdmin, session.email);
    const permittedReferences = new Set(
      permittedAccounts
        .map((account) => account.unique_reference?.trim().toUpperCase())
        .filter((reference): reference is string => Boolean(reference)),
    );
    if (!permittedReferences.has(customerReference)) {
      return noStoreJson(
        { error: 'This account is not available to your portal login' },
        { status: 403 },
      );
    }

    const stops = await loadReportStops(
      customerReference,
      parsedRange.range.from,
      parsedRange.range.to,
    );
    const pricing = await loadReportPricing(stops);
    return noStoreJson({
      range: parsedRange.range,
      ...buildPortalReport(stops, pricing),
    });
  } catch (error) {
    if (error instanceof PortalRateLimitUnavailableError) {
      console.error(error.message);
      return noStoreJson(
        { error: 'Reporting is temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }
    console.error('Portal reporting error:', error);
    return noStoreJson({ error: 'Failed to load collection reporting' }, { status: 500 });
  }
}
