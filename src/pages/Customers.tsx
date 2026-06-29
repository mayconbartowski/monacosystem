import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, User, Trophy, Car, Sparkles, MessageCircle, Trash2 } from "lucide-react";
import { db, brl, formatCpf, formatPhone, formatPlate } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { toast } from "sonner";

export default function Customers() {
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const customers = useMemo(() => db.listCustomers(), [tick]);
  const orders = useMemo(() => db.listOrders(), [tick]);
  const vehicles = useMemo(() => db.listVehicles(), [tick]);
  const { perms } = useAuth();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    const digits = s.replace(/\D/g, "");
    const plateNorm = s.replace(/[^a-z0-9]/gi, "").toUpperCase();
    return customers.filter((c) => {
      if (c.name.toLowerCase().includes(s)) return true;
      if (digits.length >= 2 && c.cpf.includes(digits)) return true;
      if (c.phone.includes(digits) && digits.length >= 2) return true;
      const vs = vehicles.filter((v) => v.customerId === c.id);
      return vs.some((v) => v.plate.toUpperCase().includes(plateNorm));
    });
  }, [q, customers, vehicles]);

  const remove = (id: string) => {
    db.deleteCustomer(id);
    toast.success("Cliente excluído");
    setTick((n) => n + 1);
  };

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-xs text-muted-foreground">{customers.length} cadastrados · fidelidade por placa</p>
        </div>
        <div className="ml-auto relative w-80 max-w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CPF, WhatsApp ou placa"
            className="pl-9"
          />
        </div>
      </header>

      <div className="p-6 bg-surface-sunken flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-20 text-sm animate-fade-in">
            <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const cOrders = orders.filter((o) => o.customerId === c.id);
              const cVehicles = vehicles.filter((v) => v.customerId === c.id);
              const totalSpent = cOrders.filter((o) => o.status !== "cancelled").reduce((a, o) => a + o.total, 0);
              const rewards = cVehicles.filter((v) => v.rewardAvailable).length;
              return (
                <Card key={c.id} className="surface-card p-5 animate-fade-in transition-shadow hover:shadow-elegant">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{formatCpf(c.cpf)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MessageCircle className="h-3 w-3 text-primary" />
                        {formatPhone(c.phone)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {rewards > 0 && (
                        <Badge variant="outline" className="border-primary/40 text-primary gap-1">
                          <Sparkles className="h-3 w-3" />
                          {rewards} {rewards === 1 ? "benefício" : "benefícios"}
                        </Badge>
                      )}
                      {perms?.customersDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {c.name} e seus veículos serão removidos. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(c.id)} className="bg-destructive hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Pedidos" value={String(cOrders.length)} />
                    <Mini label="Veículos" value={String(cVehicles.length)} />
                    <Mini label="Gasto" value={brl(totalSpent)} />
                  </div>
                  {cVehicles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {cVehicles.map((v) => (
                        <div key={v.id} className="rounded-lg border border-border bg-muted/20 p-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-mono font-medium">
                              <Car className="h-3 w-3 text-muted-foreground" />
                              {formatPlate(v.plate)}
                              <span className="text-muted-foreground font-sans">· {v.brand} {v.model}</span>
                            </div>
                            {v.rewardAvailable ? (
                              <span className="text-primary font-semibold flex items-center gap-1">
                                <Trophy className="h-3 w-3" /> Pronto
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{v.washCount ?? 0}/10</span>
                            )}
                          </div>
                          <Progress
                            value={v.rewardAvailable ? 100 : ((v.washCount ?? 0) / 10) * 100}
                            className="h-1.5 mt-2"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
