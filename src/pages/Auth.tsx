import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { primaryRoute, useAuth } from "@/contexts/AuthContext";

export default function Auth() {
  const { session, roles, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // loading=true → AuthContext ainda não resolveu sessão+roles → mostra spinner
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // loading=false + session existe + roles carregados → redireciona para a rota certa
  if (session) {
    return <Navigate to={primaryRoute(roles)} replace />;
  }

  // Sem sessão → mostra formulário de login
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      const { data: email, error: rpcErr } = await supabase.rpc("resolve_login", {
        _username: username.trim(),
      });
      if (rpcErr) throw rpcErr;
      if (!email) throw new Error("Usuário ou senha inválidos");

      const { error } = await supabase.auth.signInWithPassword({
        email: email as string,
        password,
      });
      if (error) throw new Error("Usuário ou senha inválidos");
      // Sem navigate() manual — o onAuthStateChange no AuthContext atualiza
      // session+roles e o <Navigate> acima cuida do redirect automaticamente
    } catch (err: any) {
      toast.error(err.message || "Falha no login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-surface-sunken p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-gold grid place-items-center text-primary-foreground font-bold text-xl shadow-glow">
            M
          </div>
          <h1 className="mt-4 text-2xl font-semibold">
            Monaco <span className="gold-text">System</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Acesso interno · uso operacional</p>
        </div>

        <Card className="surface-card p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs text-muted-foreground">Usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold"
              size="lg"
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
