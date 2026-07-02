import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ListOrdered, Clock, CheckCircle2, Play, Car, LogOut, Trophy, Sparkles, PackageCheck,
} from "lucide-react";
import { Order, OrderStatus } from "@/lib/domain";
import { formatDuration } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { useData } from "@/lib/DataContext";
import { finishOrder, startOrder, deliverOrder } from "@/services/data";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ServiceIcon } from "@/components/ServiceIcon";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export default function Queue() {
  const { logout, role } = useAuth();
  const navigate = useNavigate();
  const { orders } = useData();
  const [, force] = useState(0);
  const [tab, setTab] = useState<OrderStatus>("queued");

  useEffect(() => {
    let cancelled = false;
    let handle: number;
    const tick = () => {
      if (cancelled) return;
      force((n) => n + 1);
      handle = window.setTimeout(tick, 30_000);
    };
    handle = window.setTimeout(tick, 30_000);
    return () => { cancelled = true; window.clearTimeout(handle); };
  }, []);

  const buckets = useMemo(() => {
    const all = [...orders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return {
      queued: all.filter((o) => o.status === "queued"),
      in_progress: all.filter((o) => o.status === "in_progress"),
      completed: all.filter((o) => o.status === "completed"),
    };
  }, [orders]);

  const start = async (o: Order) => {
    try { await startOrder(o.id); toast.success(`Lavagem iniciada — ${o.vehiclePlate}`); setTab("in_progress"); }
    catch (e: any) { toast.error(e.message ?? "Erro ao iniciar"); }
  };
  const finish = async (o: Order) => {
    try { await finishOrder(o); toast.success(`Finalizado — ${o.vehiclePlate}`); setTab("completed"); }
    catch (e: any) { toast.error(e.message ?? "Erro ao finalizar"); }
  };
  const deliver = async (o: Order) => {
    try { await deliverOrder(o.id); toast.success(`Entregue — ${o.vehiclePlate}`); }
    catch (e: any) { toast.error(e.message ?? "Erro ao concluir"); }
  };

  const doLogout = async () => { await logout(); navigate("/login"); };

  const renderCard = (o: Order, i: number, phase: OrderStatus) => {
    const started = o.startedAt ? new Date(o.startedAt) : null;
    const elapsed = started ? Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000)) : 0;
    return (
      <div key={o.id} className={cn(
        "surface-card p-4 animate-fade-in",
        phase === "in_progress" && "border-primary/50 shadow-glow",
        phase === "completed" && "border-emerald-500/40",
      )}>
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0 text-lg font-bold">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-lg font-semibold leading-tight">{o.vehiclePlate}</div>
            <div className="text-sm text-foreground/90 truncate">{o.vehicleLabel}</div>
            <div className="text-xs text-muted-foreground truncate">{o.customerName} · {o.category}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Tempo</div>
            <div className="text-sm font-semibold flex items-center gap-1 justify-end">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(o.durationMinutes)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/15 text-primary border border-primary/30 gap-1">
            <ServiceIcon serviceKey={o.service} className="h-3 w-3" />
            {o.service}
          </Badge>
          {o.extras.map((e) => (
            <Badge key={e} variant="outline" className="border-border bg-muted/30">{e}</Badge>
          ))}
          {o.loyaltyRewardUsed && (
            <Badge className="bg-primary/15 text-primary border border-primary/30 gap-1">
              <Sparkles className="h-3 w-3" /> Recompensa
            </Badge>
          )}
          {phase === "in_progress" && (
            <Badge variant="outline" className="border-primary/60 text-primary gap-1">
              <Play className="h-3 w-3" /> {elapsed}min
            </Badge>
          )}
        </div>

        <div className="mt-3">
          {phase === "queued" && (
            <Button size="lg" onClick={() => start(o)}
              className="w-full h-12 gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <Play className="h-5 w-5" /> Iniciar lavagem
            </Button>
          )}
          {phase === "in_progress" && (
            <Button size="lg" onClick={() => finish(o)}
              className="w-full h-12 gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold">
              <CheckCircle2 className="h-5 w-5" /> Finalizar lavagem
            </Button>
          )}
          {phase === "completed" && (
            <Button size="lg" onClick={() => deliver(o)}
              className="w-full h-12 gap-2 bg-emerald-600 text-white hover:bg-emerald-500 font-semibold">
              <PackageCheck className="h-5 w-5" /> Concluir (cliente retirou)
            </Button>
          )}
        </div>
      </div>
    );
  };

  const emptyMsg = {
    queued: "Nenhum veículo aguardando.",
    in_progress: "Nenhuma lavagem em andamento.",
    completed: "Nenhum veículo finalizado aguardando retirada.",
  } as const;

  const content = (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as OrderStatus)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="queued" className="gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" /> Aguardando
            <Badge variant="secondary" className="ml-1 bg-primary/15 text-primary border-0">{buckets.queued.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> Lavando
            <Badge variant="secondary" className="ml-1 bg-primary/15 text-primary border-0">{buckets.in_progress.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Finalizados
            <Badge variant="secondary" className="ml-1 bg-primary/15 text-primary border-0">{buckets.completed.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {(["queued", "in_progress", "completed"] as OrderStatus[]).map((phase) => (
          <TabsContent key={phase} value={phase} className="mt-4 space-y-3">
            {buckets[phase as "queued" | "in_progress" | "completed"].length === 0 ? (
              <div className="text-center text-muted-foreground py-16 animate-fade-in">
                <Car className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <div className="text-sm">{emptyMsg[phase as keyof typeof emptyMsg]}</div>
              </div>
            ) : (
              buckets[phase as "queued" | "in_progress" | "completed"].map((o, i) => renderCard(o, i, phase))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );

  // Gerente: mantém o menu lateral esquerdo visível.
  if (role === "gerencia") {
    return (
      <AppShell>
        <header className="border-b border-border bg-gradient-surface px-6 py-4 flex items-center gap-4 sticky top-0 z-20 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" /> Fila de Lavagem
            </h1>
            <p className="text-xs text-muted-foreground">Aguardando · Lavando · Finalizados</p>
          </div>
          <Badge variant="outline" className="ml-auto border-primary/40 text-primary">
            {buckets.queued.length + buckets.in_progress.length + buckets.completed.length} veíc.
          </Badge>
        </header>
        <div className="flex-1 p-6 bg-surface-sunken overflow-auto">
          <div className="max-w-3xl mx-auto">{content}</div>
        </div>
        <footer className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground text-center">
          <Trophy className="h-3 w-3 inline mr-1 text-primary" />
          Cada lavagem principal acumula +1 para a placa.
        </footer>
      </AppShell>
    );
  }

  // Lava-jato (mobile): layout enxuto.
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 bg-gradient-surface border-b border-border px-4 py-3 flex items-center gap-3 backdrop-blur">
        <div className="h-9 w-9 rounded-lg bg-gradient-gold grid place-items-center text-primary-foreground font-bold">M</div>
        <div className="leading-tight min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Monaco</div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <ListOrdered className="h-3.5 w-3.5 text-primary" /> Fila de Lavagem
          </div>
        </div>
        <Badge variant="outline" className="ml-auto border-primary/40 text-primary">
          {buckets.queued.length + buckets.in_progress.length + buckets.completed.length} veíc.
        </Badge>
        <Button size="icon" variant="ghost" onClick={doLogout} aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      <main className="flex-1 p-3 sm:p-4 max-w-2xl w-full mx-auto">{content}</main>
      <footer className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground text-center">
        <Trophy className="h-3 w-3 inline mr-1 text-primary" />
        Cada lavagem principal acumula +1 para a placa.
      </footer>
    </div>
  );
}
