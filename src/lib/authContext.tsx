import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Permissions, Role, Session, permissionsFor } from "./domain";
import { loadSessionFromSupabase, loginWithUsername, logout as doLogout } from "./auth";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  session: Session | null;
  role: Role | null;
  perms: Permissions | null;
  ready: boolean;
  login: (user: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1) seed initial state from supabase storage
    void loadSessionFromSupabase().then((s) => {
      setSession(s);
      setReady(true);
    });

    // 2) subscribe to auth changes
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // defer to avoid deadlock
        setTimeout(() => {
          void loadSessionFromSupabase().then(setSession);
        }, 0);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const s = await loginWithUsername(user, password);
    if (s) setSession(s);
    return !!s;
  }, []);

  const logout = useCallback(async () => {
    await doLogout();
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      role: session?.role ?? null,
      perms: session ? permissionsFor(session.role) : null,
      ready,
      login,
      logout,
    }),
    [session, ready, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
