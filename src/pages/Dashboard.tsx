import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock, Car, DollarSign, TrendingUp, Users, ListOrdered,
  Trophy, Sparkles, Target, Plus, Pencil, Trash2, Receipt, Wallet,
} from "lucide-react";
import { brl, formatDuration, formatPlate } from "@/lib/storage";
import {
  activeQueue, totalQueueWait, computeGoals, isOrderPaid, orderFinancialDate,
} from "@/lib/pricing";
import { useData } from "@/lib/DataContext";
import { useAuth } from "@/lib/authContext";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";
import { softDeleteExpense } from "@/services/expenses";
import { Expense } from "@/lib/expenses";
import { toast } from "sonner";

const MONTHLY_GOALS = [10000, 20000];

export default function Dashboard() {
  const { orders, customers, vehicles, expenses } = useData();
  const { role } = useAuth();
  const isAdmin = role === "gerencia";

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const queue = activeQueue(orders);
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  // Receita: apenas pagamentos confirmados hoje (usando data financeira)
  const paidToday = useMemo(
    () => orders.filter((o) => {
      if (!isOrderPaid(o) || o.orderSource === "partner") return false;
      const d = orderFinancialDate(o);
      return d ? d.slice(0, 10) === today : false;
    }),
    [orders, today]
  );
  const revenue = paidToday.reduce((a, o) => a + o.total, 0);
  const completed = orders.filter((o) => o.status === "completed" || o.status === "delivered").length;

  const activeExpenses = useMemo(() => expenses.filter((e) => e.active), [expenses]);
  const expensesToday = activeExpenses.filter((e) => e.expenseDate === today);
  const expensesMonth = activeExpenses.filter((e) => e.expenseDate.startsWith(monthPrefix));
  const expensesTodayTotal = expensesToday.reduce((a, e) => a + e.amount, 0);
  const expensesMonthTotal = expensesMonth.reduce((a, e) => a + e.amount, 0);
  const netToday = revenue - expensesTodayTotal;

  const rewardsThisMonth = useMemo(
    () => orders.filter((o) =>
      isOrderPaid(o) && o.loyaltyRewardUsed &&
      (orderFinancialDate(o) ?? "").slice(0, 7) === monthPrefix
    ).length,
    [orders, monthPrefix]
  );
  const closeToReward = vehicles.filter(
    (v) => !v.rewardAvailable && ((v.washCount ?? 0) === 8 || (v.washCount ?? 0) === 9)
  );
  const benefitsAvailable = vehicles.filter((v) => v.rewardAvailable);

  const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  const recentExpenses = activeExpenses.slice(0, 6);

  // Metas
  const goalsGrids = MONTHLY_GOALS.map((g) => ({ monthly: g, data: computeGoals(orders, g) }));

  const openNew = () => { setEditing(null); setExpenseOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setExpenseOpen(true); };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await softDeleteExpense(deleting.id);
      toast.success("Despesa removida");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao remover");
    } finally { setDeleting(null); }
  };

  return (
    <AppShell>
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Visão operacional Monaco System · sincronizada em tempo real</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="ml-auto bg-primary text-primary-foreground border-0 gap-2" size="sm">
            <Plus className="h-4 w-4" /> Adicionar Despesa
          </Button>
        )}
      </header>
      <div className="p-6 space-y-12 bg-surface-sunken flex-1 overflow-auto">
        <div>
          <h2 className="text-sm font-semibold mb-3">Resumo do Dia</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Metric icon={<DollarSign />} label="Faturamento hoje (pago)" value={brl(revenue)} highlight />
            <Metric icon={<TrendingUp />} label="Vendas pagas hoje" value={String(paidToday.length)} />
            <Metric icon={<Car />} label="Veículos na fila" value={String(queue.length)} />
            <Metric icon={<Clock />} label="Tempo total fila" value={formatDuration(totalQueueWait(orders))} />
            <Metric icon={<Users />} label="Clientes cadastrados" value={String(customers.length)} />
            <Metric icon={<ListOrdered />} label="Serviços finalizados" value={String(completed)} />
          </div>

          <Card className="bg-card/25 border-border shadow-card rounded-xl p-5 mt-4">
            <h2 className="text-sm font-semibold mb-4">Últimas vendas</h2>
            {recent.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda registrada ainda.</div>
            ) : (
              <div className="relative">
                <div className="divide-y divide-border max-h-[380px] overflow-y-auto pr-1">
                  {recent.map((o) => (
                    <div key={o.id} className="py-3 flex items-center gap-3">
                      <div className="font-mono text-sm w-24">{o.vehiclePlate}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{o.customerName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {o.service} {o.extras.length ? `+ ${o.extras.join(", ")}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {o.paymentStatus === "paid" ? "Pago" : o.status === "completed" ? "Aguarda retirada" : o.status === "queued" ? "Fila" : o.status === "in_progress" ? "Em andamento" : o.status === "cancelled" ? "Cancelado" : "Entregue"}
                      </Badge>
                      <div className="w-28 text-right font-semibold text-primary">{o.orderSource === "partner" ? "Contrato" : brl(o.total)}</div>
                    </div>
                  ))}
                </div>
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-surface-sunken" />
              </div>
            )}
          </Card>

          {/* Metas financeiras */}
          <div className="mt-6 space-y-6">
            {goalsGrids.map(({ monthly, data }) => (
              <div key={monthly}>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Meta {brl(monthly)}/mês</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <GoalCardView g={data.day} />
                  <GoalCardView g={data.week} />
                  <GoalCardView g={data.month} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              Despesas da Loja
              <span className="text-muted-foreground font-normal">· caixa operacional</span>
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Metric icon={<Receipt />} label="Despesas hoje" value={brl(expensesTodayTotal)} />
              <Metric icon={<Wallet />} label="Despesas do mês" value={brl(expensesMonthTotal)} />
              <Metric icon={<TrendingUp />} label="Resultado líquido (hoje)" value={brl(netToday)} />
              <Metric icon={<ListOrdered />} label="Lançamentos no mês" value={String(expensesMonth.length)} />
            </div>

            <Card className="bg-card/25 border-border shadow-card rounded-xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Últimas despesas</div>
                <Button size="sm" variant="outline" onClick={openNew} className="gap-2">
                  <Plus className="h-3.5 w-3.5" /> Nova
                </Button>
              </div>
              {recentExpenses.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma despesa registrada ainda.</div>
              ) : (
                <div className="divide-y divide-border">
                  {recentExpenses.map((e) => (
                    <div key={e.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{e.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {new Date(e.expenseDate + "T00:00:00").toLocaleDateString("pt-BR")}
                          {e.paymentMethod ? ` · ${e.paymentMethod}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">{e.category}</Badge>
                      <div className="w-28 text-right font-semibold text-primary">−{brl(e.amount)}</div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(e)} title="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            Programa de Fidelidade <span className="text-muted-foreground font-normal">· por placa</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Metric icon={<Sparkles />} label="Recompensas concedidas no mês" value={String(rewardsThisMonth)} />
            <Metric icon={<Target />} label="Veículos próximos (8–9 lavagens)" value={String(closeToReward.length)} />
            <Metric icon={<Trophy />} label="Benefícios aguardando uso" value={String(benefitsAvailable.length)} />
          </div>

          {(closeToReward.length > 0 || benefitsAvailable.length > 0) && (
            <Card className="surface-card p-5 mt-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Benefícios disponíveis</div>
                  {benefitsAvailable.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhum no momento.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {benefitsAvailable.slice(0, 12).map((v) => (
                        <Badge key={v.id} className="bg-primary/15 text-primary border border-primary/30 font-mono">
                          {formatPlate(v.plate)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Próximas da recompensa</div>
                  {closeToReward.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhuma no momento.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {closeToReward.slice(0, 12).map((v) => (
                        <Badge key={v.id} variant="outline" className="border-border font-mono">
                          {formatPlate(v.plate)} · {v.washCount}/10
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {isAdmin && (
        <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} editing={editing} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `"${deleting.name}" — ${brl(deleting.amount)} será marcada como inativa.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Metric({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "bg-gradient-gold border-0 p-4" : "surface-card p-4"}>
      <div className="flex items-center gap-3">
        <div className={
          highlight
            ? "h-10 w-10 grid place-items-center rounded-lg bg-primary-foreground/20 text-primary-foreground"
            : "h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary"
        }>{icon}</div>
        <div>
          <div className={
            highlight
              ? "text-[11px] uppercase tracking-wider text-primary-foreground/80"
              : "text-[11px] uppercase tracking-wider text-muted-foreground"
          }>{label}</div>
          <div className={highlight ? "text-lg font-bold text-primary-foreground" : "text-lg font-bold"}>{value}</div>
        </div>
      </div>
    </Card>
  );
}

function GoalCardView({ g }: { g: ReturnType<typeof computeGoals>["day"] }) {
  const surpassed = g.surpassedBy > 0;
  const pct = (g.progress * 100).toFixed(2);
  return (
    <Card className="surface-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{g.period}</div>
        <div className={surpassed ? "text-xs text-primary font-semibold" : "text-xs text-muted-foreground"}>{pct}%</div>
      </div>
      <div className="text-base font-semibold">
        {brl(g.earned)} <span className="text-xs text-muted-foreground font-normal">de {brl(g.goal)}</span>
      </div>
      <Progress value={g.progress * 100} className="h-2 mt-2" />
      <div className="mt-2 text-xs">
        {surpassed
          ? <span className="text-primary font-medium">Meta superada em {brl(g.surpassedBy)}</span>
          : <span className="text-muted-foreground">Faltam <span className="text-foreground font-medium">{brl(g.remaining)}</span></span>}
      </div>
    </Card>
  );
}
