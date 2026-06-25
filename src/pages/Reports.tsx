import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, brl } from "@/lib/storage";
import { PaymentMethod, SERVICE_KEYS } from "@/lib/domain";

export default function Reports() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const orders = db.listOrders();

  const day = useMemo(
    () => orders.filter((o) => o.createdAt.slice(0, 10) === date && o.status !== "cancelled"),
    [orders, date]
  );

  const revenue = day.reduce((a, o) => a + o.total, 0);
  const discounts = day.reduce((a, o) => a + o.discount + o.loyaltyDiscount, 0);
  const byPayment: Record<PaymentMethod, number> = { Crédito: 0, Débito: 0, Pix: 0 };
  day.forEach((o) => o.paymentMethod && (byPayment[o.paymentMethod] += o.total));

  const byService: Record<string, { count: number; total: number }> = {};
  SERVICE_KEYS.forEach((s) => (byService[s] = { count: 0, total: 0 }));
  day.forEach((o) => {
    byService[o.service].count += 1;
    byService[o.service].total += o.total;
  });

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Relatório Diário</h1>
          <p className="text-xs text-muted-foreground">Resumo de vendas do dia</p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
        </div>
      </header>

      <div className="p-6 bg-surface-sunken flex-1 overflow-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Faturamento" value={brl(revenue)} accent />
          <Stat label="Vendas" value={String(day.length)} />
          <Stat label="Descontos" value={brl(discounts)} />
          <Stat label="Ticket médio" value={brl(day.length ? revenue / day.length : 0)} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="surface-card p-5">
            <h3 className="text-sm font-semibold mb-3">Por forma de pagamento</h3>
            <div className="space-y-2">
              {Object.entries(byPayment).map(([k, v]) => (
                <Row key={k} label={k} value={brl(v)} />
              ))}
            </div>
          </Card>
          <Card className="surface-card p-5">
            <h3 className="text-sm font-semibold mb-3">Por serviço</h3>
            <div className="space-y-2">
              {Object.entries(byService).map(([k, v]) => (
                <Row key={k} label={`${k} (${v.count})`} value={brl(v.total)} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="surface-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${accent ? "gold-text" : ""}`}>{value}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border text-sm">
      <span>{label}</span>
      <span className="font-semibold text-primary">{value}</span>
    </div>
  );
}
