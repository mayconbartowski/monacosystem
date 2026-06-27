import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Car, DollarSign, TrendingUp, Users, ListOrdered,
  Trophy, Sparkles, Target,
} from "lucide-react";
import { db, brl, formatDuration, formatPlate } from "@/lib/storage";
import { activeQueue, totalQueueWait } from "@/lib/pricing";

export default function Dashboard() {
  const orders = db.listOrders();
  const customers = db.listCustomers();
  const vehicles = db.listVehicles();
  const queue = activeQueue(orders);
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7); // YYYY-MM

  const todays = useMemo(
    () => orders.filter((o) => o.createdAt.slice(0, 10) === today && o.status !== "cancelled"),
    [orders, today]
  );
  const revenue = todays.reduce((a, o) => a + o.total, 0);
  const completed = orders.filter((o) => o.status === "completed").length;

  // ---- Fidelidade (placa) ----
  const rewardsThisMonth = useMemo(
    () => orders.filter((o) =>
      o.status === "completed" &&
      o.loyaltyRewardUsed &&
      (o.completedAt || o.createdAt).slice(0, 7) === monthPrefix
    ).length,
    [orders, monthPrefix]
  );
  const closeToReward = vehicles.filter(
    (v) => !v.rewardAvailable && ((v.washCount ?? 0) === 8 || (v.washCount ?? 0) === 9)
  );
  const benefitsAvailable = vehicles.filter((v) => v.rewardAvailable);

  const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Visão operacional Monaco System</p>
      </header>
      <div className="p-6 space-y-6 bg-surface-sunken flex-1 overflow-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric icon={<DollarSign />} label="Faturamento hoje" value={brl(revenue)} />
          <Metric icon={<TrendingUp />} label="Vendas hoje" value={String(todays.length)} />
          <Metric icon={<Car />} label="Veículos na fila" value={String(queue.length)} />
          <Metric icon={<Clock />} label="Tempo total fila" value={formatDuration(totalQueueWait(orders))} />
          <Metric icon={<Users />} label="Clientes cadastrados" value={String(customers.length)} />
          <Metric icon={<ListOrdered />} label="Serviços concluídos" value={String(completed)} />
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Programa de Fidelidade <span className="text-muted-foreground font-normal">· por placa</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Metric icon={<Sparkles />} label="Recompensas concedidas no mês" value={String(rewardsThisMonth)} />
            <Metric icon={<Target />} label="Veículos próximos (8–9 lavagens)" value={String(closeToReward.length)} />
            <Metric icon={<Trophy />} label="Benefícios aguardando uso" value={String(benefitsAvailable.length)} />
          </div>

          {(closeToReward.length > 0 || benefitsAvailable.length > 0) && (
            <Card className="surface-card p-5 mt-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Benefícios disponíveis
                  </div>
                  {benefitsAvailable.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhum no momento.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {benefitsAvailable.slice(0, 12).map((v) => (
                        <Badge key={v.id} className="bg-primary/15 text-primary border border-primary/30 font-mono">
                          {formatPlate(v.plate)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Próximas da recompensa
                  </div>
                  {closeToReward.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhuma no momento.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {closeToReward.slice(0, 12).map((v) => (
                        <Badge key={v.id} variant="outline" className="border-border font-mono">
                          {formatPlate(v.plate)} · {v.washCount}/10
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>


        <Card className="bg-card border-border p-5">
          <h2 className="text-sm font-semibold mb-4">Últimas vendas</h2>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda registrada ainda.</div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((o) => (
                <div key={o.id} className="py-3 flex items-center gap-3">
                  <div className="font-mono text-sm w-24">{o.vehiclePlate}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{o.customerName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {o.service} {o.extras.length ? `+ ${o.extras.join(", ")}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {o.status === "completed" ? "Concluído" : o.status === "queued" ? "Fila" : o.status === "in_progress" ? "Em andamento" : "Cancelado"}
                  </Badge>
                  <div className="w-28 text-right font-semibold text-primary">{brl(o.total)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="surface-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">{icon}</div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </div>
    </Card>
  );
}
