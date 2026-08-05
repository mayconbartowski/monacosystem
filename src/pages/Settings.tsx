import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { KeyRound, Save, ShieldAlert } from "lucide-react";
import { AppAccount, ROLE_LABEL } from "@/lib/domain";
import { listAccounts, updateAccountUsername, updateOwnPassword } from "@/lib/auth";
import { useAuth } from "@/lib/authContext";
import { toast } from "sonner";

export default function Settings() {
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const { session } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const load = () => { listAccounts().then(setAccounts).catch(() => setAccounts([])); };
  useEffect(() => { load(); }, []);

  const changePassword = async () => {
    setSavingPwd(true);
    try {
      await updateOwnPassword(newPassword);
      toast.success("Senha atualizada");
      setNewPassword("");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao alterar senha");
    } finally { setSavingPwd(false); }
  };

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-xs text-muted-foreground">Editar credenciais das contas operacionais</p>
      </header>
      <div className="p-4 md:p-6 bg-surface-sunken flex-1 overflow-auto space-y-2">
        <Card className="surface-card p-4 flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-primary mt-0.5" />
          <div className="text-xs text-muted-foreground">
            O Monaco System opera com <span className="text-foreground font-medium">exatamente três contas</span>:
            Atendimento, Lava-jato e Gerente. Você pode alterar o login de qualquer conta.
            A <span className="text-foreground font-medium">senha</span> só pode ser alterada pelo usuário que está logado (sua própria senha).
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-2">
          {accounts.map((a) => (
            <AccountEditor key={a.id} account={a} onSaved={load} />
          ))}
        </div>

        <Card className="surface-card p-5 max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="h-4 w-4 text-primary" />
            <div className="font-semibold">Minha senha ({session?.login})</div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" />
            <Button onClick={changePassword} disabled={savingPwd || newPassword.length < 6}
              className="w-full gap-2 mt-2">
              <Save className="h-4 w-4" /> Atualizar senha
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function AccountEditor({ account, onSaved }: { account: AppAccount; onSaved: () => void }) {
  const [login, setLogin] = useState(account.username);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLogin(account.username); }, [account.username]);

  const save = async () => {
    setBusy(true);
    try {
      await updateAccountUsername(account.id, login);
      toast.success(`Login de ${ROLE_LABEL[account.role]} atualizado`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    } finally { setBusy(false); }
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
      <Button onClick={save} disabled={busy || login === account.username || login.trim().length < 3}
        className="w-full gap-2">
        <Save className="h-4 w-4" /> Salvar login
      </Button>
    </Card>
  );
}
