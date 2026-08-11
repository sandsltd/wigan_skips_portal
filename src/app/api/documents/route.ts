import { NextRequest, NextResponse } from 'next/server';

import { loadPermittedPortalAccounts } from '@/lib/portalAccounts';
import { isPortalDocumentVisible } from '@/lib/portalDocuments';
import {
  PortalRateLimitUnavailableError,
  enforcePortalRateLimits,
  getRequestIp,
} from '@/lib/portalRateLimit';
import { PORTAL_SESSION_COOKIE, verifyPortalSessionToken } from '@/lib/portalSession';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET_NAME = 'customer-documents';
const SIGNED_URL_EXPIRY = 5 * 60;

function noStoreJson(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
}

function unauthorizedResponse() {
  const response = noStoreJson({ error: 'Please sign in to view documents' }, { status: 401 });
  response.cookies.set(PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}

function isValidReference(ref: string): boolean {
  if (!ref || ref.length > 50) return false;
  if (ref.includes('..') || ref.includes('/') || ref.includes('\\')) return false;
  return /^[A-Za-z0-9\-_ ]+$/.test(ref);
}

interface Document {
  id: string;
  name: string;
  displayName: string;
  type: 'waste_transfer_note' | 'certificate' | 'invoice' | 'other';
  date: string | null;
  size: number;
  url: string;
}

interface DocumentMetadata {
  storage_path: string;
  portal_visible: unknown;
  document_type: string | null;
  display_name: string | null;
}

function parseDocumentName(filename: string): Pick<Document, 'type' | 'date' | 'displayName'> {
  const lowerName = filename.toLowerCase();
  let type: Document['type'] = 'other';
  let date: string | null = null;
  let displayName = filename.replace(/\.[^/.]+$/, '');

  if (lowerName.includes('waste_transfer_note') || lowerName.includes('wtn')) {
    type = 'waste_transfer_note';
    displayName = 'Waste Transfer Note';
  } else if (lowerName.includes('certificate') || lowerName.includes('cert')) {
    type = 'certificate';
    displayName = lowerName.includes('destruction') ? 'Certificate of Destruction' : 'Certificate';
  } else if (lowerName.includes('invoice') || lowerName.includes('inv')) {
    type = 'invoice';
    displayName = 'Invoice';
  }

  let dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    date = `${year}-${month}-${day}`;
  }

  if (!date) {
    dateMatch = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      date = `${year}-${month}-${day}`;
    }
  }

  if (date) {
    const dateObject = new Date(date);
    if (!Number.isNaN(dateObject.getTime())) {
      displayName = `${displayName} - ${dateObject.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    }
  }

  return { type, date, displayName };
}

function asDocumentMetadata(value: unknown): DocumentMetadata[] {
  return Array.isArray(value) ? value as DocumentMetadata[] : [];
}

function metadataDocumentType(value: string | null | undefined): Document['type'] | null {
  if (value === 'wtn' || value === 'waste_transfer_note') return 'waste_transfer_note';
  if (value === 'certificate') return 'certificate';
  if (value === 'invoice') return 'invoice';
  if (value && ['agreement', 'verification', 'weighbridge', 'other'].includes(value)) return 'other';
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    const session = verifyPortalSessionToken(token);
    if (!session) return unauthorizedResponse();

    const customerRef = request.nextUrl.searchParams.get('ref')?.trim() || '';
    if (!isValidReference(customerRef)) {
      return noStoreJson({ error: 'A valid customer reference is required' }, { status: 400 });
    }

    const rateLimit = await enforcePortalRateLimits(supabaseAdmin, [
      {
        scope: 'documents_ip',
        subject: getRequestIp(request.headers),
        limit: 60,
        windowSeconds: 60,
      },
      {
        scope: 'documents_session',
        subject: session.email,
        limit: 30,
        windowSeconds: 60,
      },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { error: 'Too many document requests. Please wait and try again.' },
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
    const folderPath = customerRef.toUpperCase();
    if (!permittedReferences.has(folderPath)) {
      return noStoreJson({ error: 'This account is not available to your portal login' }, { status: 403 });
    }

    const documentsBucket = supabaseAdmin.storage.from(BUCKET_NAME);
    const { data: files, error: listError } = await documentsBucket.list(folderPath, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (listError) {
      console.error('Error listing portal documents:', listError);
      return noStoreJson({ error: 'Failed to list documents' }, { status: 500 });
    }

    const storedFiles = (files || []).filter((file) => file.name && !file.name.startsWith('.'));
    if (storedFiles.length === 0) return noStoreJson({ documents: [] });

    const storagePaths = storedFiles.map((file) => `${folderPath}/${file.name}`);
    const { data: metadataRows, error: metadataError } = await supabaseAdmin
      .from('customer_document_metadata')
      .select('storage_path, portal_visible, document_type, display_name')
      .in('storage_path', storagePaths);
    if (metadataError) {
      console.error('Could not enforce portal document visibility:', metadataError);
      return noStoreJson(
        { error: 'Document visibility could not be verified' },
        { status: 503 },
      );
    }

    const metadataByPath = new Map(
      asDocumentMetadata(metadataRows).map((metadata) => [metadata.storage_path, metadata]),
    );
    const documents: Document[] = [];

    for (const file of storedFiles) {
      const filePath = `${folderPath}/${file.name}`;
      const metadata = metadataByPath.get(filePath);
      const visibility = metadata?.portal_visible ?? file.metadata?.portal_visible;
      if (!isPortalDocumentVisible(visibility)) continue;

      const { data: signedUrlData, error: signError } = await documentsBucket
        .createSignedUrl(filePath, SIGNED_URL_EXPIRY);
      if (signError || !signedUrlData) {
        console.error(`Error creating a portal document URL for ${filePath}:`, signError);
        continue;
      }

      const parsed = parseDocumentName(file.name);
      documents.push({
        id: file.id || file.name,
        name: file.name,
        displayName: metadata?.display_name || parsed.displayName,
        type: metadataDocumentType(metadata?.document_type) || parsed.type,
        date: parsed.date,
        size: file.metadata?.size || 0,
        url: signedUrlData.signedUrl,
      });
    }

    documents.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    return noStoreJson({ documents });
  } catch (error) {
    if (error instanceof PortalRateLimitUnavailableError) {
      console.error(error.message);
      return noStoreJson(
        { error: 'Document access is temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }
    console.error('Portal document error:', error);
    return noStoreJson({ error: 'Server error' }, { status: 500 });
  }
}
