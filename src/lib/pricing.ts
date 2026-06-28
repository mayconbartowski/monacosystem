import {
  Order, ServiceDef, ServicePrice, Vehicle, VehicleCategory,
  avgServiceMinutes, getServiceById, priceFor,
} from "./dataStore";

// ============== Extras (constants, not in DB) ==============

export type ExtraKey = "Polimento" | "Enceramento" | "Excessos";
export const EXTRA_KEYS: ExtraKey[] = ["Polimento", "Enceramento", "Excessos"];

interface ExtraDef {
  name: string;
  durationMinutes: number;
  description: string;
  prices: Record<VehicleCategory, number>;
}

export const EXTRAS: Record<ExtraKey, ExtraDef> = {
  Polimento: {
    name: "Polimento",
    durationMinutes: 120,
    description: "Polimento técnico para remover micro riscos.",
    prices: { Hatch: 400, Sedan: 400, SUV: 650, Picape: 800, Luxo: 800 },
  },
  Enceramento: {
    name: "Enceramento",
    durationMinutes: 30,
    description: "Aplicação de cera de proteção.",
    prices: { Hatch: 50, Sedan: 50, SUV: 80, Picape: 110, Luxo: 110 },
  },
  Excessos: {
    name: "Excessos",
    durationMinutes: 20,
    description: "Remoção de sujeira pesada / barro / areia.",
    prices: { Hatch: 40, Sedan: 40, SUV: 60, Picape: 60, Luxo: 60 },
  },
};

export const LOYALTY_DISCOUNT_BY_KEY: Record<string, number> = {
  Essencial: 1.0,
  Premium: 0.5,
  Golden: 0.25,
  Platinum: 0,
};
export const LOYALTY_CYCLE_SIZE = 10;

// ============== Loyalty ==============

export interface LoyaltyInfo {
  washCount: number;
  untilReward: number;
  rewardAvailable: boolean;
  isRewardPurchase: boolean;
}

export function getLoyaltyForVehicle(v: Vehicle | null | undefined): LoyaltyInfo {
  const washCount = v?.washCount ?? 0;
  const rewardAvailable = !!v?.rewardAvailable;
  const untilReward = rewardAvailable ? 0 : Math.max(0, LOYALTY_CYCLE_SIZE - washCount);
  return { washCount, untilReward, rewardAvailable, isRewardPurchase: rewardAvailable };
}

// ============== Duration ==============

export function calcDuration(service: ServiceDef | null, extras: ExtraKey[]): number {
  const s = service?.durationMinutes ?? 0;
  const e = extras.reduce((a, k) => a + EXTRAS[k].durationMinutes, 0);
  return s + e;
}

// ============== Totals ==============

export interface Totals {
  servicePrice: number;
  extrasPrice: number;
  subtotal: number;
  loyaltyDiscount: number;
  manualDiscount: number;
  total: number;
}

export function calcTotals(
  category: VehicleCategory | null,
  service: ServiceDef | null,
  extras: ExtraKey[],
  manualDiscount: number,
  loyalty: LoyaltyInfo
): Totals {
  if (!category) {
    return { servicePrice: 0, extrasPrice: 0, subtotal: 0, loyaltyDiscount: 0, manualDiscount: 0, total: 0 };
  }
  const extrasPrice = extras.reduce((a, k) => a + (EXTRAS[k].prices[category] ?? 0), 0);
  const servicePrice = service ? priceFor(service.id, category) : 0;
  const subtotal = servicePrice + extrasPrice;
  const loyaltyPct =
    loyalty.isRewardPurchase && service ? LOYALTY_DISCOUNT_BY_KEY[service.key] ?? 0 : 0;
  const loyaltyDiscount = +(servicePrice * loyaltyPct).toFixed(2);
  const afterLoyalty = subtotal - loyaltyDiscount;
  const manual = Math.min(Math.max(0, manualDiscount), afterLoyalty);
  const total = Math.max(0, afterLoyalty - manual);
  return { servicePrice, extrasPrice, subtotal, loyaltyDiscount, manualDiscount: manual, total };
}

// ============== Queue analytics ==============

export function activeQueue(orders: Order[]): Order[] {
  return orders
    .filter((o) => o.status === "queued" || o.status === "in_progress")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function estimatedNewWait(orders: Order[]): number {
  return activeQueue(orders).reduce((acc, o) => {
    const svc = getServiceById(o.serviceId);
    const avg = svc ? avgServiceMinutes(svc.id) : null;
    return acc + (avg ?? o.durationMinutes);
  }, 0);
}

export function expectedMinutesFor(order: Order): number {
  const avg = avgServiceMinutes(order.serviceId);
  return avg ?? order.durationMinutes;
}
