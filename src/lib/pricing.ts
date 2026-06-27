import {
  EXTRAS, ExtraKey, LOYALTY_CYCLE_SIZE, LOYALTY_DISCOUNT,
  LoyaltyInfo, Order, PriceTable, ServiceKey, SERVICES, Vehicle, VehicleCategory,
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

/** Calcula o status de fidelidade a partir do veículo (placa). */
export function getLoyaltyForVehicle(vehicle: Vehicle | null | undefined): LoyaltyInfo {
  const washCount = vehicle?.washCount ?? 0;
  const rewardAvailable = !!vehicle?.rewardAvailable;
  const untilReward = rewardAvailable ? 0 : Math.max(0, LOYALTY_CYCLE_SIZE - washCount);
  return {
    washCount,
    untilReward,
    rewardAvailable,
    isRewardPurchase: rewardAvailable,
  };
}

/** Backward-compat: hidrata um LoyaltyInfo "vazio". */
export function emptyLoyalty(): LoyaltyInfo {
  return { washCount: 0, untilReward: LOYALTY_CYCLE_SIZE, rewardAvailable: false, isRewardPurchase: false };
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
