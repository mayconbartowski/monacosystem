import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Car, ChevronDown, ChevronRight, Clock, Play, CheckCircle2,
  ListOrdered, Sparkles, Trophy, Hourglass, FileText, User, Phone, XCircle,
} from "lucide-react";
import {
  Order, completeOrder, startOrder, cancelOrder, useOrders, useStats,
  getServiceById, avgServiceMinutes,
} from "@/lib/dataStore";
import { brl, formatDuration, formatPlate, formatWhatsapp } from "@/lib/format";
import { useElapsed, formatElapsed } from "@/hooks/useElapsed";
import { useHasRole } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Queue() {
  const orders = useOrders();
  useStats(); // ensure rerender on stats updates
  const isManager = useHasRole("gerencia");

  const today = new Date().toISOString().slice(0, 10);

  const lavando = orders.filter((o) => o.status === "in_progress").sort((a, b) =>
    (a.startedAt ?? "").localeCompare(b.startedAt ?? "")
  );
  const proximos = orders.filter((o) => o.status === "queued").sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const lavados = orders
    .filter((o) => o.status === "completed" && (o.completedAt ?? "").slice(0, 10) === today)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return (
    <AppShell>
      <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" />
            Fila de Lavagem
          </h1>
          <p className="text-xs text-muted-foreground">
            Tempo real · {lavando.length + proximos.length} ativos
          </p>
        </div>
      </header>

      {/* Desktop: 3 columns */}
      <div className="hidden lg:grid flex-1 p-6 bg-surface-sunken overflow-auto grid-cols-3 gap-6">
        <Column title="Lavando" accent="text-primary" icon={<Hourglass className="h-4 w-4" />} count={lavando.length} emptyText="Nenhum veículo em lavagem.">
          {lavando.map((o) => <OrderCard key={o.id} order={o} canCancel={isManager} variant="in_progress" />)}
        </Column>
        <Column title="Próximos" accent="text-foreground" icon={<Clock className="h-4 w-4" />} count={proximos.length} emptyText="Fila vazia.">
          {proximos.map((o, i) => <OrderCard key={o.id} order={o} canCancel={isManager} variant="queued" position={i + 1} />)}
        </Column>
        <Column title="Lavados (hoje)" accent="text-success" icon={<CheckCircle2 className="h-4 w-4" />} count={lavados.length} emptyText="Nada concluído hoje ainda.">
          {lavados.slice(0, 30).map((o) => <OrderCard key={o.id} order={o} variant="completed" />)}
        </Column>
      </div>

      {/* Mobile: tabs */}
      <div className="lg:hidden flex-1 p-3 bg-surface-sunken overflow-auto">
        <Tabs defaultValue="lavando" className="w-full">
          <TabsList className="grid grid-cols-3 w-full sticky top-0 z-10">
            <TabsTrigger value="lavando" className="text-xs gap-1">
              <Hourglass className="h-3.5 w-3.5" /> Lavando
              <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">{lavando.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="proximos" className="text-xs gap-1">
              <Clock className="h-3.5 w-3.5" /> Próximos
              <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">{proximos.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="lavados" className="text-xs gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Lavados
              <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">{lavados.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lavando" className="space-y-3 mt-3">
            {lavando.length === 0
              ? <Empty text="Nenhum veículo em lavagem." />
              : lavando.map((o) => <OrderCard key={o.id} order={o} canCancel={isManager} variant="in_progress" />)}
          </TabsContent>
          <TabsContent value="proximos" className="space-y-3 mt-3">
            {proximos.length === 0
              ? <Empty text="Fila vazia." />
              : proximos.map((o, i) => <OrderCard key={o.id} order={o} canCancel={isManager} variant="queued" position={i + 1} />)}
          </TabsContent>
          <TabsContent value="lavados" className="space-y-3 mt-3">
            {lavados.length === 0
              ? <Empty text="Nada concluído hoje ainda." />
              : lavados.slice(0, 30).map((o) => <OrderCard key={o.id} order={o} variant="completed" />)}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-muted-foreground text-xs py-12">{text}</div>;
}

function Column({
  title, icon, count, accent, emptyText, children,
}: {
  title: string; icon: React.ReactNode; count: number; accent: string;
  emptyText: string; children: React.ReactNode;
}) {
  return (
    <section className="surface-card flex flex-col min-h-[300px]">
      <header className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className={cn("flex items-center gap-2 font-semibold text-sm", accent)}>
          {icon}
          {title}
        </div>
        <Badge variant="outline" className="border-border">{count}</Badge>
      </header>
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {count === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-12">{emptyText}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function OrderCard({
  order, variant, canCancel, position,
}: {
  order: Order;
  variant: "in_progress" | "queued" | "completed";
  canCancel?: boolean;
  position?: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(variant === "in_progress" ? order.startedAt ?? null : null);
  const svc = getServiceById(order.serviceId);
  const expectedMin = svc ? (avgServiceMinutes(svc.id) ?? order.durationMinutes) : order.durationMinutes;

  const start = async () => {
    setBusy(true);
    try { await startOrder(order.id); toast.success("Lavagem iniciada"); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const finish = async () => {
    setBusy(true);
    try {
      await completeOrder(order.id);
      toast.success(`Serviço concluído — ${order.vehiclePlate}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { await cancelOrder(order.id); toast("Pedido cancelado"); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn(
        "rounded-xl border bg-card transition-all",
        variant === "in_progress" && "border-primary/40 shadow-glow",
        variant === "queued" && "border-border",
        variant === "completed" && "border-border opacity-90",
      )}>
        <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 text-left">
          {position && (
            <span className="h-7 w-7 grid place-items-center rounded-md bg-primary/15 text-primary text-xs font-bold shrink-0">
              {position}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-mono font-semibold text-sm">{order.vehiclePlate}</div>
            <div className="text-xs text-muted-foreground truncate">
              {order.vehicleLabel || "Veículo"} · {order.category}
            </div>
          </div>
          <div className="text-right shrink-0">
            {variant === "in_progress" ? (
              <div className="text-sm font-mono font-bold text-primary tabular-nums">
                {formatElapsed(elapsed)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" /> {formatDuration(expectedMin)}
              </div>
            )}
            {order.loyaltyRewardUsed && (
              <Badge className="bg-primary/15 text-primary border border-primary/30 gap-1 mt-1">
                <Sparkles className="h-3 w-3" /> Fidelidade
              </Badge>
            )}
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/60">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <DetailLine icon={<User className="h-3 w-3" />} label="Cliente" value={order.customerName} />
              <DetailLine icon={<Car className="h-3 w-3" />} label="Serviço" value={`${svc?.title ?? order.serviceKey}`} />
              <DetailLine icon={<Clock className="h-3 w-3" />} label="Entrada" value={new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} />
              <DetailLine icon={<Clock className="h-3 w-3" />} label="Previsto" value={formatDuration(expectedMin)} />
            </div>
            {order.extras.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {order.extras.map((e) => (
                  <Badge key={e} variant="outline" className="border-border bg-muted/30 text-[11px]">{e}</Badge>
                ))}
              </div>
            )}
            {order.notes && (
              <div className="text-xs bg-muted/30 border border-border rounded-md p-2 flex gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{order.notes}</span>
              </div>
            )}
            {variant === "completed" && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                Concluído às {order.completedAt ? new Date(order.completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                {order.actualMinutes && <span>· tempo real {formatDuration(order.actualMinutes)}</span>}
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <div className="text-sm font-bold text-primary">{brl(order.total)}</div>
              <div className="flex gap-2">
                {variant === "queued" && (
                  <Button size="sm" onClick={start} disabled={busy} className="gap-1.5 bg-gradient-gold text-primary-foreground hover:opacity-90">
                    <Play className="h-3.5 w-3.5" /> Iniciar
                  </Button>
                )}
                {variant === "in_progress" && (
                  <Button size="sm" onClick={finish} disabled={busy} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                  </Button>
                )}
                {canCancel && variant !== "completed" && (
                  <Button size="sm" variant="ghost" onClick={cancel} disabled={busy} className="text-muted-foreground hover:text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DetailLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate">{value}</div>
      </div>
    </div>
  );
}
