import { useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, Legend, CartesianGrid,
  BarChart, Bar,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { brl } from "@/lib/storage";
import { PaymentMethod, VEHICLE_CATEGORIES, VehicleCategory } from "@/lib/domain";
import { useData } from "@/lib/DataContext";
import { cn } from "@/lib/utils";

type Preset = "7" | "30" | "365" | "custom";
const PAYMENTS: PaymentMethod[] = ["Crédito", "Débito", "Pix"];
const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  Crédito: "hsl(38 100% 55%)",
  Débito: "hsl(210 90% 60%)",
  Pix: "hsl(150 70% 50%)",
};

export default function Reports() {
  const { orders, customers, services } = useData();
  const [preset, setPreset] = useState<Preset>("7");
  const [range, setRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });

  const { from, to } = useMemo(() => {
    if (preset === "custom" && range?.from) {
      return { from: startOfDay(range.from), to: endOfDay(range.to ?? range.from) };
    }
    const days = preset === "7" ? 6 : preset === "30" ? 29 : 364;
    return { from: startOfDay(subDays(new Date(), days)), to: endOfDay(new Date()) };
  }, [preset, range]);

  const rangeOrders = useMemo(() => {
    const f = from.getTime(); const t = to.getTime();
    return orders.filter((o) => {
      if (o.status === "cancelled") return false;
      const d = new Date(o.createdAt).getTime();
      return d >= f && d <= t;
    });
  }, [orders, from, to]);

  const revenue = rangeOrders.reduce((a, o) => a + o.total, 0);
  const discounts = rangeOrders.reduce((a, o) => a + o.discount + o.loyaltyDiscount, 0);

  // Customers indicators
  const registeredInPeriod = useMemo(() => customers.filter((c) => {
    const d = new Date(c.createdAt).getTime();
    return d >= from.getTime() && d <= to.getTime();
  }).length, [customers, from, to]);
  const attendedInPeriod = useMemo(() => {
    const set = new Set<string>();
    rangeOrders.forEach((o) => o.customerId && set.add(o.customerId));
    return set.size;
  }, [rangeOrders]);

  // Payment method time series
  const paymentSeries = useMemo(() => {
    const days = eachDayOfInterval({ start: from, end: to });
    const byDay = new Map<string, Record<string, number> & { label: string }>();
    days.forEach((d) => {
      const k = format(d, "yyyy-MM-dd");
      byDay.set(k, { label: format(d, days.length > 60 ? "MMM/yy" : "dd/MM", { locale: ptBR }), Crédito: 0, Débito: 0, Pix: 0 } as any);
    });
    rangeOrders.forEach((o) => {
      const k = format(new Date(o.createdAt), "yyyy-MM-dd");
      const row = byDay.get(k);
      if (row && o.paymentMethod) (row as any)[o.paymentMethod] += o.total;
    });
    return Array.from(byDay.values());
  }, [rangeOrders, from, to]);

  const byPaymentTotal: Record<PaymentMethod, number> = { Crédito: 0, Débito: 0, Pix: 0 };
  rangeOrders.forEach((o) => o.paymentMethod && (byPaymentTotal[o.paymentMethod] += o.total));

  // Service bar chart
  const serviceData = useMemo(() => {
    const list = services.length ? services.map((s) => s.name || s.key) : [];
    const seen = new Set<string>();
    const rows: { label: string; qty: number; total: number }[] = [];
    rangeOrders.forEach((o) => {
      const key = o.service;
      if (!seen.has(key)) { seen.add(key); rows.push({ label: key, qty: 0, total: 0 }); }
    });
    // ensure all defined services appear
    list.forEach((n, i) => {
      const key = services[i].key;
      if (!seen.has(key)) { seen.add(key); rows.push({ label: key, qty: 0, total: 0 }); }
    });
    rangeOrders.forEach((o) => {
      const r = rows.find((x) => x.label === o.service);
      if (r) { r.qty += 1; r.total += o.total; }
    });
    return rows;
  }, [rangeOrders, services]);

  // Category breakdown
  const categoryStats = useMemo(() => {
    const map = new Map<VehicleCategory | string, { qty: number; total: number }>();
    VEHICLE_CATEGORIES.forEach((c) => map.set(c, { qty: 0, total: 0 }));
    rangeOrders.forEach((o) => {
      const cur = map.get(o.category) ?? { qty: 0, total: 0 };
      cur.qty += 1; cur.total += o.total;
      map.set(o.category, cur);
    });
    return Array.from(map.entries()).map(([label, v]) => ({ label, ...v }));
  }, [rangeOrders]);

  const rangeLabel = `${format(from, "dd/MM/yyyy")} — ${format(to, "dd/MM/yyyy")}`;

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(["7", "30", "365"] as Preset[]).map((p) => (
            <Button key={p} size="sm" variant={preset === p ? "default" : "outline"}
              onClick={() => setPreset(p)}
              className={cn(preset === p && "bg-gradient-gold text-primary-foreground border-0")}>
              {p === "7" ? "Últimos 7 dias" : p === "30" ? "Últimos 30 dias" : "Últimos 365 dias"}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={preset === "custom" ? "default" : "outline"}
                className={cn("gap-2", preset === "custom" && "bg-gradient-gold text-primary-foreground border-0")}>
                <CalendarIcon className="h-3.5 w-3.5" /> Período específico
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => { setRange(r); setPreset("custom"); }}
                numberOfMonths={2}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className="p-6 bg-surface-sunken flex-1 overflow-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Faturamento" value={brl(revenue)} accent />
          <Stat label="Vendas" value={String(rangeOrders.length)} />
          <Stat label="Descontos" value={brl(discounts)} />
          <Stat label="Ticket médio" value={brl(rangeOrders.length ? revenue / rangeOrders.length : 0)} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Clientes cadastrados no período" value={String(registeredInPeriod)} />
          <Stat label="Clientes atendidos no período" value={String(attendedInPeriod)} />
          <Stat label="Base total de clientes" value={String(customers.length)} />
          <Stat label="Serviços concluídos" value={String(rangeOrders.filter((o) => o.status === "completed" || o.status === "delivered").length)} />
        </div>

        <Card className="surface-card p-5">
          <h3 className="text-sm font-semibold mb-4">Faturamento por forma de pagamento</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paymentSeries} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <RTooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {PAYMENTS.map((p) => (
                  <Line key={p} type="monotone" dataKey={p} stroke={PAYMENT_COLORS[p]}
                    strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {PAYMENTS.map((p) => (
              <Row key={p} label={p} value={brl(byPaymentTotal[p])} />
            ))}
          </div>
        </Card>

        <Card className="surface-card p-5">
          <h3 className="text-sm font-semibold mb-4">Faturamento por serviço</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <RTooltip
                  formatter={(v: number, name) => name === "total" ? brl(v) : String(v)}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="total" name="Faturamento" fill="hsl(38 100% 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {serviceData.map((s) => (
              <Row key={s.label} label={`${s.label} (${s.qty})`} value={brl(s.total)} />
            ))}
          </div>
        </Card>

        <Card className="surface-card p-5">
          <h3 className="text-sm font-semibold mb-4">Por categoria de veículo</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoryStats.map((c) => (
              <div key={c.label as string} className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <div className="text-2xl font-bold">{c.qty}</div>
                  <div className="text-sm font-semibold text-primary">{brl(c.total)}</div>
                </div>
                <div className="text-[11px] text-muted-foreground">veículos atendidos · faturamento</div>
              </div>
            ))}
          </div>
        </Card>
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
      <span className="truncate">{label}</span>
      <span className="font-semibold text-primary shrink-0">{value}</span>
    </div>
  );
}
