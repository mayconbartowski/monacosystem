import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface AccountRow {
  id: string;
  username: string;
  role: "atendimento" | "lavajato" | "gerencia";
  auth_user_id: string;
}

const roleLabel: Record<AccountRow["role"], string> = {
  atendimento: "Atendimento",
  lavajato: "Lava-jato",
  gerencia: "Gerência",
};

const roleDescription: Record<AccountRow["role"], string> = {
  atendimento: "PDV, clientes, histórico (somente leitura para edições)",
  lavajato: "Apenas fila de lavagem · iniciar e finalizar serviços",
  gerencia: "Acesso total · edita serviços, preços, fidelidade e contas",
};

export default function Contas() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_accounts")
      .select("id, username, role, auth_user_id")
      .order("role");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as AccountRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Contas do sistema
        </h1>
        <p className="text-xs text-muted-foreground">
          Sistema interno com 3 contas fixas · não é possível criar ou excluir contas.
        </p>
      </header>
      <div className="p-6 bg-surface-sunken flex-1 overflow-auto">
        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 max-w-5xl">
            {rows.map((r) => (
              <AccountCard key={r.id} row={r} onSaved={load} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AccountCard({ row, onSaved }: { row: AccountRow; onSaved: () => void }) {
  const [username, setUsername] = useState(row.username);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const dirty = username.trim() !== row.username || password.length > 0;

  const save = async () => {
    if (!dirty) return;
    if (username.trim().length < 3 || /\s/.test(username.trim())) {
      toast.error("Usuário precisa ter ao menos 3 caracteres e sem espaços.");
      return;
    }
    if (password && password.length < 8) {
      toast.error("Senha precisa ter ao menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-account-credentials", {
        body: {
          accountId: row.id,
          newUsername: username.trim() !== row.username ? username.trim() : undefined,
          newPassword: password || undefined,
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Falha ao atualizar");
      toast.success("Credenciais atualizadas");
      setPassword("");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="surface-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-primary">{roleLabel[row.role]}</div>
          <div className="font-semibold mt-0.5">{row.username}</div>
        </div>
        <Badge variant="outline" className="border-border text-[10px]">Conta fixa</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{roleDescription[row.role]}</p>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Usuário</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nova senha</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Deixe em branco para manter"
          />
        </div>
        <Button
          onClick={save}
          disabled={!dirty || busy}
          className="w-full gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>
    </Card>
  );
}
