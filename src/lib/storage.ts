import {
  Customer, LOYALTY_CYCLE_SIZE, Order, PriceTable, DEFAULT_PRICES, Vehicle,
  ServiceOverride, SERVICES, ServiceKey,
} from "./domain";

const K = {
  customers: "monaco.customers",
  vehicles: "monaco.vehicles",
  orders: "monaco.orders",
  prices: "monaco.prices",
  services: "monaco.services",
  loyaltyMigration: "monaco.loyaltyMigratedV2",
};

/** Migração V2: zera fidelidade. Roda 1x por navegador. */
function runLoyaltyMigrationV2() {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(K.loyaltyMigration) === "done") return;
    const raw = localStorage.getItem(K.vehicles);
    if (raw) {
      const list = JSON.parse(raw) as Vehicle[];
      const migrated = list.map((v) => ({
        ...v,
        washCount: 0,
        rewardAvailable: false,
        lastRewardDate: undefined,
      }));
      localStorage.setItem(K.vehicles, JSON.stringify(migrated));
    }
    localStorage.setItem(K.loyaltyMigration, "done");
  } catch { /* ignore */ }
}
runLoyaltyMigrationV2();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultOverrides(): ServiceOverride[] {
  return SERVICES.map((s, i) => ({
    key: s.key,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    icon: s.icon,
    active: true,
    order: i,
  }));
}

export const db = {
  // customers
  listCustomers: (): Customer[] => read(K.customers, []),
  saveCustomers: (list: Customer[]) => write(K.customers, list),
  findCustomerByCpf: (cpf: string): Customer | undefined =>
    db.listCustomers().find((c) => normalizeCpf(c.cpf) === normalizeCpf(cpf)),
  upsertCustomer: (c: Customer): Customer => {
    const list = db.listCustomers();
    const idx = list.findIndex((x) => x.id === c.id);
    if (idx >= 0) list[idx] = c; else list.push(c);
    db.saveCustomers(list);
    return c;
  },
  deleteCustomer: (id: string) => {
    db.saveCustomers(db.listCustomers().filter((c) => c.id !== id));
    db.saveVehicles(db.listVehicles().filter((v) => v.customerId !== id));
  },

  // vehicles
  listVehicles: (): Vehicle[] => read(K.vehicles, []),
  saveVehicles: (list: Vehicle[]) => write(K.vehicles, list),
  findVehicleByPlate: (plate: string): Vehicle | undefined =>
    db.listVehicles().find((v) => normalizePlate(v.plate) === normalizePlate(plate)),
  upsertVehicle: (v: Vehicle): Vehicle => {
    const list = db.listVehicles();
    const idx = list.findIndex((x) => x.id === v.id);
    if (idx >= 0) list[idx] = v; else list.push(v);
    db.saveVehicles(list);
    return v;
  },

  // orders
  listOrders: (): Order[] => read(K.orders, []),
  saveOrders: (list: Order[]) => write(K.orders, list),
  addOrder: (o: Order) => {
    const list = db.listOrders();
    list.push(o);
    db.saveOrders(list);
  },
  updateOrder: (id: string, patch: Partial<Order>) => {
    const list = db.listOrders();
    const idx = list.findIndex((o) => o.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      db.saveOrders(list);
    }
  },
  deleteOrder: (id: string) => {
    db.saveOrders(db.listOrders().filter((o) => o.id !== id));
  },

  // prices
  getPrices: (): PriceTable => read(K.prices, DEFAULT_PRICES),
  savePrices: (p: PriceTable) => write(K.prices, p),

  // services (overlay editável)
  listServiceOverrides: (): ServiceOverride[] => {
    const raw = read<ServiceOverride[]>(K.services, []);
    if (!raw.length) {
      const seed = defaultOverrides();
      write(K.services, seed);
      return seed;
    }
    // garantir 1 entry por chave conhecida
    const byKey = new Map(raw.map((o) => [o.key, o]));
    const merged = defaultOverrides().map((d) => ({ ...d, ...byKey.get(d.key) }));
    return merged;
  },
  saveServiceOverrides: (list: ServiceOverride[]) => write(K.services, list),
  updateServiceOverride: (key: ServiceKey, patch: Partial<ServiceOverride>) => {
    const list = db.listServiceOverrides();
    const idx = list.findIndex((o) => o.key === key);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      db.saveServiceOverrides(list);
    }
  },

  applyLoyaltyOnCompletion: (order: Order): Vehicle | undefined => {
    const vehicles = db.listVehicles();
    const idx = vehicles.findIndex((v) => v.id === order.vehicleId);
    if (idx < 0) return undefined;
    const v = { ...vehicles[idx] };
    if (order.loyaltyRewardUsed) {
      v.washCount = 0;
      v.rewardAvailable = false;
      v.lastRewardDate = order.completedAt || new Date().toISOString();
    } else {
      v.washCount = (v.washCount ?? 0) + 1;
      if (v.washCount >= LOYALTY_CYCLE_SIZE) {
        v.washCount = LOYALTY_CYCLE_SIZE;
        v.rewardAvailable = true;
      }
    }
    vehicles[idx] = v;
    db.saveVehicles(vehicles);
    return v;
  },

  /** Pesquisa cruzada cliente/placa para o live search do PDV. */
  searchCustomers: (q: string, limit = 8): {
    customer: Customer;
    vehicles: Vehicle[];
    matchedBy: "name" | "cpf" | "plate";
    matchedPlate?: string;
  }[] => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const digits = s.replace(/\D/g, "");
    const plateNorm = normalizePlate(s);
    const customers = db.listCustomers();
    const vehicles = db.listVehicles();
    const results: { customer: Customer; vehicles: Vehicle[]; matchedBy: "name" | "cpf" | "plate"; matchedPlate?: string }[] = [];
    const seen = new Set<string>();

    for (const c of customers) {
      const vs = vehicles.filter((v) => v.customerId === c.id);
      if (c.name.toLowerCase().includes(s)) {
        if (!seen.has(c.id)) { results.push({ customer: c, vehicles: vs, matchedBy: "name" }); seen.add(c.id); }
        continue;
      }
      if (digits.length >= 3 && normalizeCpf(c.cpf).includes(digits)) {
        if (!seen.has(c.id)) { results.push({ customer: c, vehicles: vs, matchedBy: "cpf" }); seen.add(c.id); }
        continue;
      }
      const pv = vs.find((v) => normalizePlate(v.plate).includes(plateNorm) && plateNorm.length >= 2);
      if (pv) {
        if (!seen.has(c.id)) {
          results.push({ customer: c, vehicles: vs, matchedBy: "plate", matchedPlate: pv.plate });
          seen.add(c.id);
        }
      }
      if (results.length >= limit) break;
    }
    return results.slice(0, limit);
  },
};

export function normalizeCpf(cpf: string): string {
  return (cpf || "").replace(/\D/g, "");
}
export function formatCpf(cpf: string): string {
  const v = normalizeCpf(cpf).slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function normalizePlate(p: string): string {
  return (p || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}
export function formatPlate(p: string): string {
  const v = normalizePlate(p).slice(0, 7);
  if (v.length <= 3) return v;
  return v.slice(0, 3) + "-" + v.slice(3);
}
export function formatPhone(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatDuration(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
