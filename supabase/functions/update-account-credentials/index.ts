// Lets the Gerência update username/password of one of the three fixed accounts.
// Validates the caller's JWT and role server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "missing token" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate caller.
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) return json({ ok: false, error: "invalid session" }, 401);
    const callerId = userRes.user.id;

    // Check role.
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "gerencia")
      .maybeSingle();
    if (!roleRow) return json({ ok: false, error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const accountId: string | undefined = body.accountId;
    const newUsername: string | undefined = body.newUsername?.trim();
    const newPassword: string | undefined = body.newPassword;

    if (!accountId) return json({ ok: false, error: "accountId required" }, 400);
    if (!newUsername && !newPassword) return json({ ok: false, error: "nothing to update" }, 400);
    if (newUsername && (newUsername.length < 3 || /\s/.test(newUsername)))
      return json({ ok: false, error: "username inválido" }, 400);
    if (newPassword && newPassword.length < 8)
      return json({ ok: false, error: "senha precisa ter ao menos 8 caracteres" }, 400);

    // Load target account.
    const { data: acc, error: accErr } = await admin
      .from("app_accounts")
      .select("id, auth_user_id, username")
      .eq("id", accountId)
      .maybeSingle();
    if (accErr || !acc) return json({ ok: false, error: "conta não encontrada" }, 404);

    if (newPassword) {
      const { error } = await admin.auth.admin.updateUserById(acc.auth_user_id, {
        password: newPassword,
      });
      if (error) throw error;
    }

    if (newUsername && newUsername !== acc.username) {
      const { error } = await admin
        .from("app_accounts")
        .update({ username: newUsername })
        .eq("id", acc.id);
      if (error) throw error;
    }

    return json({ ok: true });
  } catch (err) {
    console.error("update-account-credentials error", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
