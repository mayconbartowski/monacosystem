import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { primaryRoute, useAuth } from "@/contexts/AuthContext";

export default function Auth() {
  const { session, roles, loading } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (session && !loading) nav(primaryRoute(roles), { replace: true });
  }, [session, roles, loading, nav]);

  if (session) return <Navigate to={primaryRoute(roles)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Informe seu nome completo.");
        if (password.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres.");
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        toast.success("Conta criada — entrando...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-surface-sunken p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-gold grid place-items-center text-primary-foreground font-bold text-xl shadow-glow">
            M
          </div>
          <h1 className="mt-4 text-2xl font-semibold">
            Monaco <span className="gold-text">System</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Premium Auto Care · Acesso restrito</p>
        </div>

        <Card className="surface-card p-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 mb-4 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <form onSubmit={submit} className="space-y-4">
              <TabsContent value="signup" className="m-0 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome completo</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como aparecerá no sistema" />
                </div>
              </TabsContent>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : 1}
                />
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold"
                size="lg"
              >
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "signup" ? "Criar conta" : "Entrar"}
              </Button>
            </form>
          </Tabs>
          <p className="mt-4 text-[11px] text-muted-foreground text-center">
            O primeiro usuário cadastrado será automaticamente <span className="text-primary">Gerência</span>.
            <br />
            Os demais entram como Atendimento e podem ser promovidos depois.
          </p>
        </Card>
      </div>
    </div>
  );
}
