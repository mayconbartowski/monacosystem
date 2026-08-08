import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Car, ListOrdered, Sparkles, Play, CheckCircle2, PackageCheck, Building2 } from "lucide-react";
import { Order, PartnerContract } from "@/lib/domain";
import { brl, formatDuration } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { PickupPaymentDialog } from "@/components/PickupPaymentDialog";

interface Props {
  orders: Order[];
  contracts?: PartnerContract[];
}

export function QueueDrawer({ orders, contracts = [] }: Props) {
  const { role, perms } = useAuth();
  const canPickup = !!perms?.takePayment;
  const [picking, setPicking] = useState<Order | null>(null);

  const visible = orders
    .filter((o) => o.status === "queued" || o.status === "in_progress" || o.status === "completed")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const groups: Array<{ key: Order["status"]; label: string; icon: JSX.Element }> = [
    { key: "queued", label: "Aguardando", icon: <ListOrdered className="h-3.5 w-3.5" /> },
    { key: "in_progress", label: "Lavando", icon: <Play className="h-3.5 w-3.5" /> },
    { key: "completed", label: "Finalizados", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  ];

  const contractById = useMemo(() => {
    const m = new Map<string, PartnerContract>();
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

  const usageFor = (contractId: string): { used: number; limit: number } => {
    const c = contractById.get(contractId);
    if (!c) return { used: 0, limit: 0 };
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const used = orders.filter(
      (o) => o.partnerContractId === contractId && o.status !== "cancelled" && o.createdAt.slice(0, 7) === monthPrefix,
    ).length;
    return { used, limit: c.monthlyVehicleLimit };
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            aria-label="Ver fila"
            className="w-full h-16 md:h-14 px-3 md:px-4 gap-2 rounded-control border-0 bg-surface-3 text-foreground hover:bg-surface-4 hover:text-foreground flex-col md:flex-row justify-center md:justify-start"
          >
            <ListOrdered className="h-5 w-5 md:h-4 md:w-4 text-primary" />
            <span className="hidden md:inline">Ver Fila</span>
            <span className="text-base font-semibold md:hidden">{visible.length}</span>
            <Badge
              variant="secondary"
              className="ml-1 hidden md:inline-flex bg-primary text-primary-foreground border-0"
            >
              {visible.length}
            </Badge>
          </Button>
        </SheetTrigger>

        <SheetContent className="glass-panel w-full sm:max-w-md border-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <ListOrdered className="h-5 w-5 text-primary" />
              Fila de Atendimento
            </SheetTitle>
            {role === "atendimento" && (
              <p className="text-[11px] text-muted-foreground text-left">
                Retirada e pagamento ficam liberados na aba Finalizados.
              </p>
            )}
          </SheetHeader>

          <div className="mt-6 space-y-2.5 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
            {visible.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <Car className="mx-auto h-10 w-10 mb-3 opacity-40" />
                Nenhum veículo na fila.
              </div>
            )}

            {visible.length > 0 &&
              groups.map((g) => {
                const items = visible.filter((o) => o.status === g.key);
                if (items.length === 0) return null;
                return (
                  <div key={g.key}>
                    <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {g.icon} {g.label} <span className="ml-auto">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((o, i) => (
                        <div key={o.id} className="surface-card p-3 animate-fade-in">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="h-5 w-5 grid place-items-center rounded-md bg-primary/15 text-primary text-[11px] font-bold">
                                  {i + 1}
                                </span>
                                <span className="font-mono text-sm font-semibold">{o.vehiclePlate}</span>
                                {o.orderSource === "partner" && (
                                  <Badge variant="outline" className="border-primary/40 text-primary gap-1 text-[10px]">
                                    <Building2 className="h-2.5 w-2.5" /> Contrato
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 text-sm text-foreground truncate">{o.customerName}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {o.vehicleLabel} · {o.category}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Clock className="h-3 w-3" />
                                {formatDuration(o.durationMinutes)}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-primary">
                                {o.orderSource === "partner" ? "Contrato" : brl(o.total)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                            <Badge variant="outline" className="border-border bg-muted/30">
                              {o.service}
                            </Badge>
                            {o.extras.map((e) => (
                              <Badge key={e} variant="outline" className="border-border bg-muted/30">
                                {e}
                              </Badge>
                            ))}
                            {o.loyaltyRewardUsed && (
                              <Badge className="bg-primary/15 text-primary border border-primary/30 gap-1">
                                <Sparkles className="h-3 w-3" /> Recompensa
                              </Badge>
                            )}
                            {o.paymentStatus === "pending" && o.status === "completed" && (
                              <Badge variant="outline" className="border-yellow-500/40 text-yellow-500">
                                Pagamento pendente
                              </Badge>
                            )}
                          </div>
                          {g.key === "completed" && canPickup && o.paymentStatus !== "paid" && (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                onClick={() => setPicking(o)}
                                className="w-full h-9 gap-2 bg-primary text-primary-foreground hover:opacity-90 font-semibold"
                              >
                                <PackageCheck className="h-4 w-4" /> Iniciar Retirada
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </SheetContent>
      </Sheet>

      <PickupPaymentDialog
        order={picking}
        open={!!picking}
        onOpenChange={(o) => !o && setPicking(null)}
        partnerLabel={picking?.partnerContractId ? contractById.get(picking.partnerContractId)?.companyName : undefined}
        partnerUsage={picking?.partnerContractId ? usageFor(picking.partnerContractId) : undefined}
      />
    </>
  );
}
