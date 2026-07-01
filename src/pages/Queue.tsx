import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListOrdered, Clock, CheckCircle2, Play, Car, LogOut, Trophy, Sparkles,
} from "lucide-react";
import { Order } from "@/lib/domain";
import { activeQueue } from "@/lib/pricing";
import { formatDuration } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { useData } from "@/lib/DataContext";
import { finishOrder, startOrder } from "@/services/data";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ServiceIcon } from "@/components/ServiceIcon";
import { cn } from "@/lib/utils";

export default function Queue() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { orders } = useData();
  const [, force] = useState(0);

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

  const queue = activeQueue(orders);

  const start = async (o: Order) => {
    try { await startOrder(o.id); toast.success(`Lavagem iniciada — ${o.vehiclePlate}`); }
    catch (e: any) { toast.error(e.message ?? "Erro ao iniciar"); }
  };

  const finish = async (o: Order) => {
    try { await finishOrder(o); toast.success(`Concluído — ${o.vehiclePlate}`); }
    catch (e: any) { toast.error(e.message ?? "Erro ao finalizar"); }
  };

  const doLogout = async () => { await logout(); navigate("/login"); };

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
          {queue.length} veíc.
        </Badge>
        <Button size="icon" variant="ghost" onClick={doLogout} aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="flex-1 p-3 sm:p-4 space-y-3 max-w-2xl w-full mx-auto">
        {queue.length === 0 ? (
          <div className="text-center text-muted-foreground py-24 animate-fade-in">
            <Car className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <div className="text-sm">Nenhum veículo na fila no momento.</div>
          </div>
        ) : (
          queue.map((o, i) => {
            const started = o.startedAt ? new Date(o.startedAt) : null;
            const elapsed = started ? Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000)) : 0;
            const inProgress = o.status === "in_progress";
            return (
              <div key={o.id} className={cn("surface-card p-4 animate-fade-in", inProgress && "border-primary/50 shadow-glow")}>
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
                  {inProgress && (
                    <Badge variant="outline" className="border-primary/60 text-primary gap-1">
                      <Play className="h-3 w-3" /> Em andamento · {elapsed}min
                    </Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {!inProgress ? (
                    <Button size="lg" onClick={() => start(o)}
                      className="col-span-2 h-12 gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      <Play className="h-5 w-5" /> Iniciar lavagem
                    </Button>
                  ) : (
                    <Button size="lg" onClick={() => finish(o)}
                      className="col-span-2 h-12 gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold">
                      <CheckCircle2 className="h-5 w-5" /> Finalizar
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      <footer className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground text-center">
        <Trophy className="h-3 w-3 inline mr-1 text-primary" />
        Cada lavagem principal acumula +1 para a placa.
      </footer>
    </div>
  );
}
