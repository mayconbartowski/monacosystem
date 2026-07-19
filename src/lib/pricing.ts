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
      servicePrice: 0, extrasPrice, subtotal, loyaltyDiscount: 0,
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

export function getLoyaltyForVehicle(vehicle: Vehicle | null | undefined): LoyaltyInfo {
  const washCount = vehicle?.washCount ?? 0;
  const rewardAvailable = !!vehicle?.rewardAvailable;
  const untilReward = rewardAvailable ? 0 : Math.max(0, LOYALTY_CYCLE_SIZE - washCount);
  return { washCount, untilReward, rewardAvailable, isRewardPurchase: rewardAvailable };
}

export function emptyLoyalty(): LoyaltyInfo {
  return { washCount: 0, untilReward: LOYALTY_CYCLE_SIZE, rewardAvailable: false, isRewardPurchase: false };
}

export function activeQueue(orders: Order[]): Order[] {
  return orders
    .filter((o) => o.status === "queued" || o.status === "in_progress")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
export function totalQueueWait(orders: Order[]): number {
  return activeQueue(orders).reduce((a, o) => a + o.durationMinutes, 0);
}
export function estimatedNewWait(orders: Order[]): number {
  return totalQueueWait(orders);
}

/* ---------------- Payment / financial helpers ---------------- */

export function isOrderPaid(o: Order): boolean {
  if (o.paymentStatus === "paid") return true;
  return false;
}

/** Data financeira a considerar em relatórios (paid_at; retro-compat: completed/created). */
export function orderFinancialDate(o: Order): string | null {
  if (!isOrderPaid(o)) return null;
  return o.paidAt ?? o.completedAt ?? o.createdAt;
}

/** Filtra apenas ordens de venda contabilizáveis (particular pagas). */
export function paidCustomerRevenue(orders: Order[], fromMs: number, toMs: number): Order[] {
  return orders.filter((o) => {
    if (!isOrderPaid(o)) return false;
    if (o.orderSource === "partner") return false; // partners não geram receita individual
    const d = orderFinancialDate(o);
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= fromMs && t <= toMs;
  });
}

/* ---------------- Goals ---------------- */

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

/** Segunda-feira 00:00 da semana atual até domingo 23:59. */
export function currentWeekRange(now = new Date()): { from: Date; to: Date } {
  const day = now.getDay(); // 0=Sun … 6=Sat
  const diffToMonday = (day + 6) % 7;
  const monday = startOfDay(new Date(now));
  monday.setDate(monday.getDate() - diffToMonday);
  const sunday = endOfDay(new Date(monday));
  sunday.setDate(sunday.getDate() + 6);
  return { from: monday, to: sunday };
}

export function currentMonthRange(now = new Date()): { from: Date; to: Date } {
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { from, to };
}

export function daysInMonth(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

export interface GoalCard {
  period: "Dia" | "Semana" | "Mês";
  goal: number;
  earned: number;
  remaining: number;
  progress: number; // 0..1 (cap 1)
  surpassedBy: number;
}

export function computeGoals(orders: Order[], monthlyGoal: number, now = new Date()) {
  const dGoal = monthlyGoal / daysInMonth(now);
  const wGoal = dGoal * 7;
  const mGoal = monthlyGoal;

  const dayFrom = startOfDay(now).getTime();
  const dayTo = endOfDay(now).getTime();
  const week = currentWeekRange(now);
  const month = currentMonthRange(now);

  const sum = (fromMs: number, toMs: number) =>
    paidCustomerRevenue(orders, fromMs, toMs).reduce((a, o) => a + o.total, 0);

  const make = (period: GoalCard["period"], goal: number, earned: number): GoalCard => {
    const remaining = Math.max(0, goal - earned);
    const surpassedBy = Math.max(0, earned - goal);
    const progress = goal > 0 ? Math.min(1, earned / goal) : 0;
    return { period, goal, earned, remaining, progress, surpassedBy };
  };

  return {
    day: make("Dia", dGoal, sum(dayFrom, dayTo)),
    week: make("Semana", wGoal, sum(week.from.getTime(), week.to.getTime())),
    month: make("Mês", mGoal, sum(month.from.getTime(), month.to.getTime())),
  };
}
