import { supabase } from "@/integrations/supabase/client";
import { AppAccount, Role, Session } from "@/lib/domain";

export async function loginWithUsername(username: string, password: string): Promise<Session | null> {
  const uname = username.trim();
  if (!uname || !password) return null;

  // Resolve login → email via RPC (security definer)
  const { data: emailData, error: emailErr } = await supabase.rpc("resolve_login", { _username: uname });
  if (emailErr || !emailData) return null;
  const email = String(emailData);

  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
    email, password,
  });
  if (signErr || !signIn.session) return null;

  const userId = signIn.user!.id;
  const { data: acc } = await supabase
    .from("app_accounts")
    .select("role, username")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!acc) {
    await supabase.auth.signOut();
    return null;
  }
  return {
    role: acc.role as Role,
    login: acc.username,
    userId,
    loggedAt: new Date().toISOString(),
  };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function loadSessionFromSupabase(): Promise<Session | null> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const userId = s.session.user.id;
  const { data: acc } = await supabase
    .from("app_accounts")
    .select("role, username")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!acc) return null;
  return {
    role: acc.role as Role, login: acc.username, userId,
    loggedAt: s.session.user.last_sign_in_at ?? new Date().toISOString(),
  };
}

export async function listAccounts(): Promise<AppAccount[]> {
  const { data, error } = await supabase
    .from("app_accounts").select("id, role, username, auth_user_id")
    .order("role");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id, role: a.role as Role, username: a.username, authUserId: a.auth_user_id,
  }));
}

export async function updateAccountUsername(accountId: string, username: string): Promise<void> {
  const u = username.trim();
  if (u.length < 3) throw new Error("Login muito curto");
  const { error } = await supabase.from("app_accounts")
    .update({ username: u }).eq("id", accountId);
  if (error) throw error;
}

/** Atualiza apenas a senha do USUÁRIO LOGADO. */
export async function updateOwnPassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) throw new Error("Senha muito curta");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
