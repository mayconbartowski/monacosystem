import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, CreditCard, PackageCheck, Receipt } from "lucide-react";
import { Order, PaymentMethod } from "@/lib/domain";
import { brl } from "@/lib/storage";
import { payOrderRpc, deliverPartnerOrderRpc } from "@/services/partners";
import { toast } from "sonner";

const PAYMENTS: PaymentMethod[] = ["Crédito", "Débito", "Pix"];

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partnerLabel?: string;
  partnerUsage?: { used: number; limit: number };
}

export function PickupPaymentDialog({ order, open, onOpenChange, partnerLabel, partnerUsage }: Props) {
  const [pct, setPct] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setPct(0); setMethod(""); setSaving(false); }
  }, [open, order?.id]);

  const isPartner = order?.orderSource === "partner";

  const totals = useMemo(() => {
    if (!order) return { base: 0, disc: 0, fee: 0, total: 0 };
    const base = Math.max(0, order.subtotal - order.loyaltyDiscount);
    const clamped = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
    const disc = +(base * (clamped / 100)).toFixed(2);
    const fee = order.serviceFee ?? 0;
    const total = Math.max(0, base - disc) + fee;
    return { base, disc, fee, total };
  }, [order, pct]);

  if (!order) return null;

  const doConfirm = async () => {
    setSaving(true);
    try {
      if (isPartner) {
        await deliverPartnerOrderRpc(order.id);
        toast.success(`Retirada confirmada — ${order.vehiclePlate}`);
      } else {
        if (!method) return;
        await payOrderRpc(order.id, method, pct, totals.fee, feeNote.trim());
        toast.success(`Pagamento confirmado — ${brl(totals.total)}`, {
          description: `Veículo ${order.vehiclePlate} entregue.`,
        });
      }
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("order_already_paid")) toast.error("Esta ordem já foi paga.");
      else if (msg.includes("order_not_completed")) toast.error("Ordem ainda não foi finalizada.");
      else toast.error(msg || "Erro ao concluir");
    } finally {
      setSaving(false);
    }
  };

  const canConfirm = !saving && (isPartner || !!method);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isPartner ? "Retirada — Parceiro" : "Retirada e Pagamento"}
          </DialogTitle>
          <DialogDescription>
            {isPartner
              ? "Atendimento por contrato — sem cobrança individual."
              : "Informe o desconto (se houver) e a forma de pagamento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{isPartner ? "Empresa" : "Cliente"}</span><span className="font-medium truncate ml-3">{order.customerName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Placa</span><span className="font-mono">{order.vehiclePlate}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Veículo</span><span className="truncate ml-3">{order.vehicleLabel}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span>{order.service}{order.extras.length ? ` + ${order.extras.join(", ")}` : ""}</span></div>
            {partnerLabel && (
              <div className="flex justify-between"><span className="text-muted-foreground">Contrato</span><Badge variant="outline" className="border-primary/40 text-primary">{partnerLabel}</Badge></div>
            )}
            {partnerUsage && (
              <div className="flex justify-between"><span className="text-muted-foreground">Utilização mensal</span><span>{partnerUsage.used}/{partnerUsage.limit}</span></div>
            )}
          </div>

          {!isPartner && (
            <>
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{brl(order.subtotal)}</span></div>
                {order.loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-primary"><span className="flex items-center gap-1"><BadgePercent className="h-3 w-3" />Fidelidade</span><span>−{brl(order.loyaltyDiscount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Desconto manual ({pct || 0}%)</span><span>−{brl(totals.disc)}</span></div>
                {feeOpen && totals.fee > 0 && (
                  <div className="flex justify-between text-primary"><span className="flex items-center gap-1"><Receipt className="h-3 w-3" />Taxa de serviço{feeNote ? ` (${feeNote})` : ""}</span><span>+{brl(totals.fee)}</span></div>
                )}
                <div className="flex justify-between text-base font-semibold pt-1 border-t border-border mt-1"><span>Total</span><span className="gold-text">{brl(totals.total)}</span></div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Desconto manual (%)</Label>
                <Input type="number" min={0} max={100} step={1}
                  value={pct || ""}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return setPct(0);
                    setPct(Math.min(100, Math.max(0, n)));
                  }}
                  placeholder="0" className="mt-1" />
              </div>

              {!feeOpen ? (
                <Button type="button" variant="outline" size="sm" className="w-full gap-2"
                  onClick={() => setFeeOpen(true)}>
                  <Plus className="h-4 w-4" /> Adicionar taxa de serviço
                </Button>
              ) : (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1"><Receipt className="h-3 w-3" /> Taxa de serviço</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground"
                      onClick={() => { setFeeOpen(false); setFeeStr(""); setFeeNote(""); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      inputMode="numeric"
                      value={feeStr}
                      onChange={(e) => setFeeStr(formatMoneyInput(e.target.value))}
                      placeholder="R$ 0,00"
                      className="col-span-1"
                    />
                    <Input
                      value={feeNote}
                      onChange={(e) => setFeeNote(e.target.value)}
                      placeholder="Descrição (ex.: leva e traz)"
                      maxLength={120}
                      className="col-span-2"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
                <Tabs value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="mt-1">
                  <TabsList className="grid grid-cols-3 w-full">
                    {PAYMENTS.map((p) => (
                      <TabsTrigger key={p} value={p} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        {p}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Voltar</Button>
          <Button onClick={doConfirm} disabled={!canConfirm}
            className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow font-semibold">
            {isPartner ? <><PackageCheck className="h-4 w-4" /> Confirmar Retirada</> : <><CreditCard className="h-4 w-4" /> Efetuar Pagamento</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
