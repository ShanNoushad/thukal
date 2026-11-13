import crypto from 'crypto';
import { getAdminAuth } from './firebaseAdmin';
import { HttpError } from './http';

// ---- Bypass tokens ----
// Signed + expiring tokens (no server memory needed, so they also work on hosts that
// run several server copies). The browser keeps the token only in React state, so
// refreshing the page always forces a new login.
const BYPASS_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export function bypassEnabled() {
  return String(process.env.BYPASS_ENABLED).toLowerCase() === 'true';
}

function secret() {
  if (process.env.BYPASS_SECRET) return process.env.BYPASS_SECRET;
  // No secret set: make a random one that lasts until the server restarts
  globalThis.__pmBypassSecret ||= crypto.randomBytes(32).toString('hex');
  return globalThis.__pmBypassSecret;
}

function sign(text) {
  return crypto.createHmac('sha256', secret()).update(text).digest('hex');
}

export function issueBypassToken() {
  const expires = String(Date.now() + BYPASS_TTL_MS);
  return `bypass_${expires}.${sign(expires)}`;
}

function isValidBypassToken(token) {
  const [expires, signature] = token.slice('bypass_'.length).split('.');
  if (!expires || !signature) return false;

  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;

  return Date.now() < Number(expires);
}

// ---- Check the logged-in user for an API request ----
export async function authenticate(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Login required');

  if (token.startsWith('bypass_')) {
    if (bypassEnabled() && isValidBypassToken(token)) {
      return { uid: 'bypass', email: 'bypass@local', bypass: true };
    }
    throw new HttpError(401, 'Bypass session invalid or expired');
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    // A missing Firebase setup is a server problem, not a bad login
    if (/not configured|not found at/i.test(err.message)) throw err;
    console.warn('Token verification failed:', err.message);
    throw new HttpError(401, 'Invalid or expired login');
  }
}
