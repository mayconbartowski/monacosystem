import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, User, Trophy, Car, Sparkles } from "lucide-react";
import { useCustomers, useOrders, useVehicles } from "@/lib/dataStore";
import { brl, formatCpf, formatPlate, formatWhatsapp, normalizeCpf } from "@/lib/format";

export default function Customers() {
  const [q, setQ] = useState("");
  const customers = useCustomers();
  const orders = useOrders();
  const vehicles = useVehicles();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    const digits = s.replace(/\D/g, "");
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (digits && c.cpf.includes(digits)) ||
        (digits && c.whatsapp.includes(digits))
    );
  }, [q, customers]);

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-xs text-muted-foreground">{customers.length} cadastrados · fidelidade por placa</p>
        </div>
        <div className="ml-auto relative w-80 max-w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CPF ou WhatsApp" className="pl-9" />
        </div>
      </header>

      <div className="p-6 bg-surface-sunken flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-20 text-sm">
            <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const cOrders = orders.filter((o) => o.customerId === c.id);
              const cVehicles = vehicles.filter((v) => v.customerId === c.id);
              const totalSpent = cOrders.filter((o) => o.status !== "cancelled").reduce((a, o) => a + o.total, 0);
              const rewards = cVehicles.filter((v) => v.rewardAvailable).length;
              return (
                <Card key={c.id} className="surface-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{formatCpf(c.cpf)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatWhatsapp(c.whatsapp)}</div>
                    </div>
                    {rewards > 0 && (
                      <Badge variant="outline" className="border-primary/40 text-primary gap-1 shrink-0">
                        <Sparkles className="h-3 w-3" />
                        {rewards} {rewards === 1 ? "benefício" : "benefícios"}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Pedidos" value={String(cOrders.length)} />
                    <Mini label="Veículos" value={String(cVehicles.length)} />
                    <Mini label="Gasto" value={brl(totalSpent)} />
                  </div>
                  {cVehicles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {cVehicles.map((v) => (
                        <div key={v.id} className="rounded-lg border border-border bg-muted/20 p-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-mono font-medium">
                              <Car className="h-3 w-3 text-muted-foreground" />
                              {formatPlate(v.plate)}
                              <span className="text-muted-foreground font-sans">· {v.brand} {v.model}</span>
                            </div>
                            {v.rewardAvailable ? (
                              <span className="text-primary font-semibold flex items-center gap-1">
                                <Trophy className="h-3 w-3" /> Pronto
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{v.washCount ?? 0}/10</span>
                            )}
                          </div>
                          <Progress
                            value={v.rewardAvailable ? 100 : ((v.washCount ?? 0) / 10) * 100}
                            className="h-1.5 mt-2"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
