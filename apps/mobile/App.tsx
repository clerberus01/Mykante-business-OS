import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/auth/LoginScreen';
import { QrLoginScreen } from './src/auth/QrLoginScreen';
import { ClientsScreen } from './src/clients/ClientsScreen';

const queryClient = new QueryClient();

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showQrLogin, setShowQrLogin] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loadingSession) {
    return null;
  }

  const refreshSession = () => supabase.auth.getSession().then(({ data }) => setSession(data.session));

  if (session) {
    return <ClientsScreen />;
  }

  if (showQrLogin) {
    return <QrLoginScreen onCancel={() => setShowQrLogin(false)} onSignedIn={() => void refreshSession()} />;
  }

  return <LoginScreen onQrLogin={() => setShowQrLogin(true)} onSignedIn={() => void refreshSession()} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  );
}
