import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Wrench, Trash2, Loader2, Save } from "lucide-react";
import {
  ServiceDef, VEHICLE_CATEGORIES, VehicleCategory,
  saveService, deleteService, setPrice, priceFor, useServices,
} from "@/lib/dataStore";
import { brl } from "@/lib/format";
import { toast } from "sonner";

const empty = () => ({
  id: undefined as string | undefined,
  key: "",
  title: "",
  description: "",
  durationMinutes: 60,
  position: 0,
  active: true,
  loyaltyQualifying: true,
});

export default function Services() {
  const services = useServices();
  const [editing, setEditing] = useState<ReturnType<typeof empty> | null>(null);
  const [prices, setPrices] = useState<Record<VehicleCategory, string>>({} as any);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const openNew = () => {
    setEditing({ ...empty(), position: services.length + 1 });
    setPrices({ Hatch: "", Sedan: "", SUV: "", Picape: "", Luxo: "" });
    setOpen(true);
  };

  const openEdit = (s: ServiceDef) => {
    setEditing({ ...s });
    const p: Record<VehicleCategory, string> = {} as any;
    VEHICLE_CATEGORIES.forEach((c) => (p[c] = String(priceFor(s.id, c) || "")));
    setPrices(p);
    setOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.key.trim() || !editing.title.trim()) {
      toast.error("Chave e título são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const svc = await saveService({
        ...editing,
        key: editing.key.trim(),
        title: editing.title.trim(),
        description: editing.description.trim(),
        durationMinutes: Number(editing.durationMinutes) || 60,
        position: Number(editing.position) || 0,
      });
      await Promise.all(
        VEHICLE_CATEGORIES.map((c) => {
          const v = Number(prices[c]);
          if (Number.isFinite(v) && v >= 0) return setPrice(svc.id, c, v);
          return Promise.resolve();
        })
      );
      toast.success("Serviço salvo");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: ServiceDef) => {
    if (!confirm(`Excluir serviço "${s.title}"?`)) return;
    try {
      await deleteService(s.id);
      toast.success("Serviço excluído");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Serviços e Preços
          </h1>
          <p className="text-xs text-muted-foreground">
            Apenas a Gerência pode editar · {services.length} serviços
          </p>
        </div>
        <Button onClick={openNew} className="ml-auto gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo serviço
        </Button>
      </header>

      <div className="p-6 bg-surface-sunken flex-1 overflow-auto">
        <div className="grid gap-4">
          {services
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((s) => (
              <Card key={s.id} className="surface-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{s.title}</div>
                      {!s.active && <Badge variant="outline">Inativo</Badge>}
                      {s.loyaltyQualifying && (
                        <Badge className="bg-primary/15 text-primary border-primary/30">Fidelidade</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Chave <span className="font-mono">{s.key}</span> · {s.durationMinutes} min · ordem {s.position}
                    </div>
                    {s.description && (
                      <div className="text-sm text-muted-foreground mt-2">{s.description}</div>
                    )}
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {VEHICLE_CATEGORIES.map((c) => (
                        <div key={c} className="rounded-lg border border-border bg-muted/30 p-2 text-center">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c}</div>
                          <div className="text-sm font-semibold text-primary">{brl(priceFor(s.id, c))}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          {services.length === 0 && (
            <div className="text-center text-muted-foreground py-20 text-sm">
              Nenhum serviço cadastrado.
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Chave (slug)</Label>
                  <Input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="Ex: Premium" />
                </div>
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="min-h-[80px]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Duração (min)</Label>
                  <Input type="number" min={1} value={editing.durationMinutes} onChange={(e) => setEditing({ ...editing, durationMinutes: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input type="number" min={0} value={editing.position} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <Label>Ativo</Label>
                  <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Conta para fidelidade</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.loyaltyQualifying} onCheckedChange={(v) => setEditing({ ...editing, loyaltyQualifying: v })} />
                  <span className="text-xs text-muted-foreground">
                    Se ativo, este serviço incrementa o contador de lavagens da placa.
                  </span>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Label>Preços por categoria (R$)</Label>
                <div className="grid grid-cols-5 gap-2">
                  {VEHICLE_CATEGORIES.map((c) => (
                    <div key={c} className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{c}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={prices[c] ?? ""}
                        onChange={(e) => setPrices({ ...prices, [c]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
