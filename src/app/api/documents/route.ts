import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET_NAME = 'customer-documents';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

// Rate limiting for document requests
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute

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

// Validate customer reference format (prevent path traversal)
function isValidReference(ref: string): boolean {
  if (!ref || ref.length > 50) return false;
  // Block path traversal attempts
  if (ref.includes('..') || ref.includes('/') || ref.includes('\\')) return false;
  // Allow alphanumeric, hyphens, underscores, spaces
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

// Parse document filename to extract type and date
function parseDocumentName(filename: string): { type: Document['type']; date: string | null; displayName: string } {
  const lowerName = filename.toLowerCase();

  let type: Document['type'] = 'other';
  let date: string | null = null;
  let displayName = filename.replace(/\.[^/.]+$/, ''); // Remove extension

  // Detect document type
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

  // Try to extract date from filename
  // Format 1: YYYY-MM-DD (e.g., 2025-12-17)
  let dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    date = `${year}-${month}-${day}`;
  }

  // Format 2: DD-MM-YYYY (e.g., 17-12-2025)
  if (!date) {
    dateMatch = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      date = `${year}-${month}-${day}`; // Convert to YYYY-MM-DD for consistent sorting
    }
  }

  // Format date for display
  if (date) {
    try {
      const dateObj = new Date(date);
      // Check if valid date
      if (!isNaN(dateObj.getTime())) {
        const formattedDate = dateObj.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        displayName = `${displayName} - ${formattedDate}`;
      }
    } catch {
      displayName = `${displayName} - ${date}`;
    }
  }

  return { type, date, displayName };
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerRef = searchParams.get('ref');

    if (!customerRef) {
      return NextResponse.json(
        { error: 'Customer reference is required' },
        { status: 400 }
      );
    }

    // Validate reference format to prevent path traversal and injection
    if (!isValidReference(customerRef)) {
      return NextResponse.json(
        { error: 'Invalid customer reference format' },
        { status: 400 }
      );
    }

    // List files in customer's folder
    const folderPath = customerRef.toUpperCase();
    const { data: files, error: listError } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .list(folderPath, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      console.error('Error listing files:', listError);
      return NextResponse.json(
        { error: 'Failed to list documents' },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ documents: [] });
    }

    // Filter out folders and generate signed URLs for each file
    const documents: Document[] = [];

    for (const file of files) {
      // Skip folders (they have no metadata/size)
      if (!file.name || file.name.startsWith('.')) continue;

      const filePath = `${folderPath}/${file.name}`;

      // Generate signed URL
      const { data: signedUrlData, error: signError } = await supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

      if (signError || !signedUrlData) {
        console.error(`Error creating signed URL for ${filePath}:`, signError);
        continue;
      }

      const { type, date, displayName } = parseDocumentName(file.name);

      documents.push({
        id: file.id || file.name,
        name: file.name,
        displayName,
        type,
        date,
        size: file.metadata?.size || 0,
        url: signedUrlData.signedUrl,
      });
    }

    // Sort by date (newest first)
    documents.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
