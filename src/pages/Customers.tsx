import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, User, Trophy, Car, Sparkles, MessageCircle, Trash2, Pencil } from "lucide-react";
import { brl, formatCpf, formatPhone, formatPlate, normalizePlate, toTitleCase } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { useData } from "@/lib/DataContext";
import { deleteCustomer, updateCustomer } from "@/services/data";
import { toast } from "sonner";
import type { Customer } from "@/lib/domain";

export default function Customers() {
  const [q, setQ] = useState("");
  const { customers, vehicles, orders } = useData();
  const { perms } = useAuth();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", cpf: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, cpf: formatCpf(c.cpf), phone: formatPhone(c.phone) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (!form.phone.replace(/\D/g, "")) { toast.error("Informe o WhatsApp"); return; }
    setSaving(true);
    try {
      await updateCustomer(editing.id, form);
      toast.success("Cliente atualizado");
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    const digits = s.replace(/\D/g, "");
    const plateNorm = normalizePlate(s);
    return customers.filter((c) => {
      if (c.name.toLowerCase().includes(s)) return true;
      if (digits.length >= 2 && c.cpf.includes(digits)) return true;
      if (c.phone.includes(digits) && digits.length >= 2) return true;
      const vs = vehicles.filter((v) => v.customerId === c.id);
      return vs.some((v) => normalizePlate(v.plate).includes(plateNorm) && plateNorm.length >= 2);
    });
  }, [q, customers, vehicles]);

  const remove = async (id: string) => {
    try { await deleteCustomer(id); toast.success("Cliente excluído"); }
    catch (e: any) { toast.error(e.message ?? "Erro ao excluir"); }
  };

  return (
    <AppShell>
      <header className="glass-chrome px-4 md:px-6 py-4 flex flex-wrap items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-xs text-muted-foreground">{customers.length} cadastrados · fidelidade por placa</p>
        </div>
        <div className="ml-auto relative w-full sm:w-80 max-w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CPF, WhatsApp ou placa" className="pl-9" />
        </div>
      </header>

      <div className="p-4 md:p-6 bg-surface-sunken flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-20 text-sm animate-fade-in">
            <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
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
                      <div className="flex items-center gap-1">
                        {perms?.customersEdit && (
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(c)}
                            aria-label="Editar cliente"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
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
                                  {c.name} será marcado como inativo. O histórico de Ordens de Serviço é preservado.
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
                          <Progress value={v.rewardAvailable ? 100 : ((v.washCount ?? 0) / 10) * 100} className="h-1.5 mt-2" />
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>
              O ID e todo o histórico de Ordens de Serviço são preservados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: toTitleCase(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cpf">CPF</Label>
              <Input id="edit-cpf" value={form.cpf} inputMode="numeric"
                onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">WhatsApp</Label>
              <Input id="edit-phone" value={form.phone} inputMode="tel"
                onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
