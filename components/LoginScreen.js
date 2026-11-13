'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebaseClient';

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Wrong email or password',
  'auth/wrong-password': 'Wrong email or password',
  'auth/user-not-found': 'No account with that email',
  'auth/email-already-in-use': 'That email already has an account',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/invalid-email': 'Invalid email address',
  'auth/too-many-requests': 'Too many attempts, try again later',
  'auth/operation-not-allowed': 'Enable Email/Password sign-in in the Firebase console',
};

export default function LoginScreen({ config, notice, onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const firebaseReady = Boolean(config.firebase.apiKey);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!firebaseReady) {
      setError('Firebase web config is missing in .env (FIREBASE_WEB_*)');
      return;
    }
    setBusy(true);
    try {
      const auth = getFirebaseAuth(config.firebase);
      const cred = signup
        ? await createUserWithEmailAndPassword(auth, email.trim(), password)
        : await signInWithEmailAndPassword(auth, email.trim(), password);
      onLoggedIn({
        label: cred.user.email,
        getToken: () => auth.currentUser.getIdToken(),
        signOut: () => signOut(auth),
      });
    } catch (err) {
      setError(AUTH_ERRORS[err.code] || err.message);
      setBusy(false);
    }
  }

  async function bypass() {
    setError('');
    try {
      const res = await fetch('/api/auth/bypass', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bypass failed');
      onLoggedIn({
        label: 'Bypass session',
        getToken: async () => data.token,
        signOut: async () => {},
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h1>Product Manager</h1>
        <p className="muted">{signup ? 'Create a new account' : 'Sign in to continue'}</p>

        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
        </label>

        <div className="row">
          <button type="submit" className="btn primary grow" disabled={busy}>
            {signup ? 'Create account' : 'Login'}
          </button>
          {config.bypassEnabled && (
            <button type="button" className="btn ghost grow" onClick={bypass}>
              Bypass
            </button>
          )}
        </div>

        <button type="button" className="link" onClick={() => { setSignup(!signup); setError(''); }}>
          {signup ? 'Have an account? Login' : 'No account? Create one'}
        </button>

        <p className="error" role="alert">
          {error || notice || (!firebaseReady ? 'Firebase web config missing in .env (FIREBASE_WEB_*). Bypass still works.' : '')}
        </p>
      </form>
    </section>
  );
}
