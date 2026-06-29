import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Car, LayoutDashboard, Users, ClipboardList, BarChart3,
  LogOut, Settings as SettingsIcon, Wrench, ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/authContext";
import { ROLE_LABEL } from "@/lib/domain";
import { Button } from "@/components/ui/button";

const ALL_ITEMS = [
  { to: "/", label: "PDV / Vendas", icon: Car, perm: "pdv" as const },
  { to: "/fila", label: "Fila", icon: ListOrdered, perm: "queue" as const, hideForGerente: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" as const },
  { to: "/clientes", label: "Clientes", icon: Users, perm: "customersView" as const },
  { to: "/historico", label: "Histórico", icon: ClipboardList, perm: "historyView" as const },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, perm: "reports" as const },
  { to: "/servicos", label: "Serviços", icon: Wrench, perm: "services" as const },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon, perm: "settings" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { perms, session, role, logout } = useAuth();
  const navigate = useNavigate();
  const items = ALL_ITEMS.filter((i) => perms?.[i.perm] && !(i.hideForGerente && role === "gerente"));

  const doLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar">
        <Link to={role === "lavajato" ? "/fila" : "/"} className="px-6 py-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-10 w-10 rounded-xl bg-gradient-gold grid place-items-center text-primary-foreground font-bold shadow-glow">
            M
          </div>
          <div className="leading-tight">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Monaco</div>
            <div className="font-semibold text-sidebar-foreground">System</div>
          </div>
        </Link>

        <nav className="flex-1 p-3 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative",
                  isActive
                    ? "bg-sidebar-accent text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary" />
                  )}
                  <it.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  {it.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          {session && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary grid place-items-center text-xs font-bold">
                {session.login.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-medium truncate">{session.login}</div>
                <div className="text-[10px] text-muted-foreground">{ROLE_LABEL[session.role]}</div>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={doLogout}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
          <div className="text-[10px] text-muted-foreground/70 text-center">v1.1 · Premium Auto Care</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
