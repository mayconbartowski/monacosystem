import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QueueDrawer } from "@/components/QueueDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, Car, User, CreditCard, Sparkles, Trophy, CheckCircle2,
  Trash2, Tag, ChevronRight, Gem, BadgePercent,
} from "lucide-react";
import {
  SERVICES, EXTRAS, EXTRA_KEYS, ExtraKey, ServiceKey,
  VEHICLE_CATEGORIES, VehicleCategory, Order, PaymentMethod, Customer, Vehicle,
} from "@/lib/domain";
import {
  brl, db, formatCpf, formatDuration, formatPhone, formatPlate,
  normalizeCpf, normalizePlate, uid,
} from "@/lib/storage";
import {
  calcDuration, calcTotals, estimatedNewWait, getLoyaltyForVehicle, getServiceDef,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENTS: PaymentMethod[] = ["Crédito", "Débito", "Pix"];

export default function Sales() {
  const [orders, setOrders] = useState<Order[]>(() => db.listOrders());
  const refreshOrders = () => setOrders(db.listOrders());

  const [category, setCategory] = useState<VehicleCategory | null>(null);
  const [service, setService] = useState<ServiceKey | null>(null);
  const [extras, setExtras] = useState<ExtraKey[]>([]);

  const [cpf, setCpf] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);

  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [year, setYear] = useState("");

  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);

  const prices = useMemo(() => db.getPrices(), []);

  // auto-lookup customer
  useEffect(() => {
    if (normalizeCpf(cpf).length === 11) {
      const found = db.findCustomerByCpf(cpf);
      if (found) {
        setExistingCustomer(found);
        setName(found.name);
        setPhone(found.phone);
        setEmail(found.email || "");
        toast.success(`Cliente reconhecido: ${found.name}`);
      } else {
        setExistingCustomer(null);
      }
    } else {
      setExistingCustomer(null);
    }
  }, [cpf]);

  // auto-fill vehicle by plate
  useEffect(() => {
    if (normalizePlate(plate).length >= 7) {
      const v = db.findVehicleByPlate(plate);
      if (v) {
        setBrand(v.brand);
        setModel(v.model);
        setColor(v.color);
        setYear(v.year);
        setCategory(v.category);
        toast.success(`Veículo reconhecido: ${v.brand} ${v.model}`);
      }
    }
  }, [plate]);

  const loyalty = useMemo(
    () => (existingCustomer ? getLoyalty(existingCustomer.totalOrders) : getLoyalty(0)),
    [existingCustomer]
  );

  const totals = useMemo(
    () => calcTotals(prices, category, service, extras, discount, existingCustomer ? loyalty : null),
    [prices, category, service, extras, discount, loyalty, existingCustomer]
  );

  const duration = useMemo(() => calcDuration(service, extras), [service, extras]);
  const newWait = useMemo(() => estimatedNewWait(orders), [orders]);
  const queueCount = orders.filter((o) => o.status === "queued" || o.status === "in_progress").length;

  const selectedServiceDef = service ? getServiceDef(service) : null;

  const toggleExtra = (k: ExtraKey) =>
    setExtras((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const clearAll = () => {
    setCategory(null); setService(null); setExtras([]);
    setCpf(""); setName(""); setPhone(""); setEmail(""); setExistingCustomer(null);
    setPlate(""); setBrand(""); setModel(""); setColor(""); setYear("");
    setNotes(""); setDiscount(0); setPayment(null);
  };

  const canSubmit =
    !!category && !!service && !!payment &&
    normalizeCpf(cpf).length === 11 && name.trim().length >= 2 &&
    normalizePlate(plate).length >= 7;

  const handleSubmit = () => {
    if (!canSubmit || !category || !service || !payment) {
      toast.error("Preencha categoria, serviço, cliente (CPF + nome), placa e pagamento.");
      return;
    }
    // upsert customer
    let cust = existingCustomer;
    if (!cust) {
      cust = {
        id: uid(),
        cpf: normalizeCpf(cpf),
        name: name.trim(),
        phone: normalizeCpf(phone),
        email: email.trim() || undefined,
        totalOrders: 0,
        createdAt: new Date().toISOString(),
      };
    } else {
      cust = { ...cust, name: name.trim(), phone, email: email.trim() || undefined };
    }
    db.upsertCustomer(cust);

    // upsert vehicle
    let veh = db.findVehicleByPlate(plate);
    if (!veh) {
      veh = {
        id: uid(),
        customerId: cust.id,
        plate: normalizePlate(plate),
        brand: brand.trim(),
        model: model.trim(),
        color: color.trim(),
        year: year.trim(),
        category,
      };
    } else {
      veh = { ...veh, customerId: cust.id, brand, model, color, year, category };
    }
    db.upsertVehicle(veh);

    const vehicleLabel = [veh.brand, veh.model, veh.color].filter(Boolean).join(" ");

    const order: Order = {
      id: uid(),
      customerId: cust.id,
      customerName: cust.name,
      customerCpf: cust.cpf,
      vehicleId: veh.id,
      vehiclePlate: formatPlate(veh.plate),
      vehicleLabel,
      category,
      service,
      extras,
      subtotal: totals.subtotal,
      discount: totals.manualDiscount,
      loyaltyDiscount: totals.loyaltyDiscount,
      total: totals.total,
      paymentMethod: payment,
      notes,
      queuePosition: queueCount + 1,
      durationMinutes: duration,
      createdAt: new Date().toISOString(),
      status: "queued",
    };
    db.addOrder(order);
    toast.success(`Pagamento confirmado — ${brl(totals.total)}`, {
      description: `Veículo ${formatPlate(veh.plate)} entrou na fila (posição ${queueCount + 1}).`,
    });
    refreshOrders();
    clearAll();
  };

  return (
    <AppShell>
      {/* HEADER */}
      <header className="border-b border-border bg-gradient-surface px-6 py-4 flex items-center gap-6 sticky top-0 z-20 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Tela de <span className="gold-text">Vendas</span>
          </h1>
          <p className="text-xs text-muted-foreground">Atendimento rápido · Monaco System</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <StatChip icon={<Clock className="h-4 w-4" />} label="Espera estimada" value={formatDuration(newWait)} />
          <StatChip icon={<Car className="h-4 w-4" />} label="Veículos na fila" value={String(queueCount)} />
          <QueueDrawer orders={orders} onChanged={refreshOrders} />
        </div>
      </header>

      {/* GRID */}
      <div className="flex-1 p-6 grid gap-6 lg:grid-cols-12 bg-surface-sunken overflow-auto">
        {/* LEFT — services */}
        <section className="lg:col-span-4 space-y-4">
          <Panel title="Categoria do Veículo" subtitle="Selecione antes do serviço">
            <div className="grid grid-cols-3 gap-2">
              {VEHICLE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-3 rounded-lg border text-sm font-medium transition-all",
                    category === c
                      ? "border-primary bg-primary/15 text-primary shadow-glow"
                      : "border-border bg-muted/30 text-foreground hover:border-primary/40"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Serviços" subtitle={category ? `Preços para ${category}` : "Selecione a categoria"}>
            <div className="space-y-2">
              {SERVICES.map((s) => {
                const price = category ? prices[category][s.key] : null;
                const active = service === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setService(s.key)}
                    disabled={!category}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3",
                      active
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-muted/20 hover:border-primary/40",
                      !category && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                      active ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    )}>
                      {s.key === "Platinum" ? <Gem className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" /> {formatDuration(s.durationMinutes)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">
                        {price !== null ? brl(price) : "—"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Extras</div>
              <div className="grid grid-cols-3 gap-2">
                {EXTRA_KEYS.map((k) => {
                  const active = extras.includes(k);
                  const price = category ? prices[category][k] : null;
                  return (
                    <button
                      key={k}
                      onClick={() => toggleExtra(k)}
                      disabled={!category}
                      className={cn(
                        "p-2.5 rounded-lg border text-xs transition-all",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-muted/20 hover:border-primary/40",
                        !category && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="font-medium">{k}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {price !== null ? brl(price) : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>
        </section>

        {/* CENTER — service detail + customer */}
        <section className="lg:col-span-4 space-y-4">
          <Panel title="Detalhes do Serviço">
            {selectedServiceDef ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{selectedServiceDef.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedServiceDef.description}</div>
                  </div>
                  <Badge className="bg-gradient-gold text-primary-foreground border-0">
                    {category ? brl(prices[category][selectedServiceDef.key]) : "—"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Duração base {formatDuration(selectedServiceDef.durationMinutes)}
                  {extras.length > 0 && (
                    <> · com extras: <span className="text-primary font-medium">{formatDuration(duration)}</span></>
                  )}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {selectedServiceDef.included.map((i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground/90">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyHint icon={<Sparkles className="h-6 w-6" />} text="Selecione um serviço para ver os detalhes." />
            )}
          </Panel>

          <Panel title="Cliente" icon={<User className="h-4 w-4" />}>
            <div className="space-y-3">
              <Field label="CPF *">
                <Input
                  value={formatCpf(cpf)}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="font-mono"
                />
              </Field>
              <Field label="Nome completo *">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone">
                  <Input
                    value={formatPhone(phone)}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="opcional"
                    type="email"
                  />
                </Field>
              </div>

              {/* Loyalty */}
              <div className={cn(
                "mt-3 p-3 rounded-lg border",
                existingCustomer ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Trophy className={cn("h-4 w-4", existingCustomer ? "text-primary" : "text-muted-foreground")} />
                    Programa Monaco Fidelidade
                  </div>
                  {existingCustomer && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {loyalty.completed} compras
                    </Badge>
                  )}
                </div>
                {existingCustomer ? (
                  <>
                    <Progress value={(loyalty.inCycle / 10) * 100} className="h-2" />
                    <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                      <span>{loyalty.inCycle}/10 nesta etapa</span>
                      {loyalty.isRewardPurchase ? (
                        <span className="text-primary font-semibold flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Esta compra é a premiada!
                        </span>
                      ) : (
                        <span>{loyalty.untilReward} {loyalty.untilReward === 1 ? "compra restante" : "compras restantes"}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Informe o CPF para verificar o status de fidelidade.
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </section>

        {/* RIGHT — vehicle + notes */}
        <section className="lg:col-span-4 space-y-4">
          <Panel title="Veículo" icon={<Car className="h-4 w-4" />}>
            <div className="space-y-3">
              <Field label="Placa *">
                <Input
                  value={formatPlate(plate)}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="ABC-1D23"
                  className="font-mono uppercase tracking-wider"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca">
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Toyota" />
                </Field>
                <Field label="Modelo">
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ex: Corolla" />
                </Field>
                <Field label="Cor">
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ex: Prata" />
                </Field>
                <Field label="Ano">
                  <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ex: 2022" inputMode="numeric" />
                </Field>
              </div>
              <Field label="Categoria detectada">
                <div className="px-3 py-2 rounded-md bg-muted/40 text-sm border border-border">
                  {category ?? <span className="text-muted-foreground">Selecione no painel à esquerda</span>}
                </div>
              </Field>
            </div>
          </Panel>

          <Panel title="Observações do Atendente">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do atendimento, instruções específicas, condição do veículo..."
              className="min-h-[140px] resize-none"
            />
          </Panel>
        </section>
      </div>

      {/* BOTTOM BAR */}
      <footer className="border-t border-border bg-gradient-surface px-6 py-4 sticky bottom-0 z-20">
        <div className="grid lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-3">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Desconto manual (R$)</Label>
            <div className="mt-1 relative">
              <Tag className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0,00"
                className="pl-9"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Pagamento</Label>
            <Tabs value={payment ?? ""} onValueChange={(v) => setPayment(v as PaymentMethod)} className="mt-1">
              <TabsList className="grid grid-cols-3 w-full bg-muted/40 h-10">
                {PAYMENTS.map((p) => (
                  <TabsTrigger key={p} value={p} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    {p}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="lg:col-span-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Resumo</div>
            <div className="mt-1 text-xs text-muted-foreground flex flex-col">
              <span>Subtotal: <span className="text-foreground">{brl(totals.subtotal)}</span></span>
              {totals.loyaltyDiscount > 0 && (
                <span className="text-primary flex items-center gap-1">
                  <BadgePercent className="h-3 w-3" /> Fidelidade: −{brl(totals.loyaltyDiscount)}
                </span>
              )}
              {totals.manualDiscount > 0 && (
                <span>Desconto: <span className="text-foreground">−{brl(totals.manualDiscount)}</span></span>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 flex items-center justify-end gap-3">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</div>
              <div className="text-2xl font-bold gold-text leading-tight">{brl(totals.total)}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-3 justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive/50">
                <Trash2 className="h-4 w-4" /> Limpar / Cancelar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar venda atual?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as informações desta venda serão descartadas. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={clearAll} className="bg-destructive hover:bg-destructive/90">
                  Sim, limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="lg"
            className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold"
          >
            <CreditCard className="h-4 w-4" />
            Efetuar Pagamento
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </AppShell>
  );
}

// --- small presentational helpers ---

function Panel({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/30 border border-border">
      <span className="text-primary">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center text-muted-foreground py-10">
      <div className="mx-auto mb-2 opacity-50">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}
