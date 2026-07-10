import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Car, LayoutDashboard, Users, ClipboardList, BarChart3,
  LogOut, Settings as SettingsIcon, Wrench, ListOrdered,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/authContext";
import { ROLE_LABEL } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ALL_ITEMS = [
  { to: "/", label: "PDV / Vendas", icon: Car, perm: "pdv" as const },
  { to: "/fila", label: "Fila", icon: ListOrdered, perm: "queue" as const },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" as const },
  { to: "/clientes", label: "Clientes", icon: Users, perm: "customersView" as const },
  { to: "/historico", label: "Histórico", icon: ClipboardList, perm: "historyView" as const },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, perm: "reports" as const },
  { to: "/servicos", label: "Serviços", icon: Wrench, perm: "services" as const },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon, perm: "settings" as const },
];

const STORAGE_KEY = "monaco:sidebar:collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { perms, session, role, logout } = useAuth();
  const navigate = useNavigate();
  const items = ALL_ITEMS.filter((i) => perms?.[i.perm]);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const doLogout = async () => { await logout(); navigate("/login"); };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex w-full bg-background">
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out h-screen sticky top-0",
            collapsed ? "w-16" : "w-60"
          )}
        >
          <div className={cn(
            "px-3 py-4 flex items-center border-b border-sidebar-border gap-2",
            collapsed ? "justify-center" : "px-6 py-6 gap-3"
          )}>
            <Link
              to={role === "lavajato" ? "/fila" : "/"}
              className="flex items-center gap-3 min-w-0"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-gold grid place-items-center text-primary-foreground font-bold shadow-glow shrink-0">
                M
              </div>
              {!collapsed && (
                <div className="leading-tight min-w-0">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Monaco</div>
                  <div className="font-semibold text-sidebar-foreground">System</div>
                </div>
              )}
            </Link>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {items.map((it) => {
              const link = (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center rounded-lg text-sm transition-all relative",
                      collapsed ? "mx-auto justify-center items-center h-10 w-10 p-0" : "gap-3 px-3 py-2.5",
                      isActive
                        ? "bg-primary/15 font-medium"
                        : "hover:bg-sidebar-accent/60"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary" />
                      )}
                      <it.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                          isActive ? "text-primary" : "text-white/80 group-hover:text-white"
                        )}
                      />
                      {!collapsed && (
                        <span
                          className={cn(
                            "truncate",
                            isActive ? "text-primary" : "text-white/80 group-hover:text-white"
                          )}
                        >
                          {it.label}
                        </span>
                      )}
                    </>
                  )}

                </NavLink>
              );
              if (!collapsed) return link;
              return (
                <Tooltip key={it.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{it.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-2 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((v) => !v)}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground",
                collapsed ? "justify-center h-10 px-0" : "justify-start gap-2"
              )}
              aria-label={collapsed ? "Expandir menu" : "Retrair menu"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Recolher</>}
            </Button>

            {session && !collapsed && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary grid place-items-center text-xs font-bold shrink-0">
                  {session.login.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-xs font-medium truncate">{session.login}</div>
                  <div className="text-[10px] text-muted-foreground">{ROLE_LABEL[session.role]}</div>
                </div>
              </div>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={doLogout}
                    className="w-full h-10 px-0 justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="Sair"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={doLogout}
                className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </Button>
            )}
            {!collapsed && (
              <div className="text-[10px] text-muted-foreground/70 text-center">v1.2 · Premium Auto Care</div>
            )}
          </div>
        </aside>
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>
    </TooltipProvider>
  );
}
