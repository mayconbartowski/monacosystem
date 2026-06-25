import {
  EXTRAS, ExtraKey, LOYALTY_DISCOUNT, LoyaltyInfo, Order, PriceTable,
  ServiceKey, SERVICES, VehicleCategory,
} from "./domain";

export function getServiceDef(key: ServiceKey) {
  return SERVICES.find((s) => s.key === key)!;
}

export function calcDuration(service: ServiceKey | null, extras: ExtraKey[]): number {
  const s = service ? getServiceDef(service).durationMinutes : 0;
  const e = extras.reduce((acc, k) => acc + EXTRAS[k].durationMinutes, 0);
  return s + e;
}

export interface Totals {
  servicePrice: number;
  extrasPrice: number;
  subtotal: number;
  loyaltyDiscount: number;
  manualDiscount: number;
  total: number;
}

export function calcTotals(
  prices: PriceTable,
  category: VehicleCategory | null,
  service: ServiceKey | null,
  extras: ExtraKey[],
  manualDiscount: number,
  loyalty: LoyaltyInfo | null,
): Totals {
  if (!category || !service) {
    const extrasPrice = category ? extras.reduce((a, k) => a + (prices[category][k] || 0), 0) : 0;
    const subtotal = extrasPrice;
    return {
      servicePrice: 0,
      extrasPrice,
      subtotal,
      loyaltyDiscount: 0,
      manualDiscount: Math.min(manualDiscount, subtotal),
      total: Math.max(0, subtotal - Math.min(manualDiscount, subtotal)),
    };
  }
  const servicePrice = prices[category][service] || 0;
  const extrasPrice = extras.reduce((a, k) => a + (prices[category][k] || 0), 0);
  const subtotal = servicePrice + extrasPrice;

  const loyaltyPct = loyalty?.isRewardPurchase ? LOYALTY_DISCOUNT[service] : 0;
  const loyaltyDiscount = +(servicePrice * loyaltyPct).toFixed(2);
  const afterLoyalty = subtotal - loyaltyDiscount;
  const manual = Math.min(Math.max(0, manualDiscount), afterLoyalty);
  const total = Math.max(0, afterLoyalty - manual);
  return { servicePrice, extrasPrice, subtotal, loyaltyDiscount, manualDiscount: manual, total };
}

export function getLoyalty(completed: number): LoyaltyInfo {
  // every 10th completed order is the reward
  const inCycle = completed % 10; // 0..9 (completed)
  // next purchase index in cycle = inCycle + 1; reward when that == 10
  const isRewardPurchase = inCycle === 9;
  const untilReward = isRewardPurchase ? 0 : 9 - inCycle;
  return { completed, inCycle, untilReward, isRewardPurchase };
}

export function activeQueue(orders: Order[]): Order[] {
  return orders
    .filter((o) => o.status === "queued" || o.status === "in_progress")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** total minutes remaining (sum of all active orders) */
export function totalQueueWait(orders: Order[]): number {
  return activeQueue(orders).reduce((a, o) => a + o.durationMinutes, 0);
}

/** estimated wait for a NEW order joining now */
export function estimatedNewWait(orders: Order[]): number {
  return totalQueueWait(orders);
}
