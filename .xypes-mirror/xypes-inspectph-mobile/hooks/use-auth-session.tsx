import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

import {
  ApiRequestError,
  login,
  refreshTokens,
  registerPushToken,
  type AuthSession,
} from "@/lib/api";
import { requestPushToken } from "@/lib/notifications/push-token";

const AUTH_SESSION_STORAGE_KEY = "inspect-ph-mobile-session";

interface AuthSessionContextValue {
  isHydrated: boolean;
  isSigningIn: boolean;
  session: AuthSession | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Attempt to refresh the access token using the stored refresh token.
   * Returns the new session on success, or null if refresh fails (caller should sign out). */
  tryRefreshSession: () => Promise<AuthSession | null>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

const ROLE_FALLBACK_PROFILES: Record<
  string,
  {
    accessScope: "global" | "lgu" | "office" | "assigned" | "own";
    label: string;
    permissions: string[];
  }
> = {
  admin: { accessScope: "global", label: "Administrator", permissions: [] },
  inspector: { accessScope: "assigned", label: "Inspector", permissions: [] },
  lgu_admin: {
    accessScope: "lgu",
    label: "LGU Administrator",
    permissions: [],
  },
  office_supervisor: {
    accessScope: "office",
    label: "Office Supervisor",
    permissions: [],
  },
  office_clerk: {
    accessScope: "office",
    label: "Office Clerk",
    permissions: [],
  },
  business_owner: {
    accessScope: "own",
    label: "Business Owner",
    permissions: [],
  },
  citizen: {
    accessScope: "own",
    label: "Citizen",
    permissions: [],
  },
};

function normalizeAuthSession(session: AuthSession): AuthSession {
  const role = session.user.role;
  const fallbackRoleProfile = ROLE_FALLBACK_PROFILES[role] ?? {
    accessScope: "assigned" as const,
    label: role,
    permissions: [],
  };

  return {
    ...session,
    user: {
      ...session.user,
      officeIds: Array.isArray(session.user.officeIds)
        ? session.user.officeIds
        : [],
      roleProfile: session.user.roleProfile ?? fallbackRoleProfile,
    },
  };
}

async function readStoredSession() {
  const rawValue = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return normalizeAuthSession(JSON.parse(rawValue) as AuthSession);
  } catch {
    await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateSession() {
      const storedSession = await readStoredSession();

      if (storedSession) {
        await SecureStore.setItemAsync(
          AUTH_SESSION_STORAGE_KEY,
          JSON.stringify(storedSession),
        );
      }

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
          const nextSession = normalizeAuthSession(await login(input));
          await SecureStore.setItemAsync(
            AUTH_SESSION_STORAGE_KEY,
            JSON.stringify(nextSession),
          );
          setSession(nextSession);

          // Register Expo push token in the background — non-blocking
          void requestPushToken().then(async (token) => {
            if (token) {
              await registerPushToken({
                accessToken: nextSession.tokens.accessToken,
                token,
              });
            }
          });
        } finally {
          setIsSigningIn(false);
        }
      },
      signOut: async () => {
        await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
        setSession(null);
      },
      tryRefreshSession: async () => {
        if (!session?.tokens.refreshToken) {
          return null;
        }
        try {
          const tokens = await refreshTokens({
            refreshToken: session.tokens.refreshToken,
          });
          const nextSession = normalizeAuthSession({ ...session, tokens });
          await SecureStore.setItemAsync(
            AUTH_SESSION_STORAGE_KEY,
            JSON.stringify(nextSession),
          );
          setSession(nextSession);
          return nextSession;
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 401) {
            await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
            setSession(null);
          }
          return null;
        }
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
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }

  return value;
}
