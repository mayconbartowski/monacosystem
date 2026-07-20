import { supabase } from "@/integrations/supabase/client";
import {
  Customer, Vehicle, Order, ServiceOverride, PriceTable, ServiceKey, ExtraKey,
  VehicleCategory, DEFAULT_PRICES, SERVICES, ServiceIconKey, PartnerContract,
  PaymentStatus, OrderSource,
} from "@/lib/domain";
import { normalizePlate, normalizeCpf } from "@/lib/storage";
import { fetchPartnerContracts } from "@/services/partners";

// ---------- mappers ----------
type CustomerRow = { id: string; name: string; cpf: string; whatsapp: string; created_at: string; };
type VehicleRow = {
  id: string; customer_id: string; plate: string;
  brand: string; model: string; color: string; year: string;
  category: VehicleCategory; wash_count: number;
  reward_available: boolean; last_reward_date: string | null;
};
type OrderRow = {
  id: string; customer_id: string | null; customer_name: string;
  vehicle_id: string | null; vehicle_plate: string; vehicle_label: string;
  category: VehicleCategory; service_id: string; service_key: string;
  extras: unknown;
  subtotal: number; discount: number; loyalty_discount: number;
  loyalty_reward_used: boolean; service_fee: number; service_fee_note: string | null;
  total: number;
  payment_method: "Crédito" | "Débito" | "Pix" | null;
  payment_status?: PaymentStatus | null;
  paid_at?: string | null;
  discount_percentage?: number | null;
  order_source?: OrderSource | null;
  partner_contract_id?: string | null;
  notes: string; queue_position: number; duration_minutes: number;
  status: "queued" | "in_progress" | "completed" | "cancelled" | "delivered";
  created_at: string; started_at: string | null; completed_at: string | null;
};
type ServiceRow = {
  id: string; key: string; title: string; description: string;
  duration_minutes: number; position: number; active: boolean;
};
type ServicePriceRow = {
  id: string; service_id: string; category: VehicleCategory; price: number;
};

function mapCustomer(r: CustomerRow, totalOrders = 0): Customer {
  return { id: r.id, name: r.name, cpf: r.cpf, phone: r.whatsapp, totalOrders, createdAt: r.created_at };
}
function mapVehicle(r: VehicleRow): Vehicle {
  return {
    id: r.id, customerId: r.customer_id, plate: r.plate,
    brand: r.brand || "", model: r.model || "", color: r.color || "", year: r.year || "",
    category: r.category, washCount: r.wash_count || 0,
    rewardAvailable: !!r.reward_available,
    lastRewardDate: r.last_reward_date ?? undefined,
  };
}
export function mapOrder(r: OrderRow): Order {
  const status = r.status;
  const pm = r.payment_method;
  // Retro-compat: se não vier payment_status mas há pagamento gravado e status é final,
  // consideramos como paid; ordens canceladas => cancelled; senão pending.
  let ps: PaymentStatus = r.payment_status ?? "pending";
  if (!r.payment_status) {
    if (status === "cancelled") ps = "cancelled";
    else if (pm && (status === "delivered" || status === "completed")) ps = "paid";
  }
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerCpf: "",
    vehicleId: r.vehicle_id,
    vehiclePlate: r.vehicle_plate,
    vehicleLabel: r.vehicle_label,
    category: r.category,
    service: r.service_key as ServiceKey,
    serviceId: r.service_id,
    extras: Array.isArray(r.extras) ? (r.extras as ExtraKey[]) : [],
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    discountPercentage: Number(r.discount_percentage ?? 0),
    loyaltyDiscount: Number(r.loyalty_discount),
    loyaltyRewardUsed: !!r.loyalty_reward_used,
    serviceFee: Number(r.service_fee ?? 0),
    serviceFeeNote: r.service_fee_note ?? "",
    total: Number(r.total),
    paymentMethod: pm,
    paymentStatus: ps,
    paidAt: r.paid_at ?? undefined,
    notes: r.notes || "",
    queuePosition: r.queue_position,
    durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    status,
    orderSource: (r.order_source ?? "customer") as OrderSource,
    partnerContractId: r.partner_contract_id ?? null,
  };
}

// ---------- fetches ----------
export async function fetchAll() {
  const [cs, vs, os, ss, sps, pcs] = await Promise.all([
    supabase.from("customers").select("*").eq("active", true).order("created_at", { ascending: false }),
    supabase.from("vehicles").select("*"),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("services").select("*").order("position"),
    supabase.from("service_prices").select("*"),
    fetchPartnerContracts(),
  ]);
  const orders = (os.data as OrderRow[] | null ?? []).map(mapOrder);
  const totalByCustomer = new Map<string, number>();
  orders.forEach((o) => { if (o.customerId) totalByCustomer.set(o.customerId, (totalByCustomer.get(o.customerId) ?? 0) + 1); });
  const customers = (cs.data as CustomerRow[] | null ?? []).map((c) =>
    mapCustomer(c, totalByCustomer.get(c.id) ?? 0)
  );
  const vehicles = (vs.data as VehicleRow[] | null ?? []).map(mapVehicle);
  const services: ServiceOverride[] = (ss.data as ServiceRow[] | null ?? []).map((s) => ({
    id: s.id, key: s.key as ServiceKey, name: s.title, description: s.description,
    durationMinutes: s.duration_minutes, active: s.active, order: s.position,
    icon: SERVICES.find((d) => d.key === s.key)?.icon as ServiceIconKey,
  }));
  const serviceById = new Map(services.map((s) => [s.id!, s.key]));
  const prices: PriceTable = JSON.parse(JSON.stringify(DEFAULT_PRICES));
  (sps.data as ServicePriceRow[] | null ?? []).forEach((p) => {
    const k = serviceById.get(p.service_id);
    if (!k) return;
    prices[p.category][k] = Number(p.price);
  });
  const partnerContracts: PartnerContract[] = pcs;
  return { customers, vehicles, orders, services, prices, partnerContracts };
}

// ---------- customers ----------
export async function upsertCustomer(c: { id?: string; name: string; cpf: string; phone: string; }): Promise<Customer> {
  const row = { name: c.name.trim(), cpf: normalizeCpf(c.cpf), whatsapp: (c.phone || "").replace(/\D/g, "") };
  if (c.id) {
    const { data, error } = await supabase.from("customers").update(row).eq("id", c.id).select().single();
    if (error) throw error;
    return mapCustomer(data as CustomerRow);
  }
  const existing = await supabase.from("customers").select("*").eq("cpf", row.cpf).maybeSingle();
  if (existing.data) {
    const { data, error } = await supabase.from("customers")
      .update({ ...row, active: true }).eq("id", (existing.data as CustomerRow).id).select().single();
    if (error) throw error;
    return mapCustomer(data as CustomerRow);
  }
  const { data, error } = await supabase.from("customers").insert(row).select().single();
  if (error) throw error;
  return mapCustomer(data as CustomerRow);
}

export async function updateCustomer(id: string, patch: { name: string; cpf: string; phone: string; }): Promise<Customer> {
  const row = { name: patch.name.trim(), cpf: normalizeCpf(patch.cpf), whatsapp: (patch.phone || "").replace(/\D/g, "") };
  const { data, error } = await supabase.from("customers").update(row).eq("id", id).select().single();
  if (error) throw error;
  return mapCustomer(data as CustomerRow);
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// ---------- vehicles ----------
export async function upsertVehicle(v: {
  id?: string; customerId: string; plate: string; brand?: string; model?: string;
  color?: string; year?: string; category: VehicleCategory;
}): Promise<Vehicle> {
  const row = {
    customer_id: v.customerId, plate: normalizePlate(v.plate),
    brand: v.brand || "", model: v.model || "",
    color: v.color || "", year: v.year || "", category: v.category,
  };
  if (v.id) {
    const { data, error } = await supabase.from("vehicles").update(row).eq("id", v.id).select().single();
    if (error) throw error;
    return mapVehicle(data as VehicleRow);
  }
  const existing = await supabase.from("vehicles").select("*").eq("plate", row.plate).maybeSingle();
  if (existing.data) {
    const { data, error } = await supabase.from("vehicles").update(row).eq("id", (existing.data as VehicleRow).id).select().single();
    if (error) throw error;
    return mapVehicle(data as VehicleRow);
  }
  const { data, error } = await supabase.from("vehicles").insert(row).select().single();
  if (error) throw error;
  return mapVehicle(data as VehicleRow);
}

// ---------- orders ----------
/**
 * Cria a ordem no fluxo NOVO: "Iniciar triagem".
 * A ordem entra como pending; pagamento acontece só na retirada via pay_order RPC.
 */
export async function createOrder(input: {
  customerId: string; customerName: string; vehicleId: string;
  vehiclePlate: string; vehicleLabel: string; category: VehicleCategory;
  serviceId: string; serviceKey: ServiceKey; extras: ExtraKey[];
  subtotal: number; loyaltyDiscount: number; loyaltyRewardUsed: boolean;
  serviceFee?: number; serviceFeeNote?: string;
  notes: string; queuePosition: number; durationMinutes: number;
}): Promise<Order> {
  const auth = await supabase.auth.getUser();
  const serviceFee = Math.max(0, input.serviceFee ?? 0);
  const row: any = {
    customer_id: input.customerId,
    customer_name: input.customerName,
    vehicle_id: input.vehicleId,
    vehicle_plate: input.vehiclePlate,
    vehicle_label: input.vehicleLabel,
    category: input.category,
    service_id: input.serviceId,
    service_key: input.serviceKey,
    extras: input.extras,
    subtotal: input.subtotal,
    discount: 0,
    discount_percentage: 0,
    loyalty_discount: input.loyaltyDiscount,
    loyalty_reward_used: input.loyaltyRewardUsed,
    service_fee: serviceFee,
    service_fee_note: input.serviceFeeNote?.trim() || null,
    total: Math.max(0, input.subtotal - input.loyaltyDiscount + serviceFee),
    payment_method: null,
    payment_status: "pending",
    notes: input.notes,
    queue_position: input.queuePosition,
    duration_minutes: input.durationMinutes,
    status: "queued",
    created_by: auth.data.user?.id ?? null,
    order_source: "customer",
  };
  const { data, error } = await supabase.from("orders").insert(row).select().single();
  if (error) throw error;
  return mapOrder(data as OrderRow);
}

export async function startOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from("orders")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from("orders")
    .update({ status: "cancelled", payment_status: "cancelled" } as any)
    .eq("id", orderId);
  if (error) throw error;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw error;
}

/**
 * Legacy helper — kept for compatibility. No longer used for the pickup flow.
 * The new payment flow uses payOrderRpc / deliverPartnerOrderRpc.
 */
export async function deliverOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from("orders")
    .update({ status: "delivered" }).eq("id", orderId);
  if (error) throw error;
}

/**
 * Marca lavagem como concluída. Fidelidade NÃO é consolidada aqui —
 * ela é aplicada apenas no pagamento (pay_order RPC).
 */
export async function finishOrder(order: Order): Promise<void> {
  const completedAt = new Date().toISOString();
  const startMs = order.startedAt ? new Date(order.startedAt).getTime() : Date.now();
  const actualMinutes = Math.max(1, Math.round((Date.now() - startMs) / 60000));

  const { error: e1 } = await supabase.from("orders").update({
    status: "completed",
    completed_at: completedAt,
    actual_minutes: actualMinutes,
  }).eq("id", order.id);
  if (e1) throw e1;

  if (order.serviceId) {
    await (supabase.rpc as any)("record_service_actual_minutes", {
      _service_id: order.serviceId, _minutes: actualMinutes,
    });
  }
}

// ---------- services / prices ----------
export async function updateServiceRow(id: string, patch: {
  title?: string; description?: string; duration_minutes?: number;
  active?: boolean; position?: number;
}): Promise<void> {
  const { error } = await supabase.from("services").update(patch).eq("id", id);
  if (error) throw error;
}

export async function upsertServicePrice(serviceId: string, category: VehicleCategory, price: number): Promise<void> {
  const { data: existing } = await supabase.from("service_prices")
    .select("id").eq("service_id", serviceId).eq("category", category).maybeSingle();
  if (existing?.id) {
    const { error } = await supabase.from("service_prices").update({ price }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("service_prices").insert({ service_id: serviceId, category, price });
    if (error) throw error;
  }
}
