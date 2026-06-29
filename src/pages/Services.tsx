import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Save, Clock } from "lucide-react";
import { ServiceOverride, ServiceIconKey, VEHICLE_CATEGORIES, PriceTable, ServiceKey, ExtraKey, EXTRA_KEYS } from "@/lib/domain";
import { db, brl } from "@/lib/storage";
import { ServiceIcon, SERVICE_ICON_OPTIONS } from "@/components/ServiceIcon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Services() {
  const [services, setServices] = useState<ServiceOverride[]>([]);
  const [prices, setPrices] = useState<PriceTable>(db.getPrices());

  useEffect(() => {
    setServices([...db.listServiceOverrides()].sort((a, b) => a.order - b.order));
  }, []);

  const update = (i: number, patch: Partial<ServiceOverride>) =>
    setServices((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= services.length) return;
    const next = [...services];
    [next[i], next[j]] = [next[j], next[i]];
    setServices(next.map((s, idx) => ({ ...s, order: idx })));
  };

  const setPrice = (cat: keyof PriceTable, key: ServiceKey | ExtraKey, v: number) =>
    setPrices((p) => ({ ...p, [cat]: { ...p[cat], [key]: v } }));

  const saveAll = () => {
    db.saveServiceOverrides(services.map((s, i) => ({ ...s, order: i })));
    db.savePrices(prices);
    toast.success("Serviços e preços atualizados");
  };

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Serviços</h1>
          <p className="text-xs text-muted-foreground">Gerencie título, tempo, preços, ordem e visibilidade</p>
        </div>
        <Button onClick={saveAll} className="ml-auto gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-glow">
          <Save className="h-4 w-4" /> Salvar tudo
        </Button>
      </header>
      <div className="p-6 bg-surface-sunken flex-1 overflow-auto space-y-4">
        {services.map((s, i) => (
          <Card key={s.key} className={cn("surface-card p-5", !s.active && "opacity-60")}>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
                <ServiceIcon iconKey={s.icon} serviceKey={s.key} className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 grid md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-xs text-muted-foreground">Título</Label>
                  <Input value={s.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <Textarea
                    value={s.description ?? ""}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="min-h-[42px] resize-none"
                  />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge variant="outline" className="font-mono">{s.key}</Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Ativo</span>
                  <Switch checked={s.active} onCheckedChange={(v) => update(i, { active: v })} />
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === services.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-12 gap-3">
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Tempo previsto (min)
                </Label>
                <Input
                  type="number" min={1}
                  value={s.durationMinutes ?? 0}
                  onChange={(e) => update(i, { durationMinutes: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="md:col-span-9 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ícone</Label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_ICON_OPTIONS.map((opt) => {
                    const Icon = opt.Icon;
                    const active = (s.icon ?? "sparkles") === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => update(i, { icon: opt.key as ServiceIconKey })}
                        className={cn(
                          "h-9 w-9 rounded-lg border grid place-items-center transition-all",
                          active
                            ? "border-primary bg-primary/15 text-primary shadow-glow"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                        )}
                        title={opt.label}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preços por categoria</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {VEHICLE_CATEGORIES.map((cat) => (
                  <div key={cat} className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{cat}</Label>
                    <Input
                      type="number" min={0}
                      value={prices[cat][s.key]}
                      onChange={(e) => setPrice(cat, s.key, Number(e.target.value) || 0)}
                      className="font-mono"
                    />
                    <div className="text-[10px] text-muted-foreground/70">{brl(prices[cat][s.key])}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}

        <Card className="surface-card p-5">
          <div className="text-sm font-semibold mb-3">Extras</div>
          <div className="space-y-3">
            {EXTRA_KEYS.map((ex) => (
              <div key={ex} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
                <div className="text-sm font-medium">{ex}</div>
                {VEHICLE_CATEGORIES.map((cat) => (
                  <div key={cat} className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{cat}</Label>
                    <Input
                      type="number" min={0}
                      value={prices[cat][ex]}
                      onChange={(e) => setPrice(cat, ex, Number(e.target.value) || 0)}
                      className="font-mono"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <div className="text-[11px] text-muted-foreground">
          Criação de novos serviços estará disponível em uma próxima versão.
        </div>
      </div>
    </AppShell>
  );
}
