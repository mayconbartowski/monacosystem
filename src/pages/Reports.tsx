import { useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  ResponsiveContainer, Line, XAxis, YAxis, Tooltip as RTooltip, Legend, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/storage";
import { PaymentMethod, VEHICLE_CATEGORIES, VehicleCategory } from "@/lib/domain";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENTS } from "@/lib/expenses";
import { useData } from "@/lib/DataContext";
import { isOrderPaid, orderFinancialDate } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Preset = "7" | "30" | "365" | "custom";
const PAYMENTS: PaymentMethod[] = ["Crédito", "Débito", "Pix"];
const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  Crédito: "hsl(0 0% 62%)",
  Débito: "hsl(var(--primary))",
  Pix: "hsl(0 0% 39%)",
};
const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(70 30% 45%)",   // olive
  "hsl(38 55% 55%)",   // âmbar dessaturado
  "hsl(105 20% 55%)",  // sage
  "hsl(180 25% 45%)",  // teal
  "hsl(210 20% 55%)",  // steel
  "hsl(300 15% 55%)",  // mauve
  "hsl(15 40% 52%)",   // terracota
];

export default function Reports() {
  const { orders, customers, services, expenses, partnerContracts } = useData();
  const [preset, setPreset] = useState<Preset>("30");
  const [range, setRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const { from, to } = useMemo(() => {
    if (preset === "custom" && range?.from) {
      return { from: startOfDay(range.from), to: endOfDay(range.to ?? range.from) };
    }
    const days = preset === "7" ? 6 : preset === "30" ? 29 : 364;
    return { from: startOfDay(subDays(new Date(), days)), to: endOfDay(new Date()) };
  }, [preset, range]);

  // Ordens operacionais (por data de criação) — para volume/categoria/partner
  const rangeOrders = useMemo(() => {
    const f = from.getTime(); const t = to.getTime();
    return orders.filter((o) => {
      if (o.status === "cancelled") return false;
      const d = new Date(o.createdAt).getTime();
      return d >= f && d <= t;
    });
  }, [orders, from, to]);

  // Ordens PAGAS (particular) — para receita e forma de pagamento (usa data financeira)
  const paidOrders = useMemo(() => {
    const f = from.getTime(); const t = to.getTime();
    return orders.filter((o) => {
      if (!isOrderPaid(o) || o.orderSource === "partner") return false;
      const d = orderFinancialDate(o);
      if (!d) return false;
      const ts = new Date(d).getTime();
      return ts >= f && ts <= t;
    });
  }, [orders, from, to]);

  const rangeExpenses = useMemo(() => {
    const fStr = format(from, "yyyy-MM-dd");
    const tStr = format(to, "yyyy-MM-dd");
    return expenses.filter((e) => e.active && e.expenseDate >= fStr && e.expenseDate <= tStr);
  }, [expenses, from, to]);

  const revenue = paidOrders.reduce((a, o) => a + o.total, 0);
  const discounts = paidOrders.reduce((a, o) => a + o.discount + o.loyaltyDiscount, 0);
  const totalExpenses = rangeExpenses.reduce((a, e) => a + e.amount, 0);
  const netResult = revenue - totalExpenses;
  const expenseRatio = revenue > 0 ? (totalExpenses / revenue) * 100 : totalExpenses > 0 ? 100 : 0;
  const gaugeFill = Math.min(100, Math.max(0, expenseRatio));
  const noRevenueWithExpenses = revenue === 0 && totalExpenses > 0;
  const limitExceeded = noRevenueWithExpenses || expenseRatio > 100;



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
    const seen = new Set<string>();
    const rows: { label: string; qty: number; total: number }[] = [];
    rangeOrders.forEach((o) => {
      const key = o.service;
      if (!seen.has(key)) { seen.add(key); rows.push({ label: key, qty: 0, total: 0 }); }
    });
    services.forEach((s) => {
      if (!seen.has(s.key)) { seen.add(s.key); rows.push({ label: s.key, qty: 0, total: 0 }); }
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

  // Expenses breakdowns
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    EXPENSE_CATEGORIES.forEach((c) => map.set(c, 0));
    rangeExpenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return Array.from(map.entries()).map(([label, total]) => ({ label, total }));
  }, [rangeExpenses]);

  const expenseByPayment = useMemo(() => {
    const map = new Map<string, number>();
    EXPENSE_PAYMENTS.forEach((p) => map.set(p, 0));
    rangeExpenses.forEach((e) => {
      const k = e.paymentMethod || "Outros";
      map.set(k, (map.get(k) ?? 0) + e.amount);
    });
    return Array.from(map.entries()).map(([label, total]) => ({ label, total }));
  }, [rangeExpenses]);

  const expenseDonut = useMemo(
    () => expenseByCategory.filter((e) => e.total > 0),
    [expenseByCategory],
  );

  const expenseTimeSeries = useMemo(() => {
    const days = eachDayOfInterval({ start: from, end: to });
    const map = new Map<string, { label: string; total: number }>();
    days.forEach((d) => {
      const k = format(d, "yyyy-MM-dd");
      map.set(k, { label: format(d, days.length > 60 ? "MMM/yy" : "dd/MM", { locale: ptBR }), total: 0 });
    });
    rangeExpenses.forEach((e) => {
      const row = map.get(e.expenseDate);
      if (row) row.total += e.amount;
    });
    return Array.from(map.values());
  }, [rangeExpenses, from, to]);

  const rangeLabel = `${format(from, "dd/MM/yyyy")} — ${format(to, "dd/MM/yyyy")}`;

  return (
    <AppShell>
      <header className="glass-chrome px-6 py-4 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(["7", "30", "365"] as Preset[]).map((p) => (
            <Button key={p} size="sm" variant={preset === p ? "default" : "outline"}
              onClick={() => setPreset(p)}
              className={cn(preset === p && "bg-primary text-primary-foreground border-0")}>
              {p === "7" ? "Últimos 7 dias" : p === "30" ? "Últimos 30 dias" : "Últimos 365 dias"}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={preset === "custom" ? "default" : "outline"}
                className={cn("gap-2", preset === "custom" && "bg-primary text-primary-foreground border-0")}>
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

      <div className="p-4 md:p-6 bg-surface-sunken flex-1 overflow-auto space-y-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Stat label="Receita bruta" value={brl(revenue)} highlight />
          <Stat label="Despesas" value={brl(totalExpenses)} />
          <Stat label="Resultado líquido" value={brl(netResult)} accent={netResult >= 0} />
          <Stat label="Ticket médio" value={brl(rangeOrders.length ? revenue / rangeOrders.length : 0)} />
          <Stat label="Vendas" value={String(rangeOrders.length)} />
          <Stat label="Descontos" value={brl(discounts)} />
          <Stat label="Clientes atendidos no período" value={String(attendedInPeriod)} />
          <Stat label="Clientes cadastrados no período" value={String(registeredInPeriod)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="surface-card border-0 shadow-none p-5">
            <h3 className="text-sm font-semibold mb-4">Faturamento por forma de pagamento</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paymentSeries} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <RTooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Pix" name="Pix" fill={PAYMENT_COLORS.Pix} barSize={3} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Débito" name="Débito" stroke={PAYMENT_COLORS["Débito"]}
                    strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="Crédito" name="Crédito" stroke={PAYMENT_COLORS["Crédito"]}
                    strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {PAYMENTS.map((p) => (
                <Row key={p} label={p} value={brl(byPaymentTotal[p])} />
              ))}
            </div>
          </Card>

          <Card className="surface-card border-0 shadow-none p-5">
            <h3 className="text-sm font-semibold mb-4">Faturamento por serviço</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="serviceBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <RTooltip
                    cursor={{ fill: "#ffffff", fillOpacity: 0.05 }}
                    formatter={(v: number, name) => name === "total" ? brl(v) : String(v)}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="total" name="Faturamento" fill="url(#serviceBarGradient)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {serviceData.map((s) => (
                <Row key={s.label} label={`${s.label} (${s.qty})`} value={brl(s.total)} />
              ))}
            </div>
          </Card>
        </div>

        <Card className="surface-card border-0 shadow-none p-5">
          <h3 className="text-sm font-semibold mb-4">Por categoria de veículo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
            {categoryStats.map((c) => (
              <div key={c.label as string} className="rounded-card bg-surface-3 p-4">
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

        {/* ============ DESPESAS DA LOJA ============ */}
        <div className="pt-2">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-semibold">Despesas da Loja</h2>
            <div className="text-xs text-muted-foreground">{rangeLabel}</div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat label="Total de despesas" value={brl(totalExpenses)} />
            <Stat label="Lançamentos" value={String(rangeExpenses.length)} />
            <Stat label="Ticket médio" value={brl(rangeExpenses.length ? totalExpenses / rangeExpenses.length : 0)} />
            <Stat label="Saldo (receita − despesas)" value={brl(netResult)} accent={netResult >= 0} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-2 items-stretch">
            <Card className="surface-card border-0 shadow-none p-5">
              <h3 className="text-sm font-semibold mb-4">Despesas por categoria</h3>
              {expenseDonut.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                  Nenhuma despesa registrada no período selecionado.
                </div>
              ) : (
                <div className="h-72 flex flex-col sm:flex-row items-center gap-4">
                  <div className="h-40 sm:h-full w-full sm:w-1/2 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RTooltip
                          formatter={(v: number, name) => [brl(v), String(name)]}
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        />
                        <Pie
                          data={expenseDonut}
                          dataKey="total"
                          nameKey="label"
                          innerRadius="60%"
                          outerRadius="84%"
                          paddingAngle={2}
                          stroke="none"
                          isAnimationActive={false}
                labelLine={false}
                          label={false}
                        >
                          {expenseDonut.map((e, i) => (
                            <Cell key={e.label} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full sm:w-1/2 min-w-0 space-y-2 overflow-auto">
                    {expenseDonut.map((e, i) => (
                      <div key={e.label} className="flex items-center gap-2 text-sm min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="truncate text-muted-foreground">{e.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="surface-card border-0 shadow-none p-5">
              <h3 className="text-sm font-semibold mb-4">Despesa vs receita</h3>
              <div className="h-72 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-[260px]">
                  <svg viewBox="0 0 200 110" className="w-full">
                    <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none"
                      stroke="hsl(var(--surface-4))" strokeWidth={14} strokeLinecap="round" />
                    <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none"
                      stroke="hsl(var(--primary))" strokeWidth={14} strokeLinecap="round"
                      pathLength={100} strokeDasharray={`${gaugeFill} 100`} />
                  </svg>
                  <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Receita bruta</div>
                    <div className="text-xl font-bold tabular-nums">{brl(revenue)}</div>
                  </div>
                </div>
                <div className="mt-4 text-center space-y-1">
                  <div className="text-xs text-muted-foreground">{`Despesas: ${brl(totalExpenses)}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {noRevenueWithExpenses ? "Sem receita no período" : `${expenseRatio.toFixed(1)}% da receita`}
                  </div>
                  {limitExceeded && (
                    <div className="text-xs font-medium text-destructive">Limite excedido</div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="surface-card border-0 shadow-none p-5">
              <h3 className="text-sm font-semibold mb-4">Despesas ao longo do tempo</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={expenseTimeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <RTooltip
                      formatter={(v: number) => brl(v)}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="total" name="Despesas"
                      stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#expenseAreaGradient)"
                      dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="surface-card border-0 shadow-none p-5 mt-2">
            <h3 className="text-sm font-semibold mb-4">Despesas por forma de pagamento</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {expenseByPayment.map((e) => (
                <div key={e.label} className="rounded-card bg-surface-3 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{e.label}</div>
                  <div className="mt-1 text-lg font-bold text-primary">{brl(e.total)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="surface-card border-0 shadow-none p-5 mt-2">
            <h3 className="text-sm font-semibold mb-4">Lançamentos no período</h3>
            {rangeExpenses.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma despesa registrada no período selecionado.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rangeExpenses.map((e) => (
                  <div key={e.id} className="py-3 flex items-center gap-3">
                    <div className="w-24 text-xs text-muted-foreground">
                      {new Date(e.expenseDate + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      {e.notes && <div className="text-xs text-muted-foreground truncate">{e.notes}</div>}
                    </div>
                    <Badge variant="outline" className="text-xs">{e.category}</Badge>
                    {e.paymentMethod && <Badge variant="outline" className="text-xs">{e.paymentMethod}</Badge>}
                    <div className="w-28 text-right font-semibold text-destructive">−{brl(e.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ============ PARCEIROS ============ */}
        <div className="pt-2">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-semibold">Parceiros</h2>
            <div className="text-xs text-muted-foreground">Atendimentos no período · uso do contrato no mês corrente</div>
          </div>

          {partnerContracts.length === 0 ? (
            <Card className="surface-card border-0 shadow-none p-6 text-sm text-muted-foreground text-center">
              Nenhum contrato de parceiro cadastrado.
            </Card>
          ) : (() => {
            const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
            const partnerOrdersRange = orders.filter((o) => o.orderSource === "partner" && o.status !== "cancelled"
              && new Date(o.createdAt) >= from && new Date(o.createdAt) <= to);
            const totalPartnerAttendances = partnerOrdersRange.length;
            const totalContractValue = partnerContracts.filter((c) => c.active).reduce((a, c) => a + c.contractValue, 0);
            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <Stat label="Atendimentos (período)" value={String(totalPartnerAttendances)} />
                  <Stat label="Contratos ativos" value={String(partnerContracts.filter((c) => c.active).length)} />
                  <Stat label="Valor mensal contratado" value={brl(totalContractValue)} accent />
                  <Stat label="Contratos totais" value={String(partnerContracts.length)} />
                </div>

                <Card className="surface-card border-0 shadow-none p-5 mt-2">
                  <h3 className="text-sm font-semibold mb-4">Uso por contrato</h3>
                  <div className="divide-y divide-border">
                    {partnerContracts.map((c) => {
                      const monthUsage = orders.filter((o) => o.partnerContractId === c.id
                        && o.status !== "cancelled" && new Date(o.createdAt) >= monthStart).length;
                      const periodUsage = partnerOrdersRange.filter((o) => o.partnerContractId === c.id).length;
                      const pct = c.monthlyVehicleLimit > 0 ? Math.min(100, (monthUsage / c.monthlyVehicleLimit) * 100) : 0;
                      return (
                        <div key={c.id} className="py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c.companyName}</div>
                            <div className="text-xs text-muted-foreground">
                              {periodUsage} no período · {monthUsage}/{c.monthlyVehicleLimit} este mês
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold text-primary">{brl(c.contractValue)}</div>
                            <Badge variant={c.active ? "outline" : "secondary"} className="text-[10px] mt-1">
                              {c.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            );
          })()}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, accent, highlight }: { label: string; value: string; accent?: boolean; highlight?: boolean }) {
  if (highlight) {
    return (
      <Card className="surface-card border-0 shadow-none p-4 bg-primary text-primary-foreground">
        <div className="text-[11px] uppercase tracking-[0.14em] text-primary-foreground/80 font-medium">{label}</div>
        <div className="text-2xl font-bold text-primary-foreground tabular-nums">{value}</div>
      </Card>
    );
  }
  return (
    <Card className="surface-card border-0 shadow-none p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${accent ? "gold-text" : ""}`}>{value}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-card bg-surface-3 text-sm">
      <span className="truncate">{label}</span>
      <span className="font-semibold text-primary shrink-0">{value}</span>
    </div>
  );
}
