import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { brl, formatDuration } from "@/lib/storage";
import { useData } from "@/lib/DataContext";

const statusLabel: Record<string, { text: string; cls: string }> = {
  queued: { text: "Na fila", cls: "bg-primary/15 text-primary border-primary/30" },
  in_progress: { text: "Em andamento", cls: "bg-secondary text-secondary-foreground border-secondary" },
  completed: { text: "Finalizado", cls: "bg-success/20 text-success border-success/30" },
  delivered: { text: "Entregue", cls: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" },
  cancelled: { text: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

export default function History() {
  const [q, setQ] = useState("");
  const { orders } = useData();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!s) return list;
    return list.filter(
      (o) =>
        o.customerName.toLowerCase().includes(s) ||
        o.vehiclePlate.toLowerCase().includes(s)
    );
  }, [q, orders]);

  return (
    <AppShell>
      <header className="glass-chrome px-4 md:px-6 py-4 flex flex-wrap items-center gap-3 md:gap-4">
        <div className="hidden lg:block">
          <h1 className="text-[22px] font-semibold text-white">Histórico</h1>
        </div>
        <div className="ml-auto relative w-full sm:w-80 max-w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por placa ou nome" className="pl-9" />
        </div>
      </header>

      <div className="p-4 md:p-6 bg-surface-sunken flex-1 overflow-auto">
        <Card className="surface-card p-0 overflow-hidden">
          <div className="grid grid-cols-12 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border px-5 py-3">
            <div className="col-span-2">Data</div>
            <div className="col-span-2">Placa</div>
            <div className="col-span-3">Cliente</div>
            <div className="col-span-2">Serviço</div>
            <div className="col-span-1">Duração</div>
            <div className="col-span-1">Pagto</div>
            <div className="col-span-1 text-right">Total</div>
          </div>
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma ordem encontrada.</div>
          ) : (
            filtered.map((o) => {
              const st = statusLabel[o.status];
              const d = new Date(o.createdAt);
              return (
                <div key={o.id} className="grid grid-cols-12 items-center px-5 py-3 border-b border-border/60 text-sm hover:bg-muted/20">
                  <div className="col-span-2 text-muted-foreground text-xs">
                    {d.toLocaleDateString("pt-BR")}<br />
                    <span className="text-[11px]">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="col-span-2 font-mono">{o.vehiclePlate}</div>
                  <div className="col-span-3 truncate">{o.customerName}</div>
                  <div className="col-span-2">
                    <div>{o.service}</div>
                    {o.extras.length > 0 && (
                      <div className="text-[11px] text-muted-foreground">+ {o.extras.join(", ")}</div>
                    )}
                    <Badge variant="outline" className={`mt-1 ${st.cls}`}>{st.text}</Badge>
                  </div>
                  <div className="col-span-1 text-xs text-muted-foreground">{formatDuration(o.durationMinutes)}</div>
                  <div className="col-span-1 text-xs">{o.paymentMethod ?? "—"}</div>
                  <div className="col-span-1 text-right font-semibold text-primary">{brl(o.total)}</div>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </AppShell>
  );
}
