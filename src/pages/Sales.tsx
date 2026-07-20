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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock, Car, Sparkles, Trophy, CheckCircle2, Trash2, ChevronRight, BadgePercent,
  MessageCircle, Building2, User, Plus, X, Receipt,
} from "lucide-react";
import {
  EXTRA_KEYS, ExtraKey, ServiceKey, VEHICLE_CATEGORIES, VehicleCategory, Customer, Vehicle,
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
import { createPartnerOrderRpc, formatCnpj } from "@/services/partners";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "customer" | "partner";

function parseMoney(v: string): number {
  const digits = (v || "").replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}
function formatMoneyInput(v: string): string {
  return brl(parseMoney(v));
}

export default function Sales() {
  const { orders, services, prices, partnerContracts, findCustomerByCpf, findVehicleByPlate } = useData();

  const [mode, setMode] = useState<Mode>("customer");

  const [category, setCategory] = useState<VehicleCategory | null>(null);
  const [service, setService] = useState<ServiceKey | null>(null);
  const [extras, setExtras] = useState<ExtraKey[]>([]);

  // customer fields
  const [cpf, setCpf] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);

  // vehicle fields (customer OR partner one-off)
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [year, setYear] = useState("");
  const [existingVehicle, setExistingVehicle] = useState<Vehicle | null>(null);

  // partner
  const [contractId, setContractId] = useState<string>("");

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [feeOpen, setFeeOpen] = useState(false);
  const [feeStr, setFeeStr] = useState("");
  const [feeNote, setFeeNote] = useState("");

  const activeServices = useMemo(
    () => [...services].filter((s) => s.active).sort((a, b) => a.order - b.order)
      .map((o) => ({ override: o, def: getServiceDef(o.key) })),
    [services]
  );

  const activeContracts = useMemo(
    () => partnerContracts.filter((c) => c.active).sort((a,b) => a.companyName.localeCompare(b.companyName)),
    [partnerContracts]
  );
  const selectedContract = useMemo(
    () => activeContracts.find((c) => c.id === contractId) ?? null,
    [activeContracts, contractId]
  );

  // Contador de utilização mensal do contrato (a partir das ordens em memória)
  const contractUsage = useMemo(() => {
    if (!selectedContract) return { used: 0, limit: 0 };
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const used = orders.filter((o) =>
      o.partnerContractId === selectedContract.id &&
      o.status !== "cancelled" &&
      o.createdAt.slice(0, 7) === monthPrefix
    ).length;
    return { used, limit: selectedContract.monthlyVehicleLimit };
  }, [selectedContract, orders]);

  useEffect(() => {
    if (mode !== "customer") return;
    if (normalizeCpf(cpf).length === 11) {
      const found = findCustomerByCpf(cpf);
      if (found) {
        setExistingCustomer(found);
        setName(found.name); setPhone(found.phone);
      } else setExistingCustomer(null);
    } else setExistingCustomer(null);
  }, [cpf, findCustomerByCpf, mode]);

  useEffect(() => {
    if (mode !== "customer") return;
    if (normalizePlate(plate).length >= 7) {
      const v = findVehicleByPlate(plate);
      if (v) {
        setExistingVehicle(v);
        setBrand(v.brand); setModel(v.model);
        setColor(v.color); setYear(v.year);
        setCategory(v.category);
      } else setExistingVehicle(null);
    } else setExistingVehicle(null);
  }, [plate, findVehicleByPlate, mode]);

  const loyalty = useMemo(
    () => mode === "customer" ? getLoyaltyForVehicle(existingVehicle) : getLoyaltyForVehicle(null),
    [existingVehicle, mode]
  );

  const totals = useMemo(
    () => calcTotals(prices, category, service, extras, 0, loyalty),
    [prices, category, service, extras, loyalty]
  );
  const serviceFee = feeOpen ? parseMoney(feeStr) : 0;
  const previewTotal = useMemo(
    () => Math.max(0, totals.total + serviceFee),
    [totals.total, serviceFee]
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
    setNotes(""); setContractId("");
  };

  const fillFromMatch = (m: { customer: Customer; vehicles: Vehicle[]; matchedPlate?: string; }) => {
    const c = m.customer;
    setExistingCustomer(c);
    setCpf(c.cpf); setName(c.name); setPhone(c.phone);
    const pick = m.matchedPlate ? m.vehicles.find((v) => v.plate === m.matchedPlate) : m.vehicles[0];
    if (pick) {
      setExistingVehicle(pick); setPlate(pick.plate);
      setBrand(pick.brand); setModel(pick.model);
      setColor(pick.color); setYear(pick.year);
      setCategory(pick.category);
    }
    toast.success(`Cliente carregado: ${c.name}`);
  };

  const contractLimitReached = mode === "partner" && selectedContract
    ? contractUsage.used >= contractUsage.limit : false;

  const canSubmit =
    !!category && !!service && !submitting &&
    normalizePlate(plate).length >= 7 &&
    (mode === "partner"
      ? !!selectedContract && !contractLimitReached
      : normalizeCpf(cpf).length === 11 && name.trim().length >= 2 &&
        (phone || "").replace(/\D/g, "").length >= 10);

  const handleSubmit = async () => {
    if (!canSubmit || !category || !service) {
      toast.error("Complete os dados necessários para iniciar a triagem.");
      return;
    }
    const serviceRow = services.find((s) => s.key === service);
    if (!serviceRow?.id) { toast.error("Serviço não encontrado."); return; }
    setSubmitting(true);
    try {
      if (mode === "partner" && selectedContract) {
        await createPartnerOrderRpc({
          partnerContractId: selectedContract.id,
          plate: normalizePlate(plate),
          brand: toTitleCase(brand), model: toTitleCase(model),
          color: toUpperCase(color), year: year,
          category, serviceId: serviceRow.id, serviceKey: service,
          extras, subtotal: totals.subtotal, notes,
          queuePosition: queueCount + 1, durationMinutes: duration,
        });
        toast.success("Triagem iniciada", {
          description: `Veículo ${formatPlate(plate)} adicionado à fila (parceiro).`,
        });
      } else {
        const cust = await upsertCustomer({
          id: existingCustomer?.id,
          name: name.trim(), cpf, phone,
        });
        const veh = await upsertVehicle({
          id: existingVehicle?.id,
          customerId: cust.id,
          plate, brand, model, color, year, category,
        });
        const vehicleLabel = [veh.brand, veh.model, veh.color].filter(Boolean).join(" ");
        await createOrder({
          customerId: cust.id, customerName: cust.name,
          vehicleId: veh.id, vehiclePlate: formatPlate(veh.plate),
          vehicleLabel, category,
          serviceId: serviceRow.id, serviceKey: service, extras,
          subtotal: totals.subtotal,
          loyaltyDiscount: totals.loyaltyDiscount,
          loyaltyRewardUsed: totals.loyaltyDiscount > 0,
          notes, queuePosition: queueCount + 1, durationMinutes: duration,
        });
        toast.success("Triagem iniciada", {
          description: `Veículo ${formatPlate(veh.plate)} adicionado à fila.`,
        });
      }
      clearAll();
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("contract_limit_reached")) toast.error("Limite mensal do contrato atingido.");
      else if (msg.includes("contract_inactive")) toast.error("Contrato inativo.");
      else toast.error(msg || "Erro ao iniciar triagem");
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
          <p className="text-xs text-muted-foreground">Iniciar triagem · pagamento na retirada</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatChip icon={<Clock className="h-4 w-4" />} label="Espera estimada" value={formatDuration(newWait)} />
          <StatChip icon={<Car className="h-4 w-4" />} label="Veículos na fila" value={String(queueCount)} />
          <QueueDrawer orders={orders} contracts={partnerContracts} />
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

          <Panel
            title={mode === "customer" ? "Cliente" : "Parceiro"}
            right={
              <div className="flex items-center gap-2">
                <Button size="sm" variant={mode === "customer" ? "default" : "outline"}
                  className={cn("h-8", mode === "customer" && "bg-gradient-gold text-primary-foreground border-0")}
                  onClick={() => { setMode("customer"); setContractId(""); }}>
                  <User className="h-3.5 w-3.5 mr-1" /> Cliente
                </Button>
                <Button size="sm" variant={mode === "partner" ? "default" : "outline"}
                  className={cn("h-8", mode === "partner" && "bg-gradient-gold text-primary-foreground border-0")}
                  onClick={() => { setMode("partner"); setCpf(""); setName(""); setPhone(""); setExistingCustomer(null); }}>
                  <Building2 className="h-3.5 w-3.5 mr-1" /> Parceiro
                </Button>
              </div>
            }>
            {mode === "customer" ? (
              <div className="space-y-3">
                <div className="mb-2"><CustomerLiveSearch onSelect={fillFromMatch} placeholder="Buscar cliente…" /></div>
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
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs text-muted-foreground">
                    Cliente já cadastrado. Fidelidade vinculada à <span className="text-primary font-medium">placa do veículo</span>.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Contrato ativo *">
                  <Select value={contractId} onValueChange={setContractId}>
                    <SelectTrigger><SelectValue placeholder={activeContracts.length ? "Selecione o contrato" : "Nenhum contrato ativo"} /></SelectTrigger>
                    <SelectContent>
                      {activeContracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName} · {formatCnpj(c.cnpj)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {selectedContract && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Empresa</span><span className="font-medium">{selectedContract.companyName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">CNPJ</span><span className="font-mono">{formatCnpj(selectedContract.cnpj)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Contato</span><span>{selectedContract.contactPhone || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor contratado</span><span>{brl(selectedContract.contractValue)}</span></div>
                    <div className="pt-1 border-t border-border">
                      <div className="flex justify-between mb-1"><span className="text-muted-foreground">Utilização mensal</span><span><strong>{contractUsage.used}</strong>/{contractUsage.limit} veículos</span></div>
                      <Progress value={contractUsage.limit ? (contractUsage.used / contractUsage.limit) * 100 : 0} className="h-2" />
                      <div className="text-[11px] mt-1 text-muted-foreground">
                        {contractLimitReached
                          ? <span className="text-destructive">Limite mensal atingido. Não é possível adicionar outro veículo neste mês.</span>
                          : <>Faltam <span className="text-primary font-medium">{Math.max(0, contractUsage.limit - contractUsage.used)}</span> carros.</>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </section>

        <section className="lg:col-span-4 space-y-4">
          <Panel title="Veículo">
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

              {mode === "customer" && (
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
                    <div className="text-xs text-muted-foreground">Informe a placa para ver o status.</div>
                  )}
                  {!existingVehicle && normalizePlate(plate).length >= 7 && (
                    <div className="text-xs text-muted-foreground">Placa nova — 1ª lavagem do ciclo.</div>
                  )}
                  {existingVehicle && loyalty.rewardAvailable && (
                    <div className="text-xs text-primary flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Benefício disponível — consolidado no pagamento.
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
              )}
            </div>
          </Panel>

          <Panel title="Observações do Atendente">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do atendimento, instruções específicas, condição do veículo..."
              className="min-h-[100px] resize-none" />
          </Panel>
        </section>
      </div>

      <footer className="border-t border-border bg-gradient-surface px-6 py-4 sticky bottom-0 z-20">
        <div className="grid lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Resumo (prévia)</div>
            <div className="mt-1 text-xs text-muted-foreground flex flex-col justify-end min-h-10">
              <span>Subtotal: <span className="text-foreground">{brl(totals.subtotal)}</span></span>
              {totals.loyaltyDiscount > 0 && (
                <span className="text-primary flex items-center gap-1">
                  <BadgePercent className="h-3 w-3" /> Fidelidade prevista: −{brl(totals.loyaltyDiscount)}
                </span>
              )}
              <span className="text-[11px]">Desconto manual é aplicado apenas na retirada.</span>
            </div>
          </div>
          <div className="lg:col-span-3 flex flex-col items-end">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total previsto</div>
            <div className="text-2xl font-bold gold-text leading-tight">{brl(totals.total)}</div>
          </div>
          <div className="lg:col-span-5 flex gap-2 justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive/50">
                  <Trash2 className="h-4 w-4" /> Limpar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar formulário?</AlertDialogTitle>
                  <AlertDialogDescription>Todas as informações desta triagem serão descartadas.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll} className="bg-destructive hover:bg-destructive/90">Sim, limpar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={handleSubmit} disabled={!canSubmit}
              className="h-10 gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold transition-all active:scale-[0.98]">
              <Car className="h-4 w-4" />
              {submitting ? "Iniciando…" : "Iniciar Triagem"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}

function Panel({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5 transition-shadow hover:shadow-elegant">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-lg font-normal text-foreground">{title}</div>
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
