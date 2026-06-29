// Idempotent seeder for the three fixed Monaco System accounts.
// Safe to call multiple times — only creates what is missing, never overwrites.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeedAccount {
  username: string;
  email: string;
  password: string;
  role: "atendimento" | "lavajato" | "gerencia";
}

const ACCOUNTS: SeedAccount[] = [
  { username: "Atendimento", email: "atendimento@monaco.local", password: "#Elefante98",    role: "atendimento" },
  { username: "Lavacarro",   email: "lavacarro@monaco.local",   password: "#SkylineGTR34",  role: "lavajato"    },
  { username: "Degenulys",   email: "degenulys@monaco.local",   password: "#Vacasgordas22", role: "gerencia"    },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const created: string[] = [];
    const existing: string[] = [];

    for (const acc of ACCOUNTS) {
      // 1) Ensure auth user exists.
      const { data: existRow } = await admin
        .from("app_accounts")
        .select("auth_user_id")
        .eq("role", acc.role)
        .maybeSingle();

      let userId = existRow?.auth_user_id as string | undefined;

      if (!userId) {
        // Try to create. If e-mail already exists in auth.users, look it up.
        const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
          email: acc.email,
          password: acc.password,
          email_confirm: true,
          user_metadata: { username: acc.username },
        });

        if (createErr) {
          // e-mail may already exist from a previous attempt — look it up.
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = list?.users.find((u) => u.email?.toLowerCase() === acc.email.toLowerCase());
          if (!found) throw createErr;
          userId = found.id;
        } else {
          userId = createRes.user!.id;
        }
        created.push(acc.username);
      } else {
        existing.push(acc.username);
      }

      // 2) Ensure profile row.
      await admin.from("profiles").upsert({ id: userId!, full_name: acc.username });

      // 3) Ensure user_roles row.
      await admin.from("user_roles").upsert(
        { user_id: userId!, role: acc.role },
        { onConflict: "user_id,role" },
      );

      // 4) Ensure app_accounts row.
      await admin.from("app_accounts").upsert(
        { username: acc.username, role: acc.role, auth_user_id: userId! },
        { onConflict: "role" },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, created, existing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("seed-accounts error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
