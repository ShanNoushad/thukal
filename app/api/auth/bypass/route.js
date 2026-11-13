import { NextResponse } from 'next/server';
import { bypassEnabled, issueBypassToken } from '@/lib/auth';
import { HttpError, handle } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Temporary bypass login (only works while BYPASS_ENABLED=true)
export const POST = handle(async () => {
  if (!bypassEnabled()) throw new HttpError(403, 'Bypass login is disabled');
  return NextResponse.json({ token: issueBypassToken() });
});
