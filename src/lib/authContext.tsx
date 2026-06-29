import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Permissions, Role, Session, permissionsFor } from "./domain";
import { currentSession, ensureSeed, login as doLogin, logout as doLogout } from "./auth";

interface AuthState {
  session: Session | null;
  role: Role | null;
  perms: Permissions | null;
  ready: boolean;
  login: (user: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureSeed().then(() => {
      setSession(currentSession());
      setReady(true);
    });
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const s = await doLogin(user, password);
    if (s) setSession(s);
    return !!s;
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    role: session?.role ?? null,
    perms: session ? permissionsFor(session.role) : null,
    ready,
    login,
    logout,
  }), [session, ready, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
