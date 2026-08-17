import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QueueDrawer } from "@/components/QueueDrawer";
import { CustomerLiveSearch } from "@/components/CustomerLiveSearch";
import { ServiceIcon } from "@/components/ServiceIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  Car,
  Trophy,
  CheckCircle2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Building2,
  User,
  Plus,
  X,
  BadgePercent,
} from "lucide-react";

import { EXTRA_KEYS, ExtraKey, ServiceKey, VEHICLE_CATEGORIES, VehicleCategory, Customer, Vehicle } from "@/lib/domain";
import {
  brl,
  formatCpf,
  formatDuration,
  formatPhone,
  formatPlate,
  normalizeCpf,
  normalizePlate,
  toTitleCase,
  toUpperCase,
} from "@/lib/storage";
import { calcDuration, calcTotals, estimatedNewWait, getLoyaltyForVehicle, getServiceDef } from "@/lib/pricing";
import { useData } from "@/lib/DataContext";
import { upsertCustomer, upsertVehicle, createOrder, preflightCustomerVehicle } from "@/services/data";
import { createPartnerOrderRpc, formatCnpj } from "@/services/partners";
import { cn, errorMessage } from "@/lib/utils";
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

  const [discOpen, setDiscOpen] = useState(false);
  const [discPct, setDiscPct] = useState(0);

  const [feeOpen, setFeeOpen] = useState(false);
  const [feeStr, setFeeStr] = useState("");
  const [feeNote, setFeeNote] = useState("");

  const activeServices = useMemo(
    () =>
      [...services]
        .filter((s) => s.active)
        .sort((a, b) => a.order - b.order)
        .map((o) => ({ override: o, def: getServiceDef(o.key) })),
    [services],
  );

  const activeContracts = useMemo(
    () => partnerContracts.filter((c) => c.active).sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [partnerContracts],
  );
  const selectedContract = useMemo(
    () => activeContracts.find((c) => c.id === contractId) ?? null,
    [activeContracts, contractId],
  );

  // Contador de utilização mensal do contrato (a partir das ordens em memória)
  const contractUsage = useMemo(() => {
    if (!selectedContract) return { used: 0, limit: 0 };
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const used = orders.filter(
      (o) =>
        o.partnerContractId === selectedContract.id &&
        o.status !== "cancelled" &&
        o.createdAt.slice(0, 7) === monthPrefix,
    ).length;
    return { used, limit: selectedContract.monthlyVehicleLimit };
  }, [selectedContract, orders]);

  useEffect(() => {
    if (mode !== "customer") return;
    if (normalizeCpf(cpf).length === 11) {
      const found = findCustomerByCpf(cpf);
      if (found) {
        setExistingCustomer(found);
        setName(found.name);
        setPhone(found.phone);
      } else setExistingCustomer(null);
    } else setExistingCustomer(null);
  }, [cpf, findCustomerByCpf, mode]);

  useEffect(() => {
    if (mode !== "customer") return;
    if (normalizePlate(plate).length >= 7) {
      const v = findVehicleByPlate(plate);
      if (v && existingCustomer && v.customerId === existingCustomer.id) {
        setExistingVehicle(v);
        setBrand(v.brand);
        setModel(v.model);
        setColor(v.color);
        setYear(v.year);
        setCategory(v.category);
      } else setExistingVehicle(null);
    } else setExistingVehicle(null);
  }, [plate, findVehicleByPlate, mode, existingCustomer]);

  const plateConflict = useMemo(() => {
    if (mode !== "customer" || normalizePlate(plate).length < 7) return "";
    const matched = findVehicleByPlate(plate);
    if (!matched) return "";
    if (!existingCustomer) return "Esta placa já está cadastrada. Selecione o cliente proprietário para continuar.";
    if (matched.customerId !== existingCustomer.id)
      return "Esta placa pertence a outro cliente e não pode ser reatribuída.";
    return "";
  }, [mode, plate, findVehicleByPlate, existingCustomer]);

  const loyalty = useMemo(
    () => (mode === "customer" ? getLoyaltyForVehicle(existingVehicle) : getLoyaltyForVehicle(null)),
    [existingVehicle, mode],
  );

  const categoryLocked = mode === "customer" && !!existingVehicle;



  const baseTotals = useMemo(
    () => calcTotals(prices, category, service, extras, 0, loyalty),
    [prices, category, service, extras, loyalty],
  );
  // Mesma ordem do pay_order: base = subtotal - fidelidade; desconto manual sobre a base; taxa depois.
  const discPctEff = mode === "partner" ? 0 : Math.min(100, Math.max(0, Number.isFinite(discPct) ? discPct : 0));
  const manualDiscount = useMemo(() => {
    const base = Math.max(0, baseTotals.subtotal - baseTotals.loyaltyDiscount);
    return +(base * (discPctEff / 100)).toFixed(2);
  }, [baseTotals.subtotal, baseTotals.loyaltyDiscount, discPctEff]);
  const totals = useMemo(
    () => calcTotals(prices, category, service, extras, manualDiscount, loyalty),
    [prices, category, service, extras, manualDiscount, loyalty],
  );
  const serviceFee = parseMoney(feeStr);
  const previewTotal = useMemo(() => Math.max(0, totals.total + serviceFee), [totals.total, serviceFee]);

  const duration = useMemo(() => calcDuration(service, extras), [service, extras]);
  const newWait = useMemo(() => estimatedNewWait(orders), [orders]);
  const queueCount = orders.filter((o) => o.status === "queued" || o.status === "in_progress").length;

  const selectedServiceDef = service ? getServiceDef(service) : null;
  const selectedOverride = service ? services.find((o) => o.key === service) : null;

  const toggleExtra = (k: ExtraKey) => setExtras((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const clearAll = () => {
    setCategory("Hatch");
    setService(null);
    setExtras([]);
    setCpf("");
    setName("");
    setPhone("");
    setExistingCustomer(null);
    setPlate("");
    setBrand("");
    setModel("");
    setColor("");
    setYear("");
    setExistingVehicle(null);
    setNotes("");
    setContractId("");
    setDiscOpen(false);
    setDiscPct(0);
    setFeeOpen(false);
    setFeeStr("");
    setFeeNote("");
  };

  // ----- múltiplos veículos do mesmo cliente -----
  const customerVehicles = useMemo(
    () => (existingCustomer ? vehicles.filter((v) => v.customerId === existingCustomer.id) : []),
    [vehicles, existingCustomer],
  );
  const activeVehicleIndex = existingVehicle ? customerVehicles.findIndex((v) => v.id === existingVehicle.id) : -1;

  const applyVehicle = (v: Vehicle) => {
    setExistingVehicle(v);
    setPlate(v.plate);
    setBrand(v.brand);
    setModel(v.model);
    setColor(v.color);
    setYear(v.year);
    setCategory(v.category);
  };

  const cycleVehicle = (dir: -1 | 1) => {
    if (customerVehicles.length === 0) return;
    const base = activeVehicleIndex >= 0 ? activeVehicleIndex : dir === 1 ? -1 : 0;
    const next = (base + dir + customerVehicles.length) % customerVehicles.length;
    applyVehicle(customerVehicles[next]);
  };

  const startNewVehicle = () => {
    setExistingVehicle(null);
    setPlate("");
    setBrand("");
    setModel("");
    setColor("");
    setYear("");
    setCategory("Hatch");
  };

  const fillFromMatch = (m: { customer: Customer; vehicles: Vehicle[]; matchedPlate?: string }) => {
    const c = m.customer;
    setExistingCustomer(c);
    setCpf(c.cpf);
    setName(c.name);
    setPhone(c.phone);
    const pick = m.matchedPlate ? m.vehicles.find((v) => v.plate === m.matchedPlate) : m.vehicles[0];
    if (pick) applyVehicle(pick);
    toast.success(`Cliente carregado: ${c.name}`);
  };

  const contractLimitReached =
    mode === "partner" && selectedContract ? contractUsage.used >= contractUsage.limit : false;

  const canSubmit =
    !!category &&
    !!service &&
    !submitting &&
    normalizePlate(plate).length >= 7 &&
    (mode === "partner"
      ? !!selectedContract && !contractLimitReached
      : normalizeCpf(cpf).length === 11 &&
        name.trim().length >= 2 &&
        (phone || "").replace(/\D/g, "").length >= 10 &&
        !plateConflict);

  const handleSubmit = async () => {
    if (!canSubmit || !category || !service) {
      toast.error("Complete os dados necessários para iniciar a triagem.");
      return;
    }
    const serviceRow = services.find((s) => s.key === service);
    if (!serviceRow?.id) {
      toast.error("Serviço não encontrado.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "partner" && selectedContract) {
        await createPartnerOrderRpc({
          partnerContractId: selectedContract.id,
          plate: normalizePlate(plate),
          brand: toTitleCase(brand),
          model: toTitleCase(model),
          color: toUpperCase(color),
          year: year,
          category,
          serviceId: serviceRow.id,
          serviceKey: service,
          extras,
          subtotal: totals.subtotal,
          notes,
          queuePosition: queueCount + 1,
          durationMinutes: duration,
        });
        toast.success("Triagem iniciada", {
          description: `Veículo ${formatPlate(plate)} adicionado à fila (parceiro).`,
        });
      } else {
        await preflightCustomerVehicle({
          customerId: existingCustomer?.id,
          vehicleId: existingVehicle?.id,
          cpf,
          phone,
          plate,
        });
        const cust = await upsertCustomer({
          id: existingCustomer?.id,
          name: name.trim(),
          cpf,
          phone,
        });
        const veh = await upsertVehicle({
          id: existingVehicle?.id,
          customerId: cust.id,
          plate,
          brand,
          model,
          color,
          year,
          category,
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
          loyaltyDiscount: totals.loyaltyDiscount,
          loyaltyRewardUsed: totals.loyaltyDiscount > 0,
          discount: totals.manualDiscount,
          discountPercentage: discPctEff,
          serviceFee,
          serviceFeeNote: feeNote,
          notes,
          queuePosition: queueCount + 1,
          durationMinutes: duration,
        });
        toast.success("Triagem iniciada", {
          description: `Veículo ${formatPlate(veh.plate)} adicionado à fila.`,
        });
      }
      clearAll();
    } catch (error: unknown) {
      const msg = errorMessage(error, "");
      if (msg.includes("contract_limit_reached")) toast.error("Limite mensal do contrato atingido.");
      else if (msg.includes("contract_inactive")) toast.error("Contrato inativo.");
      else toast.error(msg || "Erro ao iniciar triagem");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <header className="glass-chrome h-[60px] min-h-[60px] lg:h-[88px] lg:min-h-[88px] px-4 md:px-6 py-0 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 sticky top-0 z-20">
        <div className="min-w-0 hidden lg:block">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Tela de Vendas</h1>
        </div>
        <div className="w-full md:w-auto md:ml-auto flex md:items-center gap-3 min-w-0">
          <div className="hidden md:block">
            <StatChip
              icon={<Clock className="h-4 w-4" />}
              label="Espera estimada"
              value={formatDuration(newWait)}
            />
          </div>
          <QueueDrawer
            orders={orders}
            contracts={partnerContracts}
            estimatedWait={formatDuration(newWait)}
          />
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 grid gap-2 md:gap-2.5 lg:grid-cols-12 items-stretch overflow-auto">
        {/* COLUNA 1 — Categoria + Serviços unificados */}
        <section className="lg:col-span-4 flex flex-col gap-2 md:gap-2.5 min-h-0">
          <Panel title="Serviços" subtitle={`Preços para ${category}`} className="flex-1">
            <div className="grid grid-cols-5 gap-0.5 sm:gap-1.5 p-1 rounded-control bg-surface-3 mb-4">
              {VEHICLE_CATEGORIES.map((c) => {
                const locked = categoryLocked && c !== category;
                return (
                  <button
                    key={c}
                    disabled={locked}
                    onClick={() => { if (!categoryLocked) setCategory(c); }}
                    className={cn(
                      "min-w-0 px-0.5 sm:px-2 py-2 rounded-[0.5rem] text-[10px] sm:text-sm font-medium transition-colors whitespace-nowrap",
                      category === c
                        ? "bg-primary text-primary-foreground"
                        : locked
                          ? "text-muted-foreground/50 opacity-50 cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-4",
                    )}
                  >
                    {c}
                  </button>
                );
              })}

            </div>

            <div className="space-y-2">
              {activeServices.map(({ override, def }) => {
                const price = prices[category][override.key];
                const active = service === override.key;
                return (
                  <button
                    key={override.key}
                    onClick={() => setService(override.key)}
                    className={cn(
                      "w-full min-h-[72px] text-left p-3 rounded-control transition-colors flex items-center gap-3",
                      active ? "bg-primary text-primary-foreground" : "bg-surface-3 hover:bg-surface-4",
                    )}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-[0.5rem] grid place-items-center shrink-0",
                        active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-surface-4 text-foreground",
                      )}
                    >
                      <ServiceIcon iconKey={override.icon} serviceKey={override.key} className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{override.name ?? def.name}</div>
                      <div
                        className={cn(
                          "text-xs flex items-center gap-2",
                          active ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        <Clock className="h-3 w-3" /> {formatDuration(override.durationMinutes ?? def.durationMinutes)}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        active ? "text-primary-foreground" : "text-primary",
                      )}
                    >
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
                    <button
                      key={k}
                      onClick={() => toggleExtra(k)}
                      className={cn(
                        "min-h-[64px] p-2.5 rounded-control text-xs transition-colors flex flex-col items-center justify-center",
                        active ? "bg-primary text-primary-foreground" : "bg-surface-3 hover:bg-surface-4",
                      )}
                    >
                      <div className="font-medium">{k}</div>
                      <div
                        className={cn(
                          "text-[11px] mt-0.5 tabular-nums",
                          active ? "text-primary-foreground/75" : "text-muted-foreground",
                        )}
                      >
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
        <section className="lg:col-span-4 flex flex-col gap-2 md:gap-2.5 min-h-0">
          <Panel title="Detalhes do Serviço" className="h-[280px] shrink-0 flex flex-col">
            {selectedServiceDef ? (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-control bg-surface-3 text-primary grid place-items-center shrink-0">
                      <ServiceIcon
                        iconKey={selectedOverride?.icon}
                        serviceKey={selectedServiceDef.key}
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">
                        {selectedOverride?.name ?? selectedServiceDef.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedServiceDef.key === "Platinum"
                          ? "Experiência Monaco completa."
                          : (selectedOverride?.description ?? selectedServiceDef.description)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Duração base {formatDuration(selectedOverride?.durationMinutes ?? selectedServiceDef.durationMinutes)}
                  {extras.length > 0 && (
                    <>
                      {" "}
                      · com extras: <span className="text-primary font-medium">{formatDuration(duration)}</span>
                    </>
                  )}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {selectedServiceDef.included
                    .filter((i) => selectedServiceDef.key !== "Platinum" || i !== "Cristalização de vidros")
                    .map((i) => (
                      <li key={i} className="flex items-center gap-2 text-foreground/90">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        {i}
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <div className="flex-1 grid place-items-center px-2">
                <p className="max-w-md text-center text-sm text-muted-foreground leading-relaxed">
                  Esse espaço informa o que está incluso no serviço e qual é o tempo minimo necessário. Para isso,
                  selecione a aba correspondente ao carro do cliente e em seguida, selecione o serviço que ele deseja.
                </p>
              </div>
            )}
          </Panel>

          <Panel
            className="flex-1"
            title={mode === "customer" ? "Cliente" : "Parceiro"}
            right={
              <div className="flex items-center gap-1 p-1 rounded-control bg-surface-3">
                <button
                  className={cn(
                    "h-8 px-3 rounded-[0.5rem] text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                    mode === "customer"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    setMode("customer");
                    setContractId("");
                  }}
                >
                  <User className="h-3.5 w-3.5" /> Cliente
                </button>
                <button
                  className={cn(
                    "h-8 px-3 rounded-[0.5rem] text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                    mode === "partner"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    setMode("partner");
                    setCpf("");
                    setName("");
                    setPhone("");
                    setExistingCustomer(null);
                  }}
                >
                  <Building2 className="h-3.5 w-3.5" /> Parceiro
                </button>
              </div>
            }
          >
            {mode === "customer" ? (
              <div className="space-y-3">
                <CustomerLiveSearch onSelect={fillFromMatch} placeholder="Buscar cliente…" />
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
                  <Input
                    value={name}
                    onChange={(e) => setName(toTitleCase(e.target.value))}
                    placeholder="Nome do cliente"
                  />
                </Field>
                <Field label="WhatsApp *">
                  <div className="relative">
                    <MessageCircle className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                    <Input
                      value={formatPhone(phone)}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      inputMode="numeric"
                      className="pl-9"
                    />
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
                    <SelectTrigger>
                      <SelectValue
                        placeholder={activeContracts.length ? "Selecione o contrato" : "Nenhum contrato ativo"}
                      />
                    </SelectTrigger>
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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Empresa</span>
                      <span className="font-medium">{selectedContract.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CNPJ</span>
                      <span className="font-mono">{formatCnpj(selectedContract.cnpj)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contato</span>
                      <span>{selectedContract.contactPhone || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor contratado</span>
                      <span>{brl(selectedContract.contractValue)}</span>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Utilização mensal</span>
                        <span>
                          <strong>{contractUsage.used}</strong>/{contractUsage.limit} veículos
                        </span>
                      </div>
                      <Progress
                        value={contractUsage.limit ? (contractUsage.used / contractUsage.limit) * 100 : 0}
                        className="h-2"
                      />
                      <div className="text-[11px] mt-1 text-muted-foreground">
                        {contractLimitReached ? (
                          <span className="text-destructive">
                            Limite mensal atingido. Não é possível adicionar outro veículo neste mês.
                          </span>
                        ) : (
                          <>
                            Faltam{" "}
                            <span className="text-primary font-medium">
                              {Math.max(0, contractUsage.limit - contractUsage.used)}
                            </span>{" "}
                            carros.
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </section>

        {/* COLUNA 3 — Veículo + Observações */}
        <section className="lg:col-span-4 flex flex-col gap-2 md:gap-2.5 min-h-0">
          <Panel
            title="Veículo"
            right={
              <div className="flex items-center gap-1">
                {mode === "customer" && customerVehicles.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Veículo anterior"
                      className="h-9 w-9 rounded-control bg-surface-3 hover:bg-surface-4"
                      onClick={() => cycleVehicle(-1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Próximo veículo"
                      className="h-9 w-9 rounded-control bg-surface-3 hover:bg-surface-4"
                      onClick={() => cycleVehicle(1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {mode === "customer" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Novo veículo para este cliente"
                    className="h-9 w-9 rounded-control bg-surface-3 text-foreground hover:bg-surface-4"
                    onClick={startNewVehicle}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            }
          >
            <div className="space-y-3">
              {mode === "customer" && customerVehicles.length > 1 && (
                <div className="text-[11px] text-muted-foreground">
                  Veículo {activeVehicleIndex >= 0 ? activeVehicleIndex + 1 : "novo"} de {customerVehicles.length} deste
                  cliente
                </div>
              )}
              <Field label="Placa *">
                <Input
                  value={formatPlate(plate)}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="ABC-1D23"
                  className="font-mono uppercase tracking-wider"
                />
                {plateConflict && <p className="text-xs text-destructive">{plateConflict}</p>}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca">
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(toTitleCase(e.target.value))}
                    placeholder="Ex: Toyota"
                  />
                </Field>
                <Field label="Modelo">
                  <Input
                    value={model}
                    onChange={(e) => setModel(toTitleCase(e.target.value))}
                    placeholder="Ex: Corolla"
                  />
                </Field>
                <Field label="Cor">
                  <Input
                    value={color}
                    onChange={(e) => setColor(toUpperCase(e.target.value))}
                    placeholder="Ex: PRATA"
                    className="uppercase"
                  />
                </Field>
                <Field label="Ano">
                  <Input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Ex: 2022"
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <Field label="Categoria selecionada">
                <div className="px-3 py-2 rounded-control bg-surface-3 text-sm">{category}</div>
              </Field>

              {mode === "customer" && (
                <div className="surface-inset p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Trophy
                        className={cn("h-4 w-4", loyalty.rewardAvailable ? "text-primary" : "text-muted-foreground")}
                      />
                      Fidelidade da placa
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {existingVehicle ? formatPlate(existingVehicle.plate) : "—"}
                    </span>
                  </div>
                  <Progress value={(loyalty.washCount / 10) * 100} className="h-2 bg-[#101010]" />
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      Lavagens: <span className="text-foreground font-medium">{loyalty.washCount}/10</span>
                    </span>
                    <span>
                      {loyalty.rewardAvailable ? (
                        <span className="text-primary">Benefício disponível</span>
                      ) : (
                        <>
                          Faltam {loyalty.untilReward} {loyalty.untilReward === 1 ? "lavagem" : "lavagens"}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Observações do Atendente" className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do atendimento, instruções específicas, condição do veículo..."
              className="flex-1 min-h-[100px] w-full resize-none"
            />
          </Panel>
        </section>
      </div>

      <footer className="glass-chrome px-3 md:px-6 sticky bottom-0 z-20 min-h-[136px] flex items-center">
        <div className="w-full flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-full md:w-auto flex flex-col md:flex-row items-stretch md:items-center gap-2 min-w-0">
            <div
              className={cn(
                "w-full md:w-auto min-h-11 rounded-control flex items-center overflow-hidden transition-all duration-200",
                discOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-foreground",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                disabled={mode === "partner"}
                className={cn(
                  "h-11 justify-start px-3 md:px-4 gap-1.5 rounded-none bg-transparent text-inherit hover:bg-transparent hover:text-inherit shrink-0",
                  discOpen ? "w-auto" : "w-full md:w-auto",
                )}
                onClick={() => setDiscOpen(true)}
              >
                <BadgePercent className="h-4 w-4" />
                <span className="hidden md:inline">Desconto manual</span>
                <span className="md:hidden">Desconto</span>
              </Button>
              {discOpen && (
                <div className="h-11 flex flex-1 md:flex-none items-center gap-1 pr-1.5 animate-fade-in min-w-0">
                  <Input
                    inputMode="numeric"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={discPct || ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setDiscPct(Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, n)));
                    }}
                    placeholder="0"
                    aria-label="Percentual de desconto"
                    className="h-8 w-14 px-2 border-0 bg-primary-foreground/20 text-white caret-white placeholder:text-white/60 focus-visible:ring-white/40 text-xs"
                  />
                  <span className="text-xs text-primary-foreground">%</span>
                  <span className="hidden md:inline text-xs text-primary-foreground/80 whitespace-nowrap">
                    −{brl(manualDiscount)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Cancelar desconto"
                    className="h-8 w-8 ml-auto shrink-0 rounded-control bg-transparent text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                    onClick={() => {
                      setDiscOpen(false);
                      setDiscPct(0);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div
              className={cn(
                "w-full md:w-auto min-h-11 rounded-control flex items-center overflow-hidden transition-all duration-200",
                feeOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-foreground",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-11 justify-start px-3 md:px-4 gap-1.5 rounded-none bg-transparent text-inherit hover:bg-transparent hover:text-inherit shrink-0",
                  feeOpen ? "w-auto" : "w-full md:w-auto",
                )}
                onClick={() => setFeeOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Adicionar taxa de serviço</span>
                <span className="md:hidden">Taxa</span>
              </Button>
              {feeOpen && (
                <div className="h-11 flex flex-1 md:flex-none items-center gap-1 pr-1.5 animate-fade-in min-w-0">
                  <Input
                    inputMode="numeric"
                    value={feeStr}
                    onChange={(e) => setFeeStr(formatMoneyInput(e.target.value))}
                    placeholder="R$ 0,00"
                    aria-label="Valor da taxa"
                    className="h-8 w-[84px] md:w-24 px-2 border-0 bg-primary-foreground/20 text-white caret-white placeholder:text-white/60 focus-visible:ring-white/40 text-xs"
                  />
                  <Input
                    value={feeNote}
                    onChange={(e) => setFeeNote(e.target.value)}
                    placeholder="Descrição"
                    aria-label="Descrição da taxa"
                    maxLength={120}
                    className="h-8 flex-1 md:flex-none md:w-32 min-w-0 px-2 border-0 bg-primary-foreground/20 text-white caret-white placeholder:text-white/60 focus-visible:ring-white/40 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Cancelar taxa"
                    className="h-8 w-8 shrink-0 rounded-control bg-transparent text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                    onClick={() => {
                      setFeeOpen(false);
                      setFeeStr("");
                      setFeeNote("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="w-full md:w-auto md:ml-auto flex items-center gap-1.5 md:gap-3 min-w-0">
            <div className="text-lg md:text-2xl font-bold gold-text tabular-nums leading-none whitespace-nowrap">
              {brl(previewTotal)}
            </div>
            <div className="ml-auto flex items-center gap-1.5 md:gap-3 shrink-0">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-11 px-5 md:px-4 gap-1.5 rounded-control bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-destructive text-xs md:text-sm"
                  >
                    <Trash2 className="hidden md:inline h-4 w-4" /> Limpar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar formulário?</AlertDialogTitle>
                    <AlertDialogDescription>Todas as informações desta triagem serão descartadas.</AlertDialogDescription>
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
                className="h-11 px-5 md:px-4 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs md:text-sm"
              >
                <Car className="hidden md:inline h-4 w-4" />
                <span className="hidden md:inline">{submitting ? "Iniciando…" : "Iniciar Triagem"}</span>
                <span className="md:hidden">{submitting ? "…" : "Iniciar"}</span>
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}

function Panel({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
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
    <div className="flex flex-col md:flex-row items-center md:gap-3 justify-center md:justify-start h-16 md:h-14 px-2 md:px-5 rounded-control bg-surface-3 min-w-0 md:min-w-[168px]">
      <span className="text-primary shrink-0">{icon}</span>
      <div className="leading-tight min-w-0 text-center md:text-left">
        <div className="hidden md:block text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          {label}
        </div>
        <div className="text-base md:text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}
