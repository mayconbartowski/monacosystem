import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, Pencil, Power, PowerOff } from "lucide-react";
import { PartnerContract } from "@/lib/domain";
import { brl, formatPhone } from "@/lib/storage";
import {
  fetchPartnerContracts, upsertPartnerContract, setPartnerContractActive,
  formatCnpj, normalizeCnpj,
} from "@/services/partners";
import { useData } from "@/lib/DataContext";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

export default function Partners() {
  const { partnerContracts } = useData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerContract | null>(null);
  const [confirming, setConfirming] = useState<PartnerContract | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [limit, setLimit] = useState<number>(10);
  const [value, setValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // ensure fresh list if realtime missed
    void fetchPartnerContracts().catch(() => {});
  }, []);

  const open = (c: PartnerContract | null) => {
    setEditing(c);
    setName(c?.companyName ?? "");
    setPhone(c?.contactPhone ?? "");
    setCnpj(c?.cnpj ?? "");
    setLimit(c?.monthlyVehicleLimit ?? 10);
    setValue(c?.contractValue ?? 0);
    setDialogOpen(true);
  };

  const canSave = name.trim().length >= 2 && normalizeCnpj(cnpj).length === 14 && limit > 0 && value >= 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await upsertPartnerContract({
        id: editing?.id,
        companyName: name, contactPhone: phone, cnpj,
        monthlyVehicleLimit: Math.floor(limit),
        contractValue: value,
      });
      toast.success(editing ? "Contrato atualizado" : "Contrato criado");
      setDialogOpen(false);
    } catch (error: unknown) {
      const msg = errorMessage(error, "Erro ao salvar");
      if (msg.includes("partner_contracts_cnpj_active_idx"))
        toast.error("CNPJ já cadastrado em contrato ativo");
      else toast.error(msg);
    } finally { setSaving(false); }
  };

  const toggleActive = async (c: PartnerContract) => {
    try {
      await setPartnerContractActive(c.id, !c.active);
      toast.success(c.active ? "Contrato inativado" : "Contrato reativado");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Erro ao atualizar"));
    } finally { setConfirming(null); }
  };

  return (
    <AppShell>
      <header className="glass-chrome h-[60px] min-h-[60px] lg:h-[88px] lg:min-h-[88px] px-4 md:px-6 py-0 flex flex-wrap items-center gap-3 md:gap-4">
        <div className="hidden lg:block">
          <h1 className="text-[22px] font-semibold text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Contratos de Parceiros
          </h1>
        </div>
        <Button onClick={() => open(null)} className="ml-auto bg-primary text-primary-foreground border-0 gap-2" size="sm">
          <Plus className="h-4 w-4" /> Novo contrato
        </Button>
      </header>

      <div className="p-4 md:p-6 bg-surface-sunken flex-1 overflow-auto">
        <Card className="surface-card p-0 overflow-hidden">
          <div className="grid grid-cols-12 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border px-5 py-3">
            <div className="col-span-3">Empresa</div>
            <div className="col-span-2">CNPJ</div>
            <div className="col-span-2">Contato</div>
            <div className="col-span-1 text-center">Limite/mês</div>
            <div className="col-span-2 text-right">Valor</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1 text-right">Ações</div>
          </div>
          {partnerContracts.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Nenhum contrato cadastrado.</div>
          ) : (
            partnerContracts.map((c) => (
              <div key={c.id} className="grid grid-cols-12 items-center px-5 py-3 border-b border-border/60 text-sm hover:bg-muted/20">
                <div className="col-span-3 font-medium truncate">{c.companyName}</div>
                <div className="col-span-2 font-mono text-xs">{formatCnpj(c.cnpj)}</div>
                <div className="col-span-2 text-xs">{c.contactPhone ? formatPhone(c.contactPhone) : "—"}</div>
                <div className="col-span-1 text-center">{c.monthlyVehicleLimit}</div>
                <div className="col-span-2 text-right font-semibold text-primary">{brl(c.contractValue)}</div>
                <div className="col-span-1 text-center">
                  <Badge variant="outline" className={c.active ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}>
                    {c.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="col-span-1 flex gap-1 justify-end">
                  <Button size="icon" variant="ghost" onClick={() => open(c)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirming(c)} title={c.active ? "Inativar" : "Reativar"}>
                    {c.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-primary" />}
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar contrato" : "Novo contrato"}</DialogTitle>
            <DialogDescription>Dados do parceiro/empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome da empresa *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Concessionária X" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">CNPJ *</Label>
                <Input value={formatCnpj(cnpj)} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contato/Telefone</Label>
                <Input value={formatPhone(phone)} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Limite mensal de veículos *</Label>
                <Input type="number" min={1} value={limit || ""} onChange={(e) => setLimit(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor do contrato (R$) *</Label>
                <Input type="number" min={0} step="0.01" value={value || ""} onChange={(e) => setValue(Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={!canSave || saving} className="bg-primary text-primary-foreground border-0">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.active ? "Inativar contrato?" : "Reativar contrato?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.active
                ? "O contrato deixará de aparecer no PDV. O histórico é preservado."
                : "O contrato voltará a ficar disponível para novas triagens."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && toggleActive(confirming)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
