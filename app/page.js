'use client';

import { useCallback, useEffect, useState } from 'react';
import LoginScreen from '@/components/LoginScreen';
import Dashboard from '@/components/Dashboard';

// The login session lives ONLY in React state (never localStorage), so a page
// refresh always sends the user back to the login screen.
export default function Home() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfigError('Cannot reach the server'));
  }, []);

  const logout = useCallback(
    async (message = '') => {
      if (session) await session.signOut().catch(() => {});
      setSession(null);
      setNotice(message);
    },
    [session]
  );

  if (!config) return <p className="center muted">{configError || 'Loading...'}</p>;

  if (!session) {
    return (
      <LoginScreen
        config={config}
        notice={notice}
        onLoggedIn={(s) => {
          setNotice('');
          setSession(s);
        }}
      />
    );
  }

  return <Dashboard session={session} onLogout={logout} />;
}
