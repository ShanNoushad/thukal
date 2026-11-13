// import { NextResponse } from 'next/server';
// import { bypassEnabled } from '@/lib/auth';

// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic'; // read .env at request time

// // Public config for the browser (Firebase web config comes from .env)
// export async function GET() {
//   return NextResponse.json({
//     bypassEnabled: bypassEnabled(),
//     firebase: {
//       apiKey: process.env.FIREBASE_WEB_API_KEY || '',
//       authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || '',
//       projectId: process.env.FIREBASE_WEB_PROJECT_ID || '',
//       appId: process.env.FIREBASE_WEB_APP_ID || '',
//     },
//   });
// }
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    bypassEnabled: String(process.env.BYPASS_ENABLED).toLowerCase() === 'true',
    firebase: {
      apiKey: process.env.FIREBASE_WEB_API_KEY || '',
      authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_WEB_PROJECT_ID || '',
      appId: process.env.FIREBASE_WEB_APP_ID || '',
    },
  });
}