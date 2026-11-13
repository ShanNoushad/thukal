import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, inMemoryPersistence } from 'firebase/auth';

// Auth is kept in memory only (no localStorage / IndexedDB), so refreshing the page
// always sends the user back to the login screen.
export function getFirebaseAuth(firebaseConfig) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    // already initialised (e.g. hot reload in dev)
    return getAuth(app);
  }
}
