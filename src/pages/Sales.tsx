import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QueueDrawer } from "@/components/QueueDrawer";
import { CustomerLiveSearch } from "@/components/CustomerLiveSearch";
import { ServiceIcon } from "@/components/ServiceIcon";
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
  Trash2, Tag, ChevronRight, BadgePercent, MessageCircle,
} from "lucide-react";
import {
  EXTRA_KEYS, ExtraKey, ServiceKey,
  VEHICLE_CATEGORIES, VehicleCategory, PaymentMethod, Customer, Vehicle,
} from "@/lib/domain";
import {
  brl, formatCpf, formatDuration, formatPhone, formatPlate,
  normalizeCpf, normalizePlate, toTitleCase, toUpperCase,
} from "@/lib/storage";
import {
  calcDuration, calcTotals, estimatedNewWait, getLoyaltyForVehicle, getServiceDef,
} from "@/lib/pricing";
import { useData } from "@/lib/DataContext";
import { upsertCustomer, upsertVehicle, createOrder } from "@/services/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENTS: PaymentMethod[] = ["Crédito", "Débito", "Pix"];

export default function Sales() {
  const { orders, services, prices, findCustomerByCpf, findVehicleByPlate } = useData();

  const [category, setCategory] = useState<VehicleCategory | null>(null);
  const [service, setService] = useState<ServiceKey | null>(null);
  const [extras, setExtras] = useState<ExtraKey[]>([]);

  const [cpf, setCpf] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);

  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [year, setYear] = useState("");
  const [existingVehicle, setExistingVehicle] = useState<Vehicle | null>(null);

  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeServices = useMemo(
    () => [...services].filter((s) => s.active).sort((a, b) => a.order - b.order)
      .map((o) => ({ override: o, def: getServiceDef(o.key) })),
    [services]
  );

  useEffect(() => {
    if (normalizeCpf(cpf).length === 11) {
      const found = findCustomerByCpf(cpf);
      if (found) {
        setExistingCustomer(found);
        setName(found.name);
        setPhone(found.phone);
      } else {
        setExistingCustomer(null);
      }
    } else {
      setExistingCustomer(null);
    }
  }, [cpf, findCustomerByCpf]);

  useEffect(() => {
    if (normalizePlate(plate).length >= 7) {
      const v = findVehicleByPlate(plate);
      if (v) {
        setExistingVehicle(v);
        setBrand(v.brand); setModel(v.model);
        setColor(v.color); setYear(v.year);
        setCategory(v.category);
      } else {
        setExistingVehicle(null);
      }
    } else {
      setExistingVehicle(null);
    }
  }, [plate, findVehicleByPlate]);

  const loyalty = useMemo(() => getLoyaltyForVehicle(existingVehicle), [existingVehicle]);

  const totals = useMemo(
    () => calcTotals(prices, category, service, extras, discount, loyalty),
    [prices, category, service, extras, discount, loyalty]
  );

  const duration = useMemo(() => calcDuration(service, extras), [service, extras]);
  const newWait = useMemo(() => estimatedNewWait(orders), [orders]);
  const queueCount = orders.filter((o) => o.status === "queued" || o.status === "in_progress").length;

  const selectedServiceDef = service ? getServiceDef(service) : null;
  const selectedOverride = service ? services.find((o) => o.key === service) : null;

  const toggleExtra = (k: ExtraKey) =>
    setExtras((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const clearAll = () => {
    setCategory(null); setService(null); setExtras([]);
    setCpf(""); setName(""); setPhone(""); setExistingCustomer(null);
    setPlate(""); setBrand(""); setModel(""); setColor(""); setYear(""); setExistingVehicle(null);
    setNotes(""); setDiscount(0); setPayment(null);
  };

  const fillFromMatch = (m: {
    customer: Customer; vehicles: Vehicle[]; matchedPlate?: string;
  }) => {
    const c = m.customer;
    setExistingCustomer(c);
    setCpf(c.cpf); setName(c.name); setPhone(c.phone);
    const pick = m.matchedPlate
      ? m.vehicles.find((v) => v.plate === m.matchedPlate)
      : m.vehicles[0];
    if (pick) {
      setExistingVehicle(pick);
      setPlate(pick.plate);
      setBrand(pick.brand); setModel(pick.model);
      setColor(pick.color); setYear(pick.year);
      setCategory(pick.category);
    }
    toast.success(`Cliente carregado: ${c.name}`);
  };

  const canSubmit =
    !!category && !!service && !!payment && !submitting &&
    normalizeCpf(cpf).length === 11 && name.trim().length >= 2 &&
    (phone || "").replace(/\D/g, "").length >= 10 &&
    normalizePlate(plate).length >= 7;

  const handleSubmit = async () => {
    if (!canSubmit || !category || !service || !payment) {
      toast.error("Preencha categoria, serviço, cliente (CPF, nome, WhatsApp), placa e pagamento.");
      return;
    }
    const serviceRow = services.find((s) => s.key === service);
    if (!serviceRow?.id) { toast.error("Serviço não encontrado no banco."); return; }
    setSubmitting(true);
    try {
      const cust = await upsertCustomer({
        id: existingCustomer?.id,
        name: name.trim(),
        cpf, phone,
      });
      const veh = await upsertVehicle({
        id: existingVehicle?.id,
        customerId: cust.id,
        plate, brand, model, color, year, category,
      });
      const vehicleLabel = [veh.brand, veh.model, veh.color].filter(Boolean).join(" ");
      await createOrder({
        customerId: cust.id,
        customerName: cust.name,
        vehicleId: veh.id,
        vehiclePlate: formatPlate(veh.plate),
        vehicleLabel,
        category,
        serviceId: serviceRow.id,
        serviceKey: service,
        extras,
        subtotal: totals.subtotal,
        discount: totals.manualDiscount,
        loyaltyDiscount: totals.loyaltyDiscount,
        loyaltyRewardUsed: totals.loyaltyDiscount > 0,
        total: totals.total,
        paymentMethod: payment,
        notes,
        queuePosition: queueCount + 1,
        durationMinutes: duration,
      });
      toast.success(`Pagamento confirmado — ${brl(totals.total)}`, {
        description: `Veículo ${formatPlate(veh.plate)} entrou na fila.`,
      });
      clearAll();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
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
          <QueueDrawer orders={orders} />
        </div>
      </header>

      <div className="flex-1 p-6 grid gap-6 lg:grid-cols-12 bg-surface-sunken overflow-auto">
        <section className="lg:col-span-4 space-y-4">
          <Panel title="Categoria do Veículo" subtitle="Selecione antes do serviço">
            <div className="grid grid-cols-3 gap-2">
              {VEHICLE_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-3 rounded-lg border text-sm font-medium transition-all active:scale-[0.98]",
                    category === c
                      ? "border-primary bg-primary/15 text-primary shadow-glow"
                      : "border-border bg-muted/30 text-foreground hover:border-primary/40 hover:bg-muted/50"
                  )}>{c}</button>
              ))}
            </div>
          </Panel>

          <Panel title="Serviços" subtitle={category ? `Preços para ${category}` : "Selecione a categoria"}>
            <div className="space-y-2">
              {activeServices.map(({ override, def }) => {
                const price = category ? prices[category][override.key] : null;
                const active = service === override.key;
                return (
                  <button key={override.key} onClick={() => setService(override.key)} disabled={!category}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 active:scale-[0.99]",
                      active ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
                      !category && "opacity-50 cursor-not-allowed"
                    )}>
                    <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0 transition-all",
                      active ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                      <ServiceIcon iconKey={override.icon} serviceKey={override.key} className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{override.name ?? def.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" /> {formatDuration(override.durationMinutes ?? def.durationMinutes)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">{price !== null ? brl(price) : "—"}</div>
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
                    <button key={k} onClick={() => toggleExtra(k)} disabled={!category}
                      className={cn(
                        "p-2.5 rounded-lg border text-xs transition-all active:scale-[0.98]",
                        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/20 hover:border-primary/40",
                        !category && "opacity-50 cursor-not-allowed"
                      )}>
                      <div className="font-medium">{k}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{price !== null ? brl(price) : "—"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>
        </section>

        <section className="lg:col-span-4 space-y-4">
          <Panel title="Detalhes do Serviço">
            {selectedServiceDef ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
                      <ServiceIcon iconKey={selectedOverride?.icon} serviceKey={selectedServiceDef.key} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">{selectedOverride?.name ?? selectedServiceDef.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedOverride?.description ?? selectedServiceDef.description}</div>
                    </div>
                  </div>
                  <Badge className="bg-gradient-gold text-primary-foreground border-0 shrink-0">
                    {category ? brl(prices[category][selectedServiceDef.key]) : "—"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Duração base {formatDuration(selectedOverride?.durationMinutes ?? selectedServiceDef.durationMinutes)}
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

          <Panel title="Cliente" icon={<User className="h-4 w-4" />}
            right={<div className="w-64"><CustomerLiveSearch onSelect={fillFromMatch} placeholder="Buscar cliente…" /></div>}>
            <div className="space-y-3">
              <Field label="CPF *">
                <Input value={formatCpf(cpf)} onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00" inputMode="numeric" className="font-mono" />
              </Field>
              <Field label="Nome completo *">
                <Input value={name} onChange={(e) => setName(toTitleCase(e.target.value))} placeholder="Nome do cliente" />
              </Field>
              <Field label="WhatsApp *">
                <div className="relative">
                  <MessageCircle className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                  <Input value={formatPhone(phone)} onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000" inputMode="numeric" className="pl-9" />
                </div>
              </Field>
              {existingCustomer && (
                <div className="mt-3 p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs text-muted-foreground">
                  Cliente já cadastrado. A fidelidade é vinculada à <span className="text-primary font-medium">placa do veículo</span>.
                </div>
              )}
            </div>
          </Panel>
        </section>

        <section className="lg:col-span-4 space-y-4">
          <Panel title="Veículo" icon={<Car className="h-4 w-4" />}>
            <div className="space-y-3">
              <Field label="Placa *">
                <Input value={formatPlate(plate)} onChange={(e) => setPlate(e.target.value)}
                  placeholder="ABC-1D23" className="font-mono uppercase tracking-wider" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca"><Input value={brand} onChange={(e) => setBrand(toTitleCase(e.target.value))} placeholder="Ex: Toyota" /></Field>
                <Field label="Modelo"><Input value={model} onChange={(e) => setModel(toTitleCase(e.target.value))} placeholder="Ex: Corolla" /></Field>
                <Field label="Cor"><Input value={color} onChange={(e) => setColor(toUpperCase(e.target.value))} placeholder="Ex: PRATA" className="uppercase" /></Field>
                <Field label="Ano"><Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Ex: 2022" inputMode="numeric" /></Field>
              </div>
              <Field label="Categoria detectada">
                <div className="px-3 py-2 rounded-md bg-muted/40 text-sm border border-border">
                  {category ?? <span className="text-muted-foreground">Selecione no painel à esquerda</span>}
                </div>
              </Field>

              <div className={cn(
                "mt-2 p-3 rounded-lg border transition-all",
                loyalty.rewardAvailable
                  ? "border-primary/60 bg-gradient-to-br from-primary/15 to-primary/5 shadow-glow"
                  : existingVehicle ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Trophy className={cn("h-4 w-4", existingVehicle || loyalty.rewardAvailable ? "text-primary" : "text-muted-foreground")} />
                    Fidelidade da placa
                  </div>
                  {existingVehicle && (
                    <Badge variant="outline" className="border-primary/40 text-primary font-mono">
                      {formatPlate(existingVehicle.plate)}
                    </Badge>
                  )}
                </div>
                {!existingVehicle && normalizePlate(plate).length < 7 && (
                  <div className="text-xs text-muted-foreground">Informe a placa para ver o status de fidelidade.</div>
                )}
                {!existingVehicle && normalizePlate(plate).length >= 7 && (
                  <div className="text-xs text-muted-foreground">Placa nova — esta será a 1ª lavagem do ciclo após confirmação.</div>
                )}
                {existingVehicle && loyalty.rewardAvailable && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Sparkles className="h-4 w-4" /> Benefício disponível para esta placa
                    </div>
                    {service ? (
                      <div className="text-xs text-muted-foreground">
                        {service === "Platinum"
                          ? "Platinum não recebe desconto de fidelidade — escolha outra lavagem."
                          : `Desconto sobre a lavagem ${service} (apenas a lavagem; extras à parte).`}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Selecione uma lavagem para aplicar o desconto.</div>
                    )}
                  </div>
                )}
                {existingVehicle && !loyalty.rewardAvailable && (
                  <>
                    <Progress value={(loyalty.washCount / 10) * 100} className="h-2" />
                    <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Lavagens: <span className="text-foreground font-medium">{loyalty.washCount}/10</span></span>
                      <span>Faltam {loyalty.untilReward} {loyalty.untilReward === 1 ? "lavagem" : "lavagens"}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Observações do Atendente">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do atendimento, instruções específicas, condição do veículo..."
              className="min-h-[140px] resize-none" />
          </Panel>
        </section>
      </div>

      <footer className="border-t border-border bg-gradient-surface px-6 py-4 sticky bottom-0 z-20">
        <div className="grid lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Desconto manual (R$)</Label>
            <div className="mt-1 relative">
              <Tag className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0,00" className="pl-9 h-10" />
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
          <div className="lg:col-span-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Resumo</div>
            <div className="mt-1 text-xs text-muted-foreground flex flex-col justify-end h-10">
              <span>Subtotal: <span className="text-foreground">{brl(totals.subtotal)}</span></span>
              {totals.loyaltyDiscount > 0 && (
                <span className="text-primary flex items-center gap-1">
                  <BadgePercent className="h-3 w-3" /> Fidelidade: −{brl(totals.loyaltyDiscount)}
                </span>
              )}
              <span>Desconto: <span className="text-foreground">−{brl(totals.manualDiscount)}</span></span>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col items-end">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</div>
            <div className="text-2xl font-bold gold-text leading-tight">{brl(totals.total)}</div>
          </div>
          <div className="lg:col-span-3 flex gap-2 justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive/50">
                  <Trash2 className="h-4 w-4" /> Limpar
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
            <Button onClick={handleSubmit} disabled={!canSubmit}
              className="h-10 gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold transition-all active:scale-[0.98]">
              <CreditCard className="h-4 w-4" />
              {submitting ? "Salvando…" : "Efetuar Pagamento"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}

function Panel({ title, subtitle, icon, right, children }: { title: string; subtitle?: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5 transition-shadow hover:shadow-elegant">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        {right}
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
    <div className="flex items-center gap-3 h-14 px-4 rounded-lg bg-muted/30 border border-border">
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
    <div className="text-center text-muted-foreground py-10 animate-fade-in">
      <div className="mx-auto mb-2 opacity-50">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}
