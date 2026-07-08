import { toTitleCase } from "./storage";

export const EXPENSE_CATEGORIES = [
  "Materiais",
  "Alimentação",
  "Gasolina",
  "Manutenção",
  "Produtos de limpeza",
  "Funcionários",
  "Escritório",
  "Outros",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_PAYMENTS = ["Dinheiro", "Pix", "Crédito", "Débito", "Outros"] as const;
export type ExpensePayment = (typeof EXPENSE_PAYMENTS)[number];

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory | string;
  expenseDate: string; // YYYY-MM-DD
  paymentMethod: ExpensePayment | string | null;
  notes: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function normalizeExpenseName(v: string): string {
  return toTitleCase((v || "").trim());
}
