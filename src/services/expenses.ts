import { supabase } from "@/integrations/supabase/client";
import { Expense, normalizeExpenseName } from "@/lib/expenses";

type Row = {
  id: string;
  name: string;
  amount: number | string;
  category: string;
  expense_date: string;
  payment_method: string | null;
  notes: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapExpense(r: Row): Expense {
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    category: r.category,
    expenseDate: r.expense_date,
    paymentMethod: r.payment_method,
    notes: r.notes || "",
    active: !!r.active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("store_expenses")
    .select("*")
    .eq("active", true)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    // Non-admin users may hit RLS; treat as empty silently.
    return [];
  }
  return (data as Row[]).map(mapExpense);
}

export interface ExpenseInput {
  name: string;
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod: string | null;
  notes: string;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const auth = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("store_expenses")
    .insert({
      name: normalizeExpenseName(input.name),
      amount: input.amount,
      category: input.category,
      expense_date: input.expenseDate,
      payment_method: input.paymentMethod,
      notes: input.notes || "",
      created_by: auth.data.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapExpense(data as Row);
}

export async function updateExpense(id: string, patch: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from("store_expenses")
    .update({
      name: normalizeExpenseName(patch.name),
      amount: patch.amount,
      category: patch.category,
      expense_date: patch.expenseDate,
      payment_method: patch.paymentMethod,
      notes: patch.notes || "",
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapExpense(data as Row);
}

/** Soft delete: preserva histórico financeiro. */
export async function softDeleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from("store_expenses")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}
