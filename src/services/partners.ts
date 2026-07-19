import { supabase } from "@/integrations/supabase/client";
import { PartnerContract } from "@/lib/domain";

type Row = {
  id: string; company_name: string; contact_phone: string; cnpj: string;
  monthly_vehicle_limit: number; contract_value: number; active: boolean;
  created_at: string; updated_at: string;
};

export function mapContract(r: Row): PartnerContract {
  return {
    id: r.id,
    companyName: r.company_name,
    contactPhone: r.contact_phone || "",
    cnpj: r.cnpj,
    monthlyVehicleLimit: r.monthly_vehicle_limit,
    contractValue: Number(r.contract_value),
    active: !!r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function normalizeCnpj(v: string): string {
  return (v || "").replace(/\D/g, "");
}
export function formatCnpj(v: string): string {
  const d = normalizeCnpj(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export async function fetchPartnerContracts(): Promise<PartnerContract[]> {
  const { data, error } = await supabase
    .from("partner_contracts")
    .select("*")
    .order("company_name");
  if (error) throw error;
  return (data as Row[] | null ?? []).map(mapContract);
}

export async function upsertPartnerContract(input: {
  id?: string;
  companyName: string; contactPhone: string; cnpj: string;
  monthlyVehicleLimit: number; contractValue: number;
}): Promise<PartnerContract> {
  const row = {
    company_name: input.companyName.trim(),
    contact_phone: (input.contactPhone || "").trim(),
    cnpj: normalizeCnpj(input.cnpj),
    monthly_vehicle_limit: input.monthlyVehicleLimit,
    contract_value: input.contractValue,
  };
  if (input.id) {
    const { data, error } = await supabase.from("partner_contracts")
      .update(row).eq("id", input.id).select().single();
    if (error) throw error;
    return mapContract(data as Row);
  }
  const { data, error } = await supabase.from("partner_contracts")
    .insert(row).select().single();
  if (error) throw error;
  return mapContract(data as Row);
}

export async function setPartnerContractActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("partner_contracts")
    .update({ active }).eq("id", id);
  if (error) throw error;
}

export async function createPartnerOrderRpc(input: {
  partnerContractId: string;
  plate: string; brand: string; model: string; color: string; year: string;
  category: string; serviceId: string; serviceKey: string;
  extras: string[]; subtotal: number; notes: string;
  queuePosition: number; durationMinutes: number;
}): Promise<void> {
  const { error } = await (supabase.rpc as any)("create_partner_order", {
    _partner_contract_id: input.partnerContractId,
    _plate: input.plate,
    _brand: input.brand || "",
    _model: input.model || "",
    _color: input.color || "",
    _year: input.year || "",
    _category: input.category,
    _service_id: input.serviceId,
    _service_key: input.serviceKey,
    _extras: input.extras,
    _subtotal: input.subtotal,
    _notes: input.notes || "",
    _queue_position: input.queuePosition,
    _duration_minutes: input.durationMinutes,
  });
  if (error) throw error;
}

export async function payOrderRpc(orderId: string, method: string, discountPct: number): Promise<void> {
  const { error } = await (supabase.rpc as any)("pay_order", {
    _order_id: orderId,
    _payment_method: method,
    _discount_percentage: discountPct,
  });
  if (error) throw error;
}

export async function deliverPartnerOrderRpc(orderId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("deliver_partner_order", {
    _order_id: orderId,
  });
  if (error) throw error;
}
