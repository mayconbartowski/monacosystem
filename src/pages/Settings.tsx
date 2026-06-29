import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { KeyRound, Save, ShieldAlert } from "lucide-react";
import { Account, ROLE_LABEL, Role } from "@/lib/domain";
import { listAccounts, updateCredentials } from "@/lib/auth";
import { toast } from "sonner";

export default function Settings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => { setAccounts(listAccounts()); }, []);

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-xs text-muted-foreground">Editar credenciais das 3 contas fixas</p>
      </header>
      <div className="p-6 bg-surface-sunken flex-1 overflow-auto space-y-4">
        <Card className="surface-card p-4 flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-primary mt-0.5" />
          <div className="text-xs text-muted-foreground">
            O Monaco System opera com <span className="text-foreground font-medium">exatamente três contas</span>:
            Atendimento, Lava-jato e Gerente. Você pode alterar o login e a senha, mas não criar ou remover contas.
          </div>
        </Card>
        <div className="grid md:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <AccountEditor key={a.role} account={a} onSaved={() => setAccounts(listAccounts())} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function AccountEditor({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [login, setLogin] = useState(account.login);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateCredentials(account.role as Role, {
        login: login !== account.login ? login : undefined,
        password: password || undefined,
      });
      toast.success(`Credenciais de ${ROLE_LABEL[account.role]} atualizadas`);
      setPassword("");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar credenciais");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="surface-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <div className="font-semibold">{ROLE_LABEL[account.role]}</div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Login</Label>
        <Input value={login} onChange={(e) => setLogin(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nova senha (opcional)</Label>
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <Button
        onClick={save}
        disabled={busy || (login === account.login && !password)}
        className="w-full gap-2"
      >
        <Save className="h-4 w-4" />
        Salvar alterações
      </Button>
    </Card>
  );
}
