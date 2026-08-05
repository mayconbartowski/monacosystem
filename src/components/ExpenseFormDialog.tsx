import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  EXPENSE_CATEGORIES, EXPENSE_PAYMENTS, Expense, normalizeExpenseName,
} from "@/lib/expenses";
import { createExpense, updateExpense } from "@/services/expenses";
import { brl } from "@/lib/storage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Expense | null;
  onSaved?: () => void;
}

const todayISO = () => format(new Date(), "yyyy-MM-dd");

function parseMoney(v: string): number {
  const digits = (v || "").replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}
function formatMoneyInput(v: string): string {
  return brl(parseMoney(v));
}

export function ExpenseFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [payment, setPayment] = useState<string>("Dinheiro");
  const [date, setDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setAmountStr(brl(editing.amount));
      setCategory(editing.category);
      setPayment(editing.paymentMethod || "Dinheiro");
      setDate(editing.expenseDate);
      setNotes(editing.notes || "");
    } else {
      setName("");
      setAmountStr("");
      setCategory(EXPENSE_CATEGORIES[0]);
      setPayment("Dinheiro");
      setDate(todayISO());
      setNotes("");
    }
  }, [open, editing]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Informe o nome da despesa"); return; }
    const amount = parseMoney(amountStr);
    if (amount <= 0) { toast.error("Informe um valor válido"); return; }
    setSaving(true);
    try {
      const payload = {
        name: trimmed, amount, category, expenseDate: date,
        paymentMethod: payment, notes: notes.trim(),
      };
      if (editing) {
        await updateExpense(editing.id, payload);
        toast.success("Despesa atualizada");
      } else {
        await createExpense(payload);
        toast.success("Despesa registrada");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar despesa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar despesa" : "Adicionar despesa"}</DialogTitle>
          <DialogDescription>
            Registre gastos operacionais da loja. Este registro não afeta ordens de serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome da despesa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((v) => normalizeExpenseName(v))}
              placeholder="Ex.: Produto de limpeza"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valor</Label>
              <Input
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => setAmountStr(formatMoneyInput(e.target.value))}
                placeholder="R$ 0,00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(new Date(date + "T00:00:00"), "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(date + "T00:00:00")}
                    onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_PAYMENTS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais…"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}
            className="bg-primary text-primary-foreground border-0">
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Registrar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
