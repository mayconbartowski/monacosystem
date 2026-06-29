import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Car, LayoutDashboard, Users, ClipboardList, BarChart3,
  ListOrdered, Wrench, LogOut, Menu, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppRole, useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  allow: AppRole[];
}

const items: NavItem[] = [
  { to: "/dashboard", label: "Dashboard",        icon: LayoutDashboard, allow: ["gerencia"] },
  { to: "/",          label: "PDV / Vendas",     icon: Car,             allow: ["atendimento", "gerencia"] },
  { to: "/fila",      label: "Fila de Lavagem",  icon: ListOrdered,     allow: ["lavajato", "gerencia"] },
  { to: "/clientes",  label: "Clientes",         icon: Users,           allow: ["atendimento", "gerencia"] },
  { to: "/historico", label: "Histórico",        icon: ClipboardList,   allow: ["atendimento", "gerencia"] },
  { to: "/relatorios",label: "Relatórios",       icon: BarChart3,       allow: ["gerencia"] },
  { to: "/servicos",  label: "Serviços",         icon: Wrench,          allow: ["gerencia"] },
  { to: "/contas",    label: "Contas",           icon: ShieldCheck,     allow: ["gerencia"] },
];

const roleLabel: Record<AppRole, string> = {
  atendimento: "Atendimento",
  lavajato: "Lava-jato",
  gerencia: "Gerência",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { roles, fullName, user, signOut } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = items.filter((i) => i.allow.some((r) => roles.includes(r)));
  const topRole = roles.includes("gerencia") ? "gerencia" : roles.includes("lavajato") ? "lavajato" : "atendimento";

  const sidebar = (compact = false) => (
    <>
      <Link to="/" className="px-6 py-6 flex items-center gap-3 border-b border-sidebar-border" onClick={() => setMobileOpen(false)}>
        <div className="h-10 w-10 rounded-xl bg-gradient-gold grid place-items-center text-primary-foreground font-bold shadow-glow">
          M
        </div>
        <div className="leading-tight">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Monaco</div>
          <div className="font-semibold text-sidebar-foreground">System</div>
        </div>
      </Link>
      <nav className="flex-1 p-3 space-y-1">
        {visible.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )
            }
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div>
          <div className="text-sm font-medium text-sidebar-foreground truncate">
            {fullName || user?.email}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-primary">
            {roleLabel[topRole]}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={async () => { await signOut(); nav("/auth"); }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar">
        {sidebar()}
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border flex flex-col">
              {sidebar(true)}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-gold grid place-items-center text-primary-foreground font-bold text-sm">M</div>
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold truncate">Monaco System</div>
              <div className="text-[10px] uppercase tracking-wider text-primary">{roleLabel[topRole]}</div>
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
