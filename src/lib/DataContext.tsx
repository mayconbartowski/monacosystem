import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  Customer, Vehicle, Order, ServiceOverride, PriceTable, DEFAULT_PRICES,
  ServiceKey, ServiceIconKey, SERVICES, VehicleCategory,
} from "@/lib/domain";
import { fetchAll } from "@/services/data";
import { useAuth } from "@/lib/authContext";
import { normalizeCpf, normalizePlate } from "@/lib/storage";

interface DataState {
  customers: Customer[];
  vehicles: Vehicle[];
  orders: Order[];
  services: ServiceOverride[];
  prices: PriceTable;
  loading: boolean;
  refresh: () => Promise<void>;
  searchCustomers: (q: string, limit?: number) => {
    customer: Customer; vehicles: Vehicle[];
    matchedBy: "name" | "cpf" | "plate"; matchedPlate?: string;
  }[];
  findCustomerByCpf: (cpf: string) => Customer | undefined;
  findVehicleByPlate: (plate: string) => Vehicle | undefined;
}

const Ctx = createContext<DataState | null>(null);

/* -------- row → domain mappers (kept in sync with services/data.ts) -------- */
type CustomerRow = { id: string; name: string; cpf: string; whatsapp: string; created_at: string; };
type VehicleRow = {
  id: string; customer_id: string; plate: string; brand: string; model: string; color: string; year: string;
  category: VehicleCategory; wash_count: number; reward_available: boolean; last_reward_date: string | null;
};
type OrderRow = {
  id: string; customer_id: string; customer_name: string; vehicle_id: string; vehicle_plate: string;
  vehicle_label: string; category: VehicleCategory; service_id: string; service_key: string; extras: unknown;
  subtotal: number; discount: number; loyalty_discount: number; loyalty_reward_used: boolean; total: number;
  payment_method: "Crédito" | "Débito" | "Pix" | null;
  notes: string; queue_position: number; duration_minutes: number;
  status: "queued" | "in_progress" | "completed" | "cancelled" | "delivered";
  created_at: string; started_at: string | null; completed_at: string | null;
};
type ServiceRow = {
  id: string; key: string; title: string; description: string;
  duration_minutes: number; position: number; active: boolean;
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
function mapOrder(r: OrderRow): Order {
  return {
    id: r.id, customerId: r.customer_id, customerName: r.customer_name, customerCpf: "",
    vehicleId: r.vehicle_id, vehiclePlate: r.vehicle_plate, vehicleLabel: r.vehicle_label,
    category: r.category, service: r.service_key as ServiceKey, serviceId: r.service_id,
    extras: Array.isArray(r.extras) ? (r.extras as any) : [],
    subtotal: Number(r.subtotal), discount: Number(r.discount),
    loyaltyDiscount: Number(r.loyalty_discount), loyaltyRewardUsed: !!r.loyalty_reward_used,
    total: Number(r.total), paymentMethod: r.payment_method,
    notes: r.notes || "", queuePosition: r.queue_position, durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
    startedAt: r.started_at ?? undefined, completedAt: r.completed_at ?? undefined,
    status: r.status,
  };
}
function mapService(s: ServiceRow): ServiceOverride {
  return {
    id: s.id,
    key: s.key as ServiceKey,
    name: s.title,
    description: s.description,
    durationMinutes: s.duration_minutes,
    active: s.active,
    order: s.position,
    icon: SERVICES.find((d) => d.key === s.key)?.icon as ServiceIconKey,
  };
}

/* upsert helper for lists keyed by id */
function upsertById<T extends { id?: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i < 0) return [row, ...list];
  const next = list.slice();
  next[i] = row;
  return next;
}
function removeById<T extends { id?: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

/* recompute totalOrders per customer from orders list */
function recomputeTotals(customers: Customer[], orders: Order[]): Customer[] {
  const totals = new Map<string, number>();
  orders.forEach((o) => totals.set(o.customerId, (totals.get(o.customerId) ?? 0) + 1));
  let changed = false;
  const next = customers.map((c) => {
    const t = totals.get(c.id) ?? 0;
    if (t === c.totalOrders) return c;
    changed = true;
    return { ...c, totalOrders: t };
  });
  return changed ? next : customers;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<ServiceOverride[]>([]);
  const [prices, setPrices] = useState<PriceTable>(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const channelsRef = useRef<RealtimeChannel[]>([]);

  const doFetch = useCallback(async () => {
    try {
      const all = await fetchAll();
      setCustomers(all.customers);
      setVehicles(all.vehicles);
      setOrders(all.orders);
      setServices(all.services);
      setPrices(all.prices);
    } catch (e) {
      console.error("[Monaco] fetchAll error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  /* refetch just the prices table (small, needs join with services) */
  const refetchPrices = useCallback(async () => {
    try {
      const { data: sps } = await supabase.from("service_prices").select("*");
      const { data: ss } = await supabase.from("services").select("id, key");
      const byId = new Map<string, ServiceKey>();
      (ss ?? []).forEach((s: any) => byId.set(s.id, s.key as ServiceKey));
      const next: PriceTable = JSON.parse(JSON.stringify(DEFAULT_PRICES));
      (sps ?? []).forEach((p: any) => {
        const k = byId.get(p.service_id);
        if (!k) return;
        next[p.category as VehicleCategory][k] = Number(p.price);
      });
      setPrices(next);
    } catch (e) {
      console.error("[Monaco] refetchPrices error", e);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      setCustomers([]); setVehicles([]); setOrders([]); setServices([]);
      setPrices(DEFAULT_PRICES);
      return;
    }

    setLoading(true);
    void doFetch();

    // Ensure realtime uses the current access token
    void supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
    });

    /* ---- Realtime handlers (granular, no polling / no refetch) ---- */
    const onCustomers = (p: RealtimePostgresChangesPayload<CustomerRow>) => {
      if (p.eventType === "DELETE") {
        const id = (p.old as any)?.id;
        if (id) setCustomers((prev) => removeById(prev, id));
        return;
      }
      const row = p.new as CustomerRow & { active?: boolean };
      // Soft delete: cliente inativo sai da listagem
      if (row && row.active === false) {
        setCustomers((prev) => removeById(prev, row.id));
        return;
      }
      setCustomers((prev) => {
        const existing = prev.find((c) => c.id === row.id);
        return upsertById(prev, mapCustomer(row, existing?.totalOrders ?? 0));
      });
    };

    const onVehicles = (p: RealtimePostgresChangesPayload<VehicleRow>) => {
      if (p.eventType === "DELETE") {
        const id = (p.old as any)?.id;
        if (id) setVehicles((prev) => removeById(prev, id));
        return;
      }
      setVehicles((prev) => upsertById(prev, mapVehicle(p.new as VehicleRow)));
    };

    const onOrders = (p: RealtimePostgresChangesPayload<OrderRow>) => {
      if (p.eventType === "DELETE") {
        const id = (p.old as any)?.id;
        if (!id) return;
        setOrders((prev) => {
          const next = removeById(prev, id);
          setCustomers((cs) => recomputeTotals(cs, next));
          return next;
        });
        return;
      }
      const mapped = mapOrder(p.new as OrderRow);
      setOrders((prev) => {
        const next = upsertById(prev, mapped);
        if (p.eventType === "INSERT") {
          setCustomers((cs) => recomputeTotals(cs, next));
        }
        return next;
      });
    };

    const onServices = (p: RealtimePostgresChangesPayload<ServiceRow>) => {
      if (p.eventType === "DELETE") {
        const id = (p.old as any)?.id;
        if (id) setServices((prev) => removeById(prev, id));
        return;
      }
      const mapped = mapService(p.new as ServiceRow);
      setServices((prev) => {
        const next = upsertById(prev, mapped);
        return next.sort((a, b) => a.order - b.order);
      });
    };

    /* One channel per table = more resilient than multiplexing */
    const mk = (name: string, table: string, handler: (p: any) => void) =>
      supabase
        .channel(`monaco:${name}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, handler)
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn(`[Monaco] realtime ${table}: ${status}`);
          }
        });

    channelsRef.current = [
      mk("customers", "customers", onCustomers),
      mk("vehicles", "vehicles", onVehicles),
      mk("orders", "orders", onOrders),
      mk("services", "services", onServices),
      mk("service_prices", "service_prices", () => void refetchPrices()),
    ];

    return () => {
      for (const ch of channelsRef.current) supabase.removeChannel(ch);
      channelsRef.current = [];
    };
  }, [session, doFetch, refetchPrices]);

  const findCustomerByCpf = useCallback(
    (cpf: string) => {
      const k = normalizeCpf(cpf);
      return customers.find((c) => normalizeCpf(c.cpf) === k);
    },
    [customers]
  );

  const findVehicleByPlate = useCallback(
    (plate: string) => {
      const k = normalizePlate(plate);
      return vehicles.find((v) => normalizePlate(v.plate) === k);
    },
    [vehicles]
  );

  const searchCustomers = useCallback(
    (q: string, limit = 8) => {
      const s = q.trim().toLowerCase();
      if (!s) return [];
      const digits = s.replace(/\D/g, "");
      const plateNorm = normalizePlate(s);
      const results: {
        customer: Customer; vehicles: Vehicle[];
        matchedBy: "name" | "cpf" | "plate"; matchedPlate?: string;
      }[] = [];
      const seen = new Set<string>();
      for (const c of customers) {
        const vs = vehicles.filter((v) => v.customerId === c.id);
        if (c.name.toLowerCase().includes(s)) {
          if (!seen.has(c.id)) { results.push({ customer: c, vehicles: vs, matchedBy: "name" }); seen.add(c.id); }
        } else if (digits.length >= 3 && normalizeCpf(c.cpf).includes(digits)) {
          if (!seen.has(c.id)) { results.push({ customer: c, vehicles: vs, matchedBy: "cpf" }); seen.add(c.id); }
        } else {
          const pv = plateNorm.length >= 2 && vs.find((v) => normalizePlate(v.plate).includes(plateNorm));
          if (pv) {
            if (!seen.has(c.id)) {
              results.push({ customer: c, vehicles: vs, matchedBy: "plate", matchedPlate: pv.plate });
              seen.add(c.id);
            }
          }
        }
        if (results.length >= limit) break;
      }
      return results.slice(0, limit);
    },
    [customers, vehicles]
  );

  const value = useMemo<DataState>(() => ({
    customers, vehicles, orders, services, prices, loading,
    refresh: doFetch, searchCustomers, findCustomerByCpf, findVehicleByPlate,
  }), [customers, vehicles, orders, services, prices, loading, doFetch, searchCustomers, findCustomerByCpf, findVehicleByPlate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be inside DataProvider");
  return v;
}
