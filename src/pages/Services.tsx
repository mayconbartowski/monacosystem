import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Clock } from "lucide-react";
import { ServiceOverride, VEHICLE_CATEGORIES, VehicleCategory } from "@/lib/domain";
import { brl } from "@/lib/storage";
import { useData } from "@/lib/DataContext";
import { updateServiceRow, upsertServicePrice } from "@/services/data";
import { toast } from "sonner";
import { cn, errorMessage } from "@/lib/utils";

export default function Services() {
  const { services: dbServices, prices: dbPrices } = useData();
  const [services, setServices] = useState<ServiceOverride[]>([]);
  const [prices, setPrices] = useState(dbPrices);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setServices([...dbServices].sort((a, b) => a.order - b.order)); }, [dbServices]);
  useEffect(() => { setPrices(dbPrices); }, [dbPrices]);

  const update = (i: number, patch: Partial<ServiceOverride>) =>
    setServices((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const setPrice = (cat: VehicleCategory, key: ServiceOverride["key"], v: number) =>
    setPrices((p) => ({ ...p, [cat]: { ...p[cat], [key]: v } }));

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all(services.map((s) => s.id ? updateServiceRow(s.id, {
        title: s.name, description: s.description,
        duration_minutes: s.durationMinutes ?? 60,
        active: s.active, position: s.order,
      }) : Promise.resolve()));
      // prices
      const tasks: Promise<unknown>[] = [];
      for (const s of services) {
        if (!s.id) continue;
        for (const cat of VEHICLE_CATEGORIES) {
          tasks.push(upsertServicePrice(s.id, cat, prices[cat][s.key] || 0));
        }
      }
      await Promise.all(tasks);
      toast.success("Serviços e preços atualizados");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <header className="glass-chrome px-4 md:px-6 py-4 flex flex-wrap items-center gap-3 md:gap-4">
        <div className="hidden lg:block">
          <h1 className="text-[22px] font-semibold text-white">Serviços</h1>
        </div>
        <Button onClick={saveAll} disabled={saving} className="ml-auto gap-2 bg-primary text-primary-foreground hover:opacity-90">
          <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar tudo"}
        </Button>
      </header>
      <div className="p-4 md:p-6 bg-surface-sunken flex-1 overflow-auto space-y-2">
        {services.map((s, i) => (
          <Card key={s.key} className={cn("surface-card p-5", !s.active && "opacity-60")}>
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0 grid md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs text-muted-foreground">Título</Label>
                  <Input value={s.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <Textarea value={s.description ?? ""} onChange={(e) => update(i, { description: e.target.value })}
                    className="min-h-[42px] resize-none" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge variant="outline" className="font-mono">{s.key}</Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Ativo</span>
                  <Switch checked={s.active} onCheckedChange={(v) => update(i, { active: v })} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-12 gap-3">
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Tempo previsto (min)
                </Label>
                <Input type="number" min={1} value={s.durationMinutes ?? 0}
                  onChange={(e) => update(i, { durationMinutes: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preços por categoria</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {VEHICLE_CATEGORIES.map((cat) => (
                  <div key={cat} className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{cat}</Label>
                    <Input type="number" min={0} value={prices[cat][s.key]}
                      onChange={(e) => setPrice(cat, s.key, Number(e.target.value) || 0)}
                      className="font-mono" />
                    <div className="text-[10px] text-muted-foreground/70">{brl(prices[cat][s.key])}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}

        <div className="text-[11px] text-muted-foreground">
          Os extras (Polimento, Enceramento, Excessos) usam preços padrão por categoria definidos no sistema.
        </div>
      </div>
    </AppShell>
  );
}
