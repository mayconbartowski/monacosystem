import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Car, ListOrdered, Trash2, CheckCircle2, Trophy, Sparkles } from "lucide-react";
import { LOYALTY_QUALIFYING_SERVICES, Order } from "@/lib/domain";
import { activeQueue } from "@/lib/pricing";
import { brl, formatDuration, db } from "@/lib/storage";
import { toast } from "sonner";

interface Props {
  orders: Order[];
  onChanged: () => void;
}

export function QueueDrawer({ orders, onChanged }: Props) {
  const queue = activeQueue(orders);

  const complete = (o: Order) => {
    const completedAt = new Date().toISOString();
    db.updateOrder(o.id, { status: "completed", completedAt });
    // mantém contador genérico do cliente (histórico)
    const customers = db.listCustomers();
    const idx = customers.findIndex((c) => c.id === o.customerId);
    if (idx >= 0) {
      customers[idx].totalOrders += 1;
      db.saveCustomers(customers);
    }
    // aplica fidelidade na PLACA (apenas se foi uma lavagem qualificante)
    if (LOYALTY_QUALIFYING_SERVICES.includes(o.service)) {
      const veh = db.applyLoyaltyOnCompletion({ ...o, completedAt });
      if (veh?.rewardAvailable && !o.loyaltyRewardUsed) {
        toast.success(`Placa ${o.vehiclePlate} desbloqueou um benefício de fidelidade!`, {
          description: "Disponível na próxima venda desta placa.",
        });
      } else {
        toast.success(`Serviço concluído — ${o.vehiclePlate}`);
      }
    } else {
      toast.success(`Serviço concluído — ${o.vehiclePlate}`);
    }
    onChanged();
  };

  const cancel = (o: Order) => {
    db.updateOrder(o.id, { status: "cancelled" });
    toast("Pedido cancelado");
    onChanged();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
          <ListOrdered className="h-4 w-4" />
          Ver Fila
          <Badge variant="secondary" className="ml-1 bg-primary/15 text-primary border-0">
            {queue.length}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-card border-border">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <ListOrdered className="h-5 w-5 text-primary" />
            Fila de Atendimento
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
          {queue.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Car className="mx-auto h-10 w-10 mb-3 opacity-40" />
              Nenhum veículo na fila.
            </div>
          )}

          {queue.map((o, i) => (
            <div key={o.id} className="surface-card p-4 animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 grid place-items-center rounded-md bg-primary/15 text-primary text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm font-semibold">{o.vehiclePlate}</span>
                  </div>
                  <div className="mt-1 text-sm text-foreground truncate">{o.customerName}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.vehicleLabel} · {o.category}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" />
                    {formatDuration(o.durationMinutes)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-primary">{brl(o.total)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Badge variant="outline" className="border-border bg-muted/30">
                  Lavagem {o.service}
                </Badge>
                {o.extras.map((e) => (
                  <Badge key={e} variant="outline" className="border-border bg-muted/30">{e}</Badge>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="default" onClick={() => complete(o)} className="flex-1 gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Concluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => cancel(o)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
