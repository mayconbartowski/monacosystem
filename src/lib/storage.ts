import {
  Customer, LOYALTY_CYCLE_SIZE, Order, PriceTable, DEFAULT_PRICES, Vehicle,
} from "./domain";

const K = {
  customers: "monaco.customers",
  vehicles: "monaco.vehicles",
  orders: "monaco.orders",
  prices: "monaco.prices",
  loyaltyMigration: "monaco.loyaltyMigratedV2",
};

/**
 * Migração V2: o programa de fidelidade passou de CPF para PLACA.
 * Zera wash_count de todos os veículos e descarta o estado anterior.
 * Roda uma única vez por navegador.
 */
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
  } catch {
    /* ignore */
  }
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

  // prices
  getPrices: (): PriceTable => read(K.prices, DEFAULT_PRICES),
  savePrices: (p: PriceTable) => write(K.prices, p),
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
