import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function init() {
  if (getApps().length) return;

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (saJson) {
    initializeApp({ credential: cert(JSON.parse(saJson)) });
  } else if (saPath) {
    // the key file path comes from .env, so keep the bundler from tracing it
    const full = path.resolve(/*turbopackIgnore: true*/ process.cwd(), saPath);
    if (!fs.existsSync(/*turbopackIgnore: true*/ full)) {
      throw new Error(`Firebase service account file not found at ${full}`);
    }
    initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ full, 'utf8'))),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault() });
  } else {
    throw new Error(
      'Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH in your .env file (see README).'
    );
  }
}

// Lazy so the app can still start (and show a clear error) before .env is filled in
export function getDb() {
  init();
  return getFirestore();
}

export function getAdminAuth() {
  init();
  return getAuth();
}
