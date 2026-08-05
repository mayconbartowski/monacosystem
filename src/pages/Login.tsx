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
      <div className="absolute inset-0 pointer-events-none opacity-70 [background:radial-gradient(70%_45%_at_50%_-5%,hsl(67_100%_55%/0.10),transparent_70%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-primary/30" />

      <div className="relative z-10 m-auto w-full max-w-lg px-4 sm:px-6 py-12">
        <div className="mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary grid place-items-center text-primary-foreground font-extrabold text-lg">
            M
          </div>
          <div className="mt-6 label-xs">Monaco · acesso interno</div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
            Concierge<span className="text-primary">.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-sm">
            Operação, fila e faturamento em um único painel. Acesso restrito a contas operacionais.
          </p>
        </div>

        <form onSubmit={submit} className="surface-card p-5 sm:p-7 space-y-5">
          <div className="space-y-2">
            <Label className="label-xs">Usuário</Label>
            <Input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Seu login"
              autoFocus
              autoComplete="username"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label className="label-xs">Senha</Label>
            <Input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || !user || !pass}
            className="w-full h-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Entrar
          </Button>

          <div className="pt-1 text-xs text-muted-foreground/80 flex items-center gap-2 justify-center">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sistema interno · sem cadastro público
          </div>
        </form>
      </div>
    </div>
  );
}
