export type VehicleCategory = "Hatch" | "Sedan" | "SUV" | "Picape" | "Luxo";

export const VEHICLE_CATEGORIES: VehicleCategory[] = ["Hatch", "Sedan", "SUV", "Picape", "Luxo"];

export type ServiceKey = "Essencial" | "Premium" | "Golden" | "Platinum";
export type ExtraKey = "Polimento" | "Enceramento" | "Excessos";

export const SERVICE_KEYS: ServiceKey[] = ["Essencial", "Premium", "Golden", "Platinum"];
export const EXTRA_KEYS: ExtraKey[] = ["Polimento", "Enceramento", "Excessos"];

export type ServiceIconKey = "sparkles" | "droplets" | "gem" | "crown" | "shield" | "star" | "car" | "wrench";

export interface ServiceDef {
  key: ServiceKey;
  name: string;
  durationMinutes: number;
  description: string;
  included: string[];
  icon?: ServiceIconKey;
}

export const SERVICES: ServiceDef[] = [
  {
    key: "Essencial",
    name: "Lavagem Essencial",
    durationMinutes: 60,
    description: "Lavagem externa completa com produtos premium.",
    included: ["Lavagem externa", "Pneus pretos", "Secagem com microfibra", "Aromatizante"],
    icon: "droplets",
  },
  {
    key: "Premium",
    name: "Lavagem Premium",
    durationMinutes: 120,
    description: "Cuidado completo interno e externo para o dia a dia.",
    included: ["Tudo da Essencial", "Aspiração completa", "Limpeza de painel e bancos", "Pretinho nos plásticos"],
    icon: "sparkles",
  },
  {
    key: "Golden",
    name: "Lavagem Golden",
    durationMinutes: 120,
    description: "Detalhamento avançado com proteção de superfícies.",
    included: ["Tudo da Premium", "Higienização de couro / tecido", "Cera líquida de proteção", "Limpeza de motor leve"],
    icon: "shield",
  },
  {
    key: "Platinum",
    name: "Lavagem Platinum Monaco",
    durationMinutes: 240,
    description: "Experiência Monaco completa. Detalhamento profissional.",
    included: [
      "Tudo da Golden",
      "Descontaminação de pintura",
      "Polimento técnico leve",
      "Cera de carnaúba premium",
      "Cristalização de vidros",
    ],
    icon: "crown",
  },
];

export const EXTRAS: Record<ExtraKey, { name: string; durationMinutes: number; description: string }> = {
  Polimento:   { name: "Polimento",   durationMinutes: 120, description: "Polimento técnico para remover micro riscos." },
  Enceramento: { name: "Enceramento", durationMinutes: 30,  description: "Aplicação de cera de proteção." },
  Excessos:    { name: "Excessos",    durationMinutes: 20,  description: "Remoção de sujeira pesada / barro / areia." },
};

export type PriceTable = Record<VehicleCategory, Record<ServiceKey | ExtraKey, number>>;

export const DEFAULT_PRICES: PriceTable = {
  Hatch:  { Essencial: 150, Premium: 220, Golden: 320, Platinum: 450, Polimento: 400, Enceramento: 50,  Excessos: 40 },
  Sedan:  { Essencial: 170, Premium: 240, Golden: 350, Platinum: 490, Polimento: 400, Enceramento: 50,  Excessos: 40 },
  SUV:    { Essencial: 210, Premium: 300, Golden: 430, Platinum: 590, Polimento: 650, Enceramento: 80,  Excessos: 60 },
  Picape: { Essencial: 320, Premium: 450, Golden: 650, Platinum: 890, Polimento: 800, Enceramento: 110, Excessos: 60 },
  Luxo:   { Essencial: 320, Premium: 450, Golden: 650, Platinum: 890, Polimento: 800, Enceramento: 110, Excessos: 60 },
};

export interface ServiceOverride {
  key: ServiceKey;
  /** UUID do registro em public.services */
  id?: string;
  name?: string;
  description?: string;
  durationMinutes?: number;
  icon?: ServiceIconKey;
  active: boolean;
  order: number;
}

export interface Customer {
  id: string;
  name: string;
  cpf: string;
  /** WhatsApp do cliente (obrigatório). */
  phone: string;
  totalOrders: number;
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
  lastRewardDate?: string;
}

export type PaymentMethod = "Crédito" | "Débito" | "Pix";

export type OrderStatus = "queued" | "in_progress" | "completed" | "cancelled" | "delivered";

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerCpf: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleLabel: string;
  category: VehicleCategory;
  service: ServiceKey;
  serviceId: string;
  extras: ExtraKey[];
  subtotal: number;
  discount: number;
  loyaltyDiscount: number;
  loyaltyRewardUsed: boolean;
  total: number;
  paymentMethod: PaymentMethod | null;
  notes: string;
  queuePosition: number;
  durationMinutes: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: OrderStatus;
}

export interface LoyaltyInfo {
  washCount: number;
  untilReward: number;
  rewardAvailable: boolean;
  isRewardPurchase: boolean;
}

export const LOYALTY_DISCOUNT: Record<ServiceKey, number> = {
  Essencial: 1.0,
  Premium: 0.5,
  Golden: 0.25,
  Platinum: 0,
};

export const LOYALTY_QUALIFYING_SERVICES: ServiceKey[] = ["Essencial", "Premium", "Golden", "Platinum"];

export const LOYALTY_CYCLE_SIZE = 10;

// ---------------- Auth ----------------
// Mantemos o nome 'gerente' no UI, mas internamente usamos 'gerencia' (enum do banco).
export type Role = "atendimento" | "lavajato" | "gerencia";

export interface AppAccount {
  id: string;
  role: Role;
  username: string;
  authUserId: string;
}

export interface Session {
  role: Role;
  login: string;
  userId: string;
  loggedAt: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  atendimento: "Atendimento",
  lavajato: "Lava-jato",
  gerencia: "Gerente",
};

export interface Permissions {
  pdv: boolean;
  queue: boolean;
  customersView: boolean;
  customersEdit: boolean;
  customersDelete: boolean;
  historyView: boolean;
  historyEdit: boolean;
  reports: boolean;
  dashboard: boolean;
  services: boolean;
  settings: boolean;
}

export function permissionsFor(role: Role): Permissions {
  switch (role) {
    case "gerencia":
      return {
        pdv: true, queue: true,
        customersView: true, customersEdit: true, customersDelete: true,
        historyView: true, historyEdit: true,
        reports: true, dashboard: true, services: true, settings: true,
      };
    case "atendimento":
      return {
        pdv: true, queue: true,
        customersView: true, customersEdit: false, customersDelete: false,
        historyView: true, historyEdit: false,
        reports: false, dashboard: false, services: false, settings: false,
      };
    case "lavajato":
      return {
        pdv: false, queue: true,
        customersView: false, customersEdit: false, customersDelete: false,
        historyView: false, historyEdit: false,
        reports: false, dashboard: false, services: false, settings: false,
      };
  }
}
