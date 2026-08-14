import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ListOrdered,
  Clock,
  CheckCircle2,
  Play,
  Car,
  LogOut,
  Trophy,
  Sparkles,
  PackageCheck,
  Building2,
} from "lucide-react";
import { Order, OrderStatus } from "@/lib/domain";
import { formatDuration } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { useData } from "@/lib/DataContext";
import { finishOrder, startOrder } from "@/services/data";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ServiceIcon } from "@/components/ServiceIcon";
import { AppShell } from "@/components/AppShell";
import { AmbientGlow } from "@/components/AmbientGlow";
import { PickupPaymentDialog } from "@/components/PickupPaymentDialog";
import { cn, errorMessage } from "@/lib/utils";

export default function Queue() {
  const { logout, role, perms } = useAuth();
  const navigate = useNavigate();
  const { orders, partnerContracts } = useData();
  const [, force] = useState(0);
  const [tab, setTab] = useState<OrderStatus>("queued");
  const [picking, setPicking] = useState<Order | null>(null);
  const canPickup = !!perms?.takePayment;

  useEffect(() => {
    let cancelled = false;
    let handle: number;
    const tick = () => {
      if (cancelled) return;
      force((n) => n + 1);
      handle = window.setTimeout(tick, 30_000);
    };
    handle = window.setTimeout(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, []);

  const buckets = useMemo(() => {
    const all = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return {
      queued: all.filter((o) => o.status === "queued"),
      in_progress: all.filter((o) => o.status === "in_progress"),
      completed: all.filter((o) => o.status === "completed"),
    };
  }, [orders]);
  const totalVehicles = buckets.queued.length + buckets.in_progress.length + buckets.completed.length;

  const contractById = useMemo(() => {
    const m = new Map<string, (typeof partnerContracts)[number]>();
    partnerContracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [partnerContracts]);

  const usageFor = (contractId: string) => {
    const c = contractById.get(contractId);
    if (!c) return { used: 0, limit: 0 };
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const used = orders.filter(
      (o) => o.partnerContractId === contractId && o.status !== "cancelled" && o.createdAt.slice(0, 7) === monthPrefix,
    ).length;
    return { used, limit: c.monthlyVehicleLimit };
  };

  const start = async (o: Order) => {
    try {
      await startOrder(o.id);
      toast.success(`Lavagem iniciada — ${o.vehiclePlate}`);
      setTab("in_progress");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Erro ao iniciar"));
    }
  };
  const finish = async (o: Order) => {
    try {
      await finishOrder(o);
      toast.success(`Finalizado — ${o.vehiclePlate}`);
      setTab("completed");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Erro ao finalizar"));
    }
  };

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const renderCard = (o: Order, i: number, phase: OrderStatus) => {
    const started = o.startedAt ? new Date(o.startedAt) : null;
    const elapsed = started ? Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000)) : 0;
    return (
      <div
        key={o.id}
        className={cn(
          "surface-card p-4 animate-fade-in",
          phase === "in_progress" && "border-primary/50",
          phase === "completed" && "border-emerald-500/40",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0 text-lg font-bold">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-lg font-semibold leading-tight flex items-center gap-2">
              {o.vehiclePlate}
              {o.orderSource === "partner" && (
                <Badge variant="outline" className="border-primary/40 text-primary gap-1 text-[10px]">
                  <Building2 className="h-2.5 w-2.5" /> Contrato
                </Badge>
              )}
            </div>
            <div className="text-sm text-foreground/90 truncate">{o.vehicleLabel}</div>
            <div className="text-xs text-muted-foreground truncate">
              {o.customerName} · {o.category}
            </div>
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
            <Badge key={e} variant="outline" className="border-border bg-muted/30">
              {e}
            </Badge>
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
          {phase === "completed" && o.paymentStatus !== "paid" && (
            <Badge variant="outline" className="border-yellow-500/40 text-yellow-500">
              Pagamento pendente
            </Badge>
          )}
        </div>

        <div className="mt-3">
          {phase === "queued" && (
            <Button
              size="lg"
              onClick={() => start(o)}
              className="w-full h-12 gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              <Play className="h-5 w-5" /> Iniciar lavagem
            </Button>
          )}
          {phase === "in_progress" && (
            <Button
              size="lg"
              onClick={() => finish(o)}
              className="w-full h-12 gap-2 bg-primary text-primary-foreground hover:opacity-90 font-semibold"
            >
              <CheckCircle2 className="h-5 w-5" /> Finalizar lavagem
            </Button>
          )}
          {phase === "completed" && canPickup && o.paymentStatus !== "paid" && (
            <Button
              size="lg"
              onClick={() => setPicking(o)}
              className="w-full h-12 gap-2 bg-primary text-primary-foreground hover:opacity-90 font-semibold"
            >
              <PackageCheck className="h-5 w-5" /> Iniciar Retirada
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
        <TabsList className="grid grid-cols-3 w-full h-[50px] p-1 gap-0.5">
          <TabsTrigger value="queued" className="h-full w-full flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-[11px] sm:text-sm whitespace-nowrap">
            <ListOrdered className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" /> Aguardando
            <Badge variant="secondary" className="ml-0.5 sm:ml-1 px-1.5 py-0 text-[10px] sm:text-xs bg-primary/15 text-primary border-0">
              {buckets.queued.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="in_progress"
            className="h-full w-full flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-[11px] sm:text-sm whitespace-nowrap"
          >
            <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" /> Lavando
            <Badge variant="secondary" className="ml-0.5 sm:ml-1 px-1.5 py-0 text-[10px] sm:text-xs bg-primary/15 text-primary border-0">
              {buckets.in_progress.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            className="h-full w-full flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-[11px] sm:text-sm whitespace-nowrap"
          >
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" /> Finalizados
            <Badge variant="secondary" className="ml-0.5 sm:ml-1 px-1.5 py-0 text-[10px] sm:text-xs bg-primary/15 text-primary border-0">
              {buckets.completed.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {(["queued", "in_progress", "completed"] as OrderStatus[]).map((phase) => (
          <TabsContent key={phase} value={phase} className="mt-3 space-y-1.5">
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

      <PickupPaymentDialog
        order={picking}
        open={!!picking}
        onOpenChange={(o) => !o && setPicking(null)}
        partnerLabel={picking?.partnerContractId ? contractById.get(picking.partnerContractId)?.companyName : undefined}
        partnerUsage={picking?.partnerContractId ? usageFor(picking.partnerContractId) : undefined}
      />
    </>
  );

  if (role === "gerencia") {
    return (
      <AppShell
        mobileTitleAccessory={
          <Badge
            variant="outline"
            aria-label={`${totalVehicles} veículos no total`}
            className="border-primary/40 text-primary whitespace-nowrap"
          >
            {totalVehicles}
          </Badge>
        }
      >
        <header className="glass-chrome px-4 md:px-6 py-4 hidden lg:flex flex-wrap items-center gap-3 md:gap-4 sticky top-0 z-20 ">
          <div className="hidden lg:block">
            <h1 className="text-[22px] font-semibold tracking-tight text-white flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" /> Fila de Lavagem
            </h1>
          </div>
          <Badge variant="outline" className="ml-auto border-primary/40 text-primary">
            {totalVehicles} veíc.
          </Badge>
        </header>
        <div className="flex-1 p-4 md:p-6 bg-surface-sunken overflow-auto">
          <div className="max-w-3xl mx-auto">{content}</div>
        </div>
        <footer className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground text-center">
          <Trophy className="h-3 w-3 inline mr-1 text-primary" />
          Fidelidade da placa é consolidada no pagamento.
        </footer>
      </AppShell>
    );
  }

  return (
    <div className="relative isolate min-h-screen flex flex-col bg-transparent">
      <AmbientGlow />
      <header className="glass-chrome sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold">M</div>
        <div className="leading-tight min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Monaco</div>
          <div className="text-sm font-semibold flex items-center gap-1.5 min-w-0">
            <ListOrdered className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Fila de Lavagem</span>
            <Badge
              variant="outline"
              aria-label={`${totalVehicles} veículos no total`}
              className="shrink-0 border-primary/40 text-primary whitespace-nowrap"
            >
              {totalVehicles}
            </Badge>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={doLogout} aria-label="Sair" className="ml-auto shrink-0">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      <main className="relative z-10 flex-1 p-3 sm:p-4 max-w-2xl w-full mx-auto">{content}</main>
      <footer className="relative z-10 border-t border-border px-4 py-3 text-[11px] text-muted-foreground text-center">
        <Trophy className="h-3 w-3 inline mr-1 text-primary" />
        Fidelidade consolidada no pagamento.
      </footer>
    </div>
  );
}
