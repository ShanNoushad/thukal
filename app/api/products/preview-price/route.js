import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { calculatePricing } from '@/lib/pricing';
import { HttpError, handle } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Live price preview for the form (does not save anything)
export const POST = handle(async (request) => {
  await authenticate(request);
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(calculatePricing(body));
  } catch (err) {
    throw new HttpError(400, err.message);
  }
});
