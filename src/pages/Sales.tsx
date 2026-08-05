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
  const { orders, services, prices, partnerContracts, vehicles, findCustomerByCpf, findVehicleByPlate } = useData();

  const [mode, setMode] = useState<Mode>("customer");

  const [category, setCategory] = useState<VehicleCategory>("Hatch");
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
    setCategory("Hatch"); setService(null); setExtras([]);
    setCpf(""); setName(""); setPhone(""); setExistingCustomer(null);
    setPlate(""); setBrand(""); setModel(""); setColor(""); setYear(""); setExistingVehicle(null);
    setNotes(""); setContractId("");
    setFeeOpen(false); setFeeStr(""); setFeeNote("");
  };

  // ----- múltiplos veículos do mesmo cliente -----
  const customerVehicles = useMemo(
    () => existingCustomer ? vehicles.filter((v) => v.customerId === existingCustomer.id) : [],
    [vehicles, existingCustomer]
  );
  const activeVehicleIndex = existingVehicle
    ? customerVehicles.findIndex((v) => v.id === existingVehicle.id)
    : -1;

  const applyVehicle = (v: Vehicle) => {
    setExistingVehicle(v); setPlate(v.plate);
    setBrand(v.brand); setModel(v.model);
    setColor(v.color); setYear(v.year);
    setCategory(v.category);
  };

  const cycleVehicle = (dir: -1 | 1) => {
    if (customerVehicles.length === 0) return;
    const base = activeVehicleIndex >= 0 ? activeVehicleIndex : (dir === 1 ? -1 : 0);
    const next = (base + dir + customerVehicles.length) % customerVehicles.length;
    applyVehicle(customerVehicles[next]);
  };

  const startNewVehicle = () => {
    setExistingVehicle(null);
    setPlate(""); setBrand(""); setModel(""); setColor(""); setYear("");
    setCategory("Hatch");
  };

  const fillFromMatch = (m: { customer: Customer; vehicles: Vehicle[]; matchedPlate?: string; }) => {
    const c = m.customer;
    setExistingCustomer(c);
    setCpf(c.cpf); setName(c.name); setPhone(c.phone);
    const pick = m.matchedPlate ? m.vehicles.find((v) => v.plate === m.matchedPlate) : m.vehicles[0];
    if (pick) applyVehicle(pick);
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
          serviceFee,
          serviceFeeNote: feeNote,
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
      <header className="bg-surface-2 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 sticky top-0 z-20">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            Tela de <span className="gold-text">Vendas</span>
          </h1>
          <p className="text-xs text-muted-foreground">Iniciar triagem · pagamento na retirada</p>
        </div>
        <div className="w-full md:w-auto md:ml-auto grid grid-cols-3 md:flex md:items-center gap-3 min-w-0">
          <StatChip icon={<Clock className="h-5 w-5 md:h-4 md:w-4" />} label="Espera estimada" value={formatDuration(newWait)} />
          <StatChip icon={<Car className="h-5 w-5 md:h-4 md:w-4" />} label="Veículos na fila" value={String(queueCount)} />
          <QueueDrawer orders={orders} contracts={partnerContracts} />
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 grid gap-4 md:gap-5 lg:grid-cols-12 items-stretch overflow-auto">
        {/* COLUNA 1 — Categoria + Serviços unificados */}
        <section className="lg:col-span-4 flex flex-col gap-4 md:gap-5">
          <Panel title="Serviços" subtitle={`Preços para ${category}`} className="flex-1">
            <div className="flex flex-wrap gap-1.5 p-1 rounded-control bg-surface-3 mb-4">
              {VEHICLE_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={cn(
                    "flex-1 min-w-[64px] px-2 py-2 rounded-[0.5rem] text-sm font-medium transition-colors",
                    category === c
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-4"
                  )}>{c}</button>
              ))}
            </div>

            <div className="space-y-2">
              {activeServices.map(({ override, def }) => {
                const price = prices[category][override.key];
                const active = service === override.key;
                return (
                  <button key={override.key} onClick={() => setService(override.key)}
                    className={cn(
                      "w-full text-left p-3 rounded-control transition-colors flex items-center gap-3",
                      active ? "bg-primary text-primary-foreground" : "bg-surface-3 hover:bg-surface-4"
                    )}>
                    <div className={cn("h-9 w-9 rounded-[0.5rem] grid place-items-center shrink-0",
                      active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-surface-4 text-foreground")}>
                      <ServiceIcon iconKey={override.icon} serviceKey={override.key} className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{override.name ?? def.name}</div>
                      <div className={cn("text-xs flex items-center gap-2", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        <Clock className="h-3 w-3" /> {formatDuration(override.durationMinutes ?? def.durationMinutes)}
                      </div>
                    </div>
                    <div className={cn("text-sm font-bold tabular-nums", active ? "text-primary-foreground" : "text-primary")}>
                      {brl(price)}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-5">
              <div className="label-xs mb-2">Extras</div>
              <div className="grid grid-cols-3 gap-2">
                {EXTRA_KEYS.map((k) => {
                  const active = extras.includes(k);
                  const price = prices[category][k];
                  return (
                    <button key={k} onClick={() => toggleExtra(k)}
                      className={cn(
                        "p-2.5 rounded-control text-xs transition-colors",
                        active ? "bg-primary text-primary-foreground" : "bg-surface-3 hover:bg-surface-4"
                      )}>
                      <div className="font-medium">{k}</div>
                      <div className={cn("text-[11px] mt-0.5 tabular-nums", active ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        {brl(price)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>
        </section>

        {/* COLUNA 2 — Detalhes + Cliente/Parceiro */}
        <section className="lg:col-span-4 flex flex-col gap-4 md:gap-5">
          <Panel title="Detalhes do Serviço">
            {selectedServiceDef ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-control bg-surface-3 text-primary grid place-items-center shrink-0">
                      <ServiceIcon iconKey={selectedOverride?.icon} serviceKey={selectedServiceDef.key} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">{selectedOverride?.name ?? selectedServiceDef.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedOverride?.description ?? selectedServiceDef.description}</div>
                    </div>
                  </div>
                  <Badge className="bg-primary text-primary-foreground border-0 shrink-0 tabular-nums">
                    {brl(prices[category][selectedServiceDef.key])}
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
              <p className="text-sm text-muted-foreground leading-relaxed">
                Esse espaço informa o que está incluso no serviço e qual é o tempo minimo necessário. Para isso, selecione a aba correspondente ao carro do cliente e em seguida, selecione o serviço que ele deseja.
              </p>
            )}
          </Panel>

          <Panel
            className="flex-1"
            title={mode === "customer" ? "Cliente" : "Parceiro"}
            right={
              <div className="flex items-center gap-1 p-1 rounded-control bg-surface-3">
                <button
                  className={cn("h-8 px-3 rounded-[0.5rem] text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                    mode === "customer" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => { setMode("customer"); setContractId(""); }}>
                  <User className="h-3.5 w-3.5" /> Cliente
                </button>
                <button
                  className={cn("h-8 px-3 rounded-[0.5rem] text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                    mode === "partner" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => { setMode("partner"); setCpf(""); setName(""); setPhone(""); setExistingCustomer(null); }}>
                  <Building2 className="h-3.5 w-3.5" /> Parceiro
                </button>
              </div>
            }>
            {mode === "customer" ? (
              <div className="space-y-3">
                <CustomerLiveSearch onSelect={fillFromMatch} placeholder="Buscar cliente…" />
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
                {/* área estável — evita salto de layout */}
                <div className="min-h-5 text-xs">
                  {existingCustomer && (
                    <span className="text-primary">
                      Cliente já cadastrado · fidelidade vinculada à placa do veículo.
                    </span>
                  )}
                </div>
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
                  <div className="surface-inset p-3 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Empresa</span><span className="font-medium">{selectedContract.companyName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">CNPJ</span><span className="font-mono">{formatCnpj(selectedContract.cnpj)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Contato</span><span>{selectedContract.contactPhone || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor contratado</span><span>{brl(selectedContract.contractValue)}</span></div>
                    <div className="pt-2">
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

        {/* COLUNA 3 — Veículo + Observações */}
        <section className="lg:col-span-4 flex flex-col gap-4 md:gap-5">
          <Panel
            title="Veículo"
            right={
              <div className="flex items-center gap-1">
                {mode === "customer" && customerVehicles.length > 1 && (
                  <>
                    <Button type="button" variant="ghost" size="icon" aria-label="Veículo anterior"
                      className="h-9 w-9 rounded-control bg-surface-3 hover:bg-surface-4"
                      onClick={() => cycleVehicle(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Próximo veículo"
                      className="h-9 w-9 rounded-control bg-surface-3 hover:bg-surface-4"
                      onClick={() => cycleVehicle(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {mode === "customer" && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Novo veículo para este cliente"
                    className="h-9 w-9 rounded-control bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={startNewVehicle}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            }>
            <div className="space-y-3">
              {mode === "customer" && customerVehicles.length > 1 && (
                <div className="text-[11px] text-muted-foreground">
                  Veículo {activeVehicleIndex >= 0 ? activeVehicleIndex + 1 : "novo"} de {customerVehicles.length} deste cliente
                </div>
              )}
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
              <Field label="Categoria selecionada">
                <div className="px-3 py-2 rounded-control bg-surface-3 text-sm">{category}</div>
              </Field>

              {mode === "customer" && (
                <div className="surface-inset p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Trophy className={cn("h-4 w-4", loyalty.rewardAvailable ? "text-primary" : "text-muted-foreground")} />
                      Fidelidade da placa
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {existingVehicle ? formatPlate(existingVehicle.plate) : "—"}
                    </span>
                  </div>
                  <Progress value={(loyalty.washCount / 10) * 100} className="h-2" />
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Lavagens: <span className="text-foreground font-medium">{loyalty.washCount}/10</span></span>
                    <span>
                      {loyalty.rewardAvailable
                        ? <span className="text-primary">Benefício disponível</span>
                        : <>Faltam {loyalty.untilReward} {loyalty.untilReward === 1 ? "lavagem" : "lavagens"}</>}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Observações do Atendente" className="flex-1">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do atendimento, instruções específicas, condição do veículo..."
              className="min-h-[100px] h-full resize-none" />
          </Panel>
        </section>
      </div>

      <footer className="bg-surface-2 px-4 md:px-6 py-4 sticky bottom-0 z-20 space-y-3">
        {!feeOpen ? (
          <Button type="button" variant="ghost" size="sm"
            className="h-10 gap-2 rounded-control bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-foreground"
            onClick={() => setFeeOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar taxa de serviço
          </Button>
        ) : (
          <div className="surface-inset p-2 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary shrink-0" />
            <Input inputMode="numeric" value={feeStr} onChange={(e) => setFeeStr(formatMoneyInput(e.target.value))}
              placeholder="R$ 0,00" className="h-9 w-32 text-xs" />
            <Input value={feeNote} onChange={(e) => setFeeNote(e.target.value)}
              placeholder="Descrição" maxLength={120} className="h-9 flex-1 text-xs" />
            <Button type="button" variant="ghost" size="icon" aria-label="Remover taxa"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => { setFeeOpen(false); setFeeStr(""); setFeeNote(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold gold-text tabular-nums leading-none mr-auto">{brl(previewTotal)}</div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="h-11 gap-2 rounded-control bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-destructive">
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
            className="h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            <Car className="h-4 w-4" />
            <span className="hidden md:inline">{submitting ? "Iniciando…" : "Iniciar Triagem"}</span>
            <span className="md:hidden">{submitting ? "…" : "Iniciar"}</span>
          </Button>
        </div>
      </footer>
    </AppShell>
  );
}

function Panel({ title, subtitle, right, children, className }: {
  title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("surface-card p-5 md:p-6", className)}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-lg font-normal text-foreground">{title}</div>
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
    <div className="flex flex-col md:flex-row items-center md:gap-3 justify-center md:justify-start h-16 md:h-14 px-2 md:px-4 rounded-control bg-surface-3 min-w-0">
      <span className="text-primary shrink-0">{icon}</span>
      <div className="leading-tight min-w-0 text-center md:text-left">
        <div className="hidden md:block text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        <div className="text-base md:text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

