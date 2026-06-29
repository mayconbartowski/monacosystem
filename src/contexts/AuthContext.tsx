import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "atendimento" | "lavajato" | "gerencia";

interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  fullName: string;
  loading: boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [fullName, setFullName] = useState("");
  // loading=true até termos sessão E roles carregados
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (uid: string) => {
    const [{ data: profile }, { data: rolesRows }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setFullName(profile?.full_name || "");
    setRoles((rolesRows ?? []).map((r) => r.role as AppRole));
  };

  useEffect(() => {
    let mounted = true;

    // 1. Carrega sessão inicial e roles antes de sair do loading
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const s = data.session;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadProfileAndRoles(s.user.id);
      }
      setLoading(false);
    });

    // 2. Escuta mudanças futuras (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer para evitar deadlock dentro do listener do Supabase
        setTimeout(() => {
          if (mounted) loadProfileAndRoles(s.user.id);
        }, 0);
      } else {
        setRoles([]);
        setFullName("");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshRoles = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, roles, fullName, loading, refreshRoles, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useHasRole(role: AppRole) {
  const { roles } = useAuth();
  return roles.includes(role);
}

export function useAnyRole(allowed: AppRole[]) {
  const { roles } = useAuth();
  return roles.some((r) => allowed.includes(r));
}

export function primaryRoute(roles: AppRole[]): string {
  if (roles.includes("gerencia")) return "/dashboard";
  if (roles.includes("lavajato")) return "/fila";
  if (roles.includes("atendimento")) return "/";
  return "/auth"; // sem role definido → volta pro login
}
