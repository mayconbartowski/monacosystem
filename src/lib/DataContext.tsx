import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Customer, Vehicle, Order, ServiceOverride, PriceTable, DEFAULT_PRICES } from "@/lib/domain";
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<ServiceOverride[]>([]);
  const [prices, setPrices] = useState<PriceTable>(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const reloadTimer = useRef<number | null>(null);

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

  const scheduleRefresh = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => { void doFetch(); }, 120);
  }, [doFetch]);

  // initial fetch + realtime
  useEffect(() => {
    if (!session) {
      setLoading(false);
      setCustomers([]); setVehicles([]); setOrders([]); setServices([]);
      setPrices(DEFAULT_PRICES);
      return;
    }
    setLoading(true);
    void doFetch();

    const channel = supabase
      .channel("monaco-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_prices" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [session, doFetch, scheduleRefresh]);

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
