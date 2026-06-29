import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { toast } from "sonner";

export default function Login() {
  const { session, login, ready, role } = useAuth();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Monaco System · Entrar"; }, []);

  if (ready && session) {
    if (role === "lavajato") return <Navigate to="/fila" replace />;
    if (role === "atendimento") return <Navigate to="/" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  void ShieldCheck;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !pass) return;
    setBusy(true);
    const ok = await login(user, pass);
    setBusy(false);
    if (!ok) {
      toast.error("Usuário ou senha inválidos");
      setPass("");
    } else {
      toast.success("Bem-vindo ao Monaco System");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,hsl(38_100%_55%/0.12),transparent_70%)]" />
      <div className="relative z-10 m-auto w-full max-w-md px-6 py-12">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-gold grid place-items-center text-primary-foreground font-bold shadow-glow text-xl">
            M
          </div>
          <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Monaco</div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="gold-text">System</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-2">Acesso restrito a contas operacionais</p>
        </div>

        <form onSubmit={submit} className="surface-card p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Usuário</Label>
            <Input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Seu login"
              autoFocus
              autoComplete="username"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Senha</Label>
            <Input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || !user || !pass}
            className="w-full h-11 gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Entrar
          </Button>

          <div className="pt-2 text-[11px] text-muted-foreground/80 flex items-center gap-2 justify-center">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sistema interno · sem cadastro público
          </div>
        </form>
      </div>
    </div>
  );
}
