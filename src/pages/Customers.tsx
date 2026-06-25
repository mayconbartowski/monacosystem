import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, User, Trophy, Car } from "lucide-react";
import { db, brl, formatCpf, formatPhone } from "@/lib/storage";
import { getLoyalty } from "@/lib/pricing";

export default function Customers() {
  const [q, setQ] = useState("");
  const customers = db.listCustomers();
  const orders = db.listOrders();
  const vehicles = db.listVehicles();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.cpf.includes(s.replace(/\D/g, "")) ||
        c.phone.includes(s)
    );
  }, [q, customers]);

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-xs text-muted-foreground">{customers.length} cadastrados</p>
        </div>
        <div className="ml-auto relative w-80 max-w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CPF ou telefone" className="pl-9" />
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
              const loyalty = getLoyalty(c.totalOrders);
              return (
                <Card key={c.id} className="surface-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{formatCpf(c.cpf)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatPhone(c.phone)}</div>
                    </div>
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      <Trophy className="h-3 w-3 mr-1" />
                      {c.totalOrders}/10
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Pedidos" value={String(cOrders.length)} />
                    <Mini label="Veículos" value={String(cVehicles.length)} />
                    <Mini label="Gasto" value={brl(totalSpent)} />
                  </div>
                  {cVehicles.length > 0 && (
                    <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-1">
                      {cVehicles.slice(0, 3).map((v) => (
                        <Badge key={v.id} variant="outline" className="border-border">
                          <Car className="h-3 w-3 mr-1" /> {v.plate}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    {loyalty.isRewardPurchase
                      ? "Próxima compra: prêmio disponível"
                      : `${loyalty.untilReward} compras até o prêmio`}
                  </div>
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
