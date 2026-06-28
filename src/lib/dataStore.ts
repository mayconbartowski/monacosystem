import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { normalizeCpf, normalizePlate, normalizeWhatsapp } from "./format";

// ============== Types (camelCase domain) ==============

export type VehicleCategory = "Hatch" | "Sedan" | "SUV" | "Picape" | "Luxo";
export const VEHICLE_CATEGORIES: VehicleCategory[] = ["Hatch", "Sedan", "SUV", "Picape", "Luxo"];

export type PaymentMethod = "Crédito" | "Débito" | "Pix";
export const PAYMENT_METHODS: PaymentMethod[] = ["Crédito", "Débito", "Pix"];

export type OrderStatus = "queued" | "in_progress" | "completed" | "cancelled";

export interface Customer {
  id: string;
  name: string;
  cpf: string;
  whatsapp: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: string;
  category: VehicleCategory;
  washCount: number;
  rewardAvailable: boolean;
  lastRewardDate?: string | null;
}

export interface ServiceDef {
  id: string;
  key: string;
  title: string;
  description: string;
  durationMinutes: number;
  position: number;
  active: boolean;
  loyaltyQualifying: boolean;
}

export interface ServicePrice {
  serviceId: string;
  category: VehicleCategory;
  price: number;
}

export interface ServiceTimeStat {
  serviceId: string;
  totalWashes: number;
  sumActualMinutes: number;
}

export interface Order {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  customerName: string;
  vehiclePlate: string;
  vehicleLabel: string;
  category: VehicleCategory;
  serviceKey: string;
  extras: string[];
  subtotal: number;
  discount: number;
  loyaltyDiscount: number;
  loyaltyRewardUsed: boolean;
  total: number;
  paymentMethod: PaymentMethod | null;
  notes: string;
  queuePosition: number;
  durationMinutes: number;
  status: OrderStatus;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  actualMinutes?: number | null;
}

// ============== Mappers ==============

type DB = Database["public"]["Tables"];

const mapCustomer = (r: DB["customers"]["Row"]): Customer => ({
  id: r.id,
  name: r.name,
  cpf: r.cpf,
  whatsapp: r.whatsapp,
  createdAt: r.created_at,
});

const mapVehicle = (r: DB["vehicles"]["Row"]): Vehicle => ({
  id: r.id,
  customerId: r.customer_id,
  plate: r.plate,
  brand: r.brand ?? "",
  model: r.model ?? "",
  color: r.color ?? "",
  year: r.year ?? "",
  category: r.category as VehicleCategory,
  washCount: r.wash_count ?? 0,
  rewardAvailable: r.reward_available ?? false,
  lastRewardDate: r.last_reward_date,
});

const mapService = (r: DB["services"]["Row"]): ServiceDef => ({
  id: r.id,
  key: r.key,
  title: r.title,
  description: r.description ?? "",
  durationMinutes: r.duration_minutes ?? 60,
  position: r.position ?? 0,
  active: r.active ?? true,
  loyaltyQualifying: r.loyalty_qualifying ?? true,
});

const mapPrice = (r: DB["service_prices"]["Row"]): ServicePrice => ({
  serviceId: r.service_id,
  category: r.category as VehicleCategory,
  price: Number(r.price),
});

const mapStat = (r: DB["service_time_stats"]["Row"]): ServiceTimeStat => ({
  serviceId: r.service_id,
  totalWashes: r.total_washes ?? 0,
  sumActualMinutes: r.sum_actual_minutes ?? 0,
});

const mapOrder = (r: DB["orders"]["Row"]): Order => ({
  id: r.id,
  customerId: r.customer_id,
  vehicleId: r.vehicle_id,
  serviceId: r.service_id,
  customerName: r.customer_name,
  vehiclePlate: r.vehicle_plate,
  vehicleLabel: r.vehicle_label,
  category: r.category as VehicleCategory,
  serviceKey: r.service_key,
  extras: Array.isArray(r.extras) ? (r.extras as string[]) : [],
  subtotal: Number(r.subtotal),
  discount: Number(r.discount),
  loyaltyDiscount: Number(r.loyalty_discount),
  loyaltyRewardUsed: r.loyalty_reward_used ?? false,
  total: Number(r.total),
  paymentMethod: (r.payment_method as PaymentMethod) ?? null,
  notes: r.notes ?? "",
  queuePosition: r.queue_position ?? 0,
  durationMinutes: r.duration_minutes ?? 60,
  status: r.status as OrderStatus,
  createdAt: r.created_at,
  startedAt: r.started_at,
  completedAt: r.completed_at,
  actualMinutes: r.actual_minutes,
});

// ============== Store ==============

interface StoreState {
  customers: Customer[];
  vehicles: Vehicle[];
  services: ServiceDef[];
  prices: ServicePrice[];
  orders: Order[];
  stats: ServiceTimeStat[];
  loaded: boolean;
}

let state: StoreState = {
  customers: [],
  vehicles: [],
  services: [],
  prices: [],
  orders: [],
  stats: [],
  loaded: false,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setState(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  emit();
}

function upsertList<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    const copy = list.slice();
    copy[idx] = item;
    return copy;
  }
  return [...list, item];
}

function removeFromList<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

// ============== Loading ==============

let loadPromise: Promise<void> | null = null;
let channels: any[] = [];

export async function loadStore(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const [customers, vehicles, services, prices, orders, stats] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("vehicles").select("*"),
      supabase.from("services").select("*").order("position"),
      supabase.from("service_prices").select("*"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("service_time_stats").select("*"),
    ]);
    setState({
      customers: (customers.data ?? []).map(mapCustomer),
      vehicles: (vehicles.data ?? []).map(mapVehicle),
      services: (services.data ?? []).map(mapService),
      prices: (prices.data ?? []).map(mapPrice),
      orders: (orders.data ?? []).map(mapOrder),
      stats: (stats.data ?? []).map(mapStat),
      loaded: true,
    });
    setupRealtime();
  })();
  return loadPromise;
}

export function resetStore() {
  channels.forEach((c) => supabase.removeChannel(c));
  channels = [];
  loadPromise = null;
  state = { customers: [], vehicles: [], services: [], prices: [], orders: [], stats: [], loaded: false };
  emit();
}

function setupRealtime() {
  const ch = supabase
    .channel("monaco-stream")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
      if (payload.eventType === "DELETE") {
        setState({ orders: removeFromList(state.orders, (payload.old as any).id) });
      } else {
        const o = mapOrder(payload.new as any);
        setState({ orders: upsertList(state.orders, o) });
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, (payload) => {
      if (payload.eventType === "DELETE") {
        setState({ vehicles: removeFromList(state.vehicles, (payload.old as any).id) });
      } else {
        setState({ vehicles: upsertList(state.vehicles, mapVehicle(payload.new as any)) });
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, (payload) => {
      if (payload.eventType === "DELETE") {
        setState({ customers: removeFromList(state.customers, (payload.old as any).id) });
      } else {
        setState({ customers: upsertList(state.customers, mapCustomer(payload.new as any)) });
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "services" }, (payload) => {
      if (payload.eventType === "DELETE") {
        setState({ services: removeFromList(state.services, (payload.old as any).id) });
      } else {
        setState({ services: upsertList(state.services, mapService(payload.new as any)) });
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "service_prices" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const old = payload.old as any;
        setState({
          prices: state.prices.filter(
            (p) => !(p.serviceId === old.service_id && p.category === old.category)
          ),
        });
      } else {
        const np = mapPrice(payload.new as any);
        const filtered = state.prices.filter(
          (p) => !(p.serviceId === np.serviceId && p.category === np.category)
        );
        setState({ prices: [...filtered, np] });
      }
    })
    .subscribe();
  channels.push(ch);
}

// ============== Hooks ==============

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state)
  );
}

export const useCustomers = () => useStore((s) => s.customers);
export const useVehicles = () => useStore((s) => s.vehicles);
export const useServices = () => useStore((s) => s.services);
export const useActiveServices = () => useStore((s) => s.services.filter((x) => x.active));
export const usePrices = () => useStore((s) => s.prices);
export const useOrders = () => useStore((s) => s.orders);
export const useStats = () => useStore((s) => s.stats);
export const useLoaded = () => useStore((s) => s.loaded);

export function getState() {
  return state;
}

// ============== Selectors ==============

export function findCustomerByCpf(cpf: string): Customer | undefined {
  const n = normalizeCpf(cpf);
  return state.customers.find((c) => normalizeCpf(c.cpf) === n);
}

export function findVehicleByPlate(plate: string): Vehicle | undefined {
  const n = normalizePlate(plate);
  return state.vehicles.find((v) => normalizePlate(v.plate) === n);
}

export function vehiclesByCustomer(customerId: string): Vehicle[] {
  return state.vehicles.filter((v) => v.customerId === customerId);
}

export function ordersByVehicle(vehicleId: string): Order[] {
  return state.orders.filter((o) => o.vehicleId === vehicleId);
}

export function ordersByCustomer(customerId: string): Order[] {
  return state.orders.filter((o) => o.customerId === customerId);
}

export function getServiceById(id: string): ServiceDef | undefined {
  return state.services.find((s) => s.id === id);
}

export function getServiceByKey(key: string): ServiceDef | undefined {
  return state.services.find((s) => s.key === key);
}

export function priceFor(serviceId: string, category: VehicleCategory): number {
  return state.prices.find((p) => p.serviceId === serviceId && p.category === category)?.price ?? 0;
}

export function avgServiceMinutes(serviceId: string): number | null {
  const stat = state.stats.find((s) => s.serviceId === serviceId);
  if (!stat || stat.totalWashes < 3) return null;
  return Math.round(stat.sumActualMinutes / stat.totalWashes);
}

// ============== Mutations ==============

export async function upsertCustomer(input: {
  id?: string;
  name: string;
  cpf: string;
  whatsapp: string;
}): Promise<Customer> {
  const payload = {
    id: input.id,
    name: input.name.trim(),
    cpf: normalizeCpf(input.cpf),
    whatsapp: normalizeWhatsapp(input.whatsapp),
  };
  const { data, error } = await supabase
    .from("customers")
    .upsert(payload, { onConflict: "cpf" })
    .select()
    .single();
  if (error) throw error;
  const c = mapCustomer(data);
  setState({ customers: upsertList(state.customers, c) });
  return c;
}

export async function upsertVehicle(input: {
  id?: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: string;
  category: VehicleCategory;
}): Promise<Vehicle> {
  const payload = {
    id: input.id,
    customer_id: input.customerId,
    plate: normalizePlate(input.plate),
    brand: input.brand.trim(),
    model: input.model.trim(),
    color: input.color.trim(),
    year: input.year.trim(),
    category: input.category,
  };
  const { data, error } = await supabase
    .from("vehicles")
    .upsert(payload, { onConflict: "plate" })
    .select()
    .single();
  if (error) throw error;
  const v = mapVehicle(data);
  setState({ vehicles: upsertList(state.vehicles, v) });
  return v;
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
  setState({ customers: removeFromList(state.customers, id) });
}

export async function deleteVehicle(id: string) {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
  setState({ vehicles: removeFromList(state.vehicles, id) });
}

export async function createOrder(input: Omit<Order, "id" | "createdAt" | "status"> & { status?: OrderStatus }): Promise<Order> {
  const payload = {
    customer_id: input.customerId,
    vehicle_id: input.vehicleId,
    service_id: input.serviceId,
    customer_name: input.customerName,
    vehicle_plate: input.vehiclePlate,
    vehicle_label: input.vehicleLabel,
    category: input.category,
    service_key: input.serviceKey,
    extras: input.extras,
    subtotal: input.subtotal,
    discount: input.discount,
    loyalty_discount: input.loyaltyDiscount,
    loyalty_reward_used: input.loyaltyRewardUsed,
    total: input.total,
    payment_method: input.paymentMethod,
    notes: input.notes,
    queue_position: input.queuePosition,
    duration_minutes: input.durationMinutes,
    status: input.status ?? "queued",
  };
  const { data, error } = await supabase.from("orders").insert(payload).select().single();
  if (error) throw error;
  const o = mapOrder(data);
  setState({ orders: upsertList(state.orders, o) });
  return o;
}

export async function startOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  setState({ orders: upsertList(state.orders, mapOrder(data)) });
}

export async function completeOrder(id: string) {
  const order = state.orders.find((o) => o.id === id);
  if (!order) throw new Error("Pedido não encontrado");
  const now = new Date();
  const startedAt = order.startedAt ? new Date(order.startedAt) : now;
  const actualMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));

  // 1) update the order
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      started_at: order.startedAt ?? now.toISOString(),
      actual_minutes: actualMinutes,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  const updated = mapOrder(data);
  setState({ orders: upsertList(state.orders, updated) });

  // 2) loyalty (only qualifying services)
  const svc = getServiceById(order.serviceId);
  if (svc?.loyaltyQualifying) {
    const veh = state.vehicles.find((v) => v.id === order.vehicleId);
    if (veh) {
      let washCount = veh.washCount;
      let rewardAvailable = veh.rewardAvailable;
      let lastRewardDate = veh.lastRewardDate ?? null;
      if (order.loyaltyRewardUsed) {
        washCount = 0;
        rewardAvailable = false;
        lastRewardDate = now.toISOString();
      } else {
        washCount += 1;
        if (washCount >= 10) {
          washCount = 10;
          rewardAvailable = true;
        }
      }
      await supabase
        .from("vehicles")
        .update({
          wash_count: washCount,
          reward_available: rewardAvailable,
          last_reward_date: lastRewardDate,
        })
        .eq("id", veh.id);
      // realtime will refresh; also optimistic:
      setState({
        vehicles: upsertList(state.vehicles, {
          ...veh,
          washCount,
          rewardAvailable,
          lastRewardDate,
        }),
      });
    }
  }

  // 3) update service time stats (upsert)
  const existing = state.stats.find((s) => s.serviceId === order.serviceId);
  const next = {
    service_id: order.serviceId,
    total_washes: (existing?.totalWashes ?? 0) + 1,
    sum_actual_minutes: (existing?.sumActualMinutes ?? 0) + actualMinutes,
  };
  const { data: statData } = await supabase
    .from("service_time_stats")
    .upsert(next, { onConflict: "service_id" })
    .select()
    .single();
  if (statData) {
    const mapped = mapStat(statData);
    const filtered = state.stats.filter((s) => s.serviceId !== mapped.serviceId);
    setState({ stats: [...filtered, mapped] });
  }
  return updated;
}

export async function cancelOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  setState({ orders: upsertList(state.orders, mapOrder(data)) });
}

export async function saveService(input: {
  id?: string;
  key: string;
  title: string;
  description: string;
  durationMinutes: number;
  position: number;
  active: boolean;
  loyaltyQualifying: boolean;
}): Promise<ServiceDef> {
  const payload = {
    id: input.id,
    key: input.key,
    title: input.title,
    description: input.description,
    duration_minutes: input.durationMinutes,
    position: input.position,
    active: input.active,
    loyalty_qualifying: input.loyaltyQualifying,
  };
  const { data, error } = await supabase
    .from("services")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  const s = mapService(data);
  setState({ services: upsertList(state.services, s) });
  return s;
}

export async function deleteService(id: string) {
  // safe-only: block if there's an order referencing this service
  const refs = state.orders.filter((o) => o.serviceId === id);
  if (refs.length > 0) throw new Error("Existem pedidos vinculados — desative em vez de excluir.");
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
  setState({ services: removeFromList(state.services, id) });
}

export async function setPrice(serviceId: string, category: VehicleCategory, price: number) {
  const { data, error } = await supabase
    .from("service_prices")
    .upsert({ service_id: serviceId, category, price }, { onConflict: "service_id,category" })
    .select()
    .single();
  if (error) throw error;
  const np = mapPrice(data);
  const filtered = state.prices.filter(
    (p) => !(p.serviceId === np.serviceId && p.category === np.category)
  );
  setState({ prices: [...filtered, np] });
}
