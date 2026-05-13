import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { login, type AuthSession } from '@/lib/api';

const AUTH_SESSION_STORAGE_KEY = 'inspect-ph-mobile-session';

interface AuthSessionContextValue {
  isHydrated: boolean;
  isSigningIn: boolean;
  session: AuthSession | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

async function readStoredSession() {
  const rawValue = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateSession() {
      const storedSession = await readStoredSession();

      if (isCancelled) {
        return;
      }

      setSession(storedSession);
      setIsHydrated(true);
    }

    void hydrateSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      isHydrated,
      isSigningIn,
      session,
      signIn: async (input) => {
        setIsSigningIn(true);

        try {
          const nextSession = await login(input);
          await SecureStore.setItemAsync(
            AUTH_SESSION_STORAGE_KEY,
            JSON.stringify(nextSession),
          );
          setSession(nextSession);
        } finally {
          setIsSigningIn(false);
        }
      },
      signOut: async () => {
        await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
        setSession(null);
      },
    }),
    [isHydrated, isSigningIn, session],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);

  if (!value) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return value;
}