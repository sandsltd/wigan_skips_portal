import { NextRequest, NextResponse } from 'next/server';
import { sendCollectionRequestEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer, items, additionalInfo } = body;

    if (!customer || !items) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify at least one item has a quantity > 0
    const hasItems = Object.values(items).some((qty) => typeof qty === 'number' && qty > 0);
    if (!hasItems) {
      return NextResponse.json(
        { error: 'Please add at least one item' },
        { status: 400 }
      );
    }

    await sendCollectionRequestEmail({
      customer,
      items,
      additionalInfo: additionalInfo || '',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Collection request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit collection request' },
      { status: 500 }
    );
  }
}
