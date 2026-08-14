import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Car,
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  LogOut,
  Settings as SettingsIcon,
  Wrench,
  ListOrdered,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Crown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/authContext";
import { ROLE_LABEL } from "@/lib/domain";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ALL_ITEMS = [
  { to: "/", label: "PDV / Vendas", icon: Car, perm: "pdv" as const },
  { to: "/fila", label: "Fila", icon: ListOrdered, perm: "queue" as const },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" as const },
  { to: "/clientes", label: "Clientes", icon: Users, perm: "customersView" as const },
  { to: "/parceiros", label: "Parceiros", icon: Building2, perm: "partners" as const },
  { to: "/historico", label: "Histórico", icon: ClipboardList, perm: "historyView" as const },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, perm: "reports" as const },
  { to: "/servicos", label: "Serviços", icon: Wrench, perm: "services" as const },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon, perm: "settings" as const },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Tela de Vendas",
  "/fila": "Fila de Lavagem",
  "/dashboard": "Dashboard",
  "/clientes": "Clientes",
  "/parceiros": "Contratos de Parceiros",
  "/historico": "Histórico",
  "/relatorios": "Relatórios",
  "/servicos": "Serviços",
  "/configuracoes": "Configurações",
};

const STORAGE_KEY = "monaco:sidebar:collapsed";


function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div className="h-10 w-10 rounded-2xl bg-primary grid place-items-center text-primary-foreground shrink-0">
        <Crown className="h-5 w-5" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="leading-tight min-w-0">
          <div className="font-semibold tracking-[0.06em] text-sidebar-foreground truncate">MONACO SYSTEM</div>
        </div>
      )}
      <span className="sr-only">Monaco System</span>
    </>
  );
}


export function AppShell({ children }: { children: React.ReactNode }) {
  const { perms, session, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = ALL_ITEMS.filter((i) => perms?.[i.perm]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };
  const homeTo = role === "lavajato" ? "/fila" : "/";
  const isActivePath = (to: string) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));
  const currentTitle =
    PAGE_TITLES[
      Object.keys(PAGE_TITLES).find((p) => (p === "/" ? location.pathname === "/" : location.pathname.startsWith(p))) ??
        ""
    ] ?? "";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative isolate min-h-screen flex w-full bg-transparent">
        <AmbientGlow />
        <aside
          className={cn(
            "relative z-10 hidden lg:flex flex-col border-0 bg-[rgba(10,10,10,0.82)] backdrop-blur-[18px] transition-[width] duration-200 ease-out h-screen sticky top-0",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          <div
            className={cn(
              "flex items-center border-b border-sidebar-border",
              collapsed ? "justify-center px-3 py-5" : "px-5 py-5 gap-3",
            )}
          >
            <Link to={homeTo} className="flex items-center gap-3 min-w-0">
              <Brand compact={collapsed} />
            </Link>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {items.map((it) => {
              const isActive = isActivePath(it.to);
              const link = (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === "/"}
                  className={cn(
                    "group flex items-center rounded-control text-sm transition-colors duration-200 relative",
                    collapsed ? "mx-auto justify-center items-center h-11 w-11 p-0" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-sidebar-foreground/80 hover:bg-surface-3 hover:text-sidebar-foreground",
                  )}
                >
                  <it.icon
                    className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary-foreground" : "text-current")}
                  />
                  {!collapsed && <span className="truncate">{it.label}</span>}
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

          <div className="border-t border-sidebar-border p-3 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((v) => !v)}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground",
                collapsed ? "justify-center h-11 px-0" : "justify-start gap-2",
              )}
              aria-label={collapsed ? "Expandir menu" : "Retrair menu"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" /> Recolher
                </>
              )}
            </Button>

            {session && !collapsed && (
              <div className="flex items-center gap-2 px-2 py-2 rounded-xl border border-border bg-muted/25">
                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold shrink-0">
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
                    className="w-full h-11 px-0 justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
              <div className="text-[11px] text-muted-foreground/70 text-center">v1.2 · Premium Auto Care</div>
            )}
          </div>
        </aside>

        <main className="relative z-10 flex-1 min-w-0 flex flex-col">
          {/* Mobile / tablet topbar */}
          <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-2 border-b border-border bg-[hsl(var(--surface-2))] pt-[max(0.5rem,env(safe-area-inset-top))]">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir menu de navegação"
                  className="h-11 w-11 rounded-xl border border-border"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[86vw] max-w-xs border-0 bg-[hsl(var(--surface-1))] p-0 flex flex-col"
              >
                <SheetTitle className="sr-only">Navegação</SheetTitle>
                <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
                  <Brand />
                </div>
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  {items.map((it) => {
                    const isActive = isActivePath(it.to);
                    return (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        end={it.to === "/"}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-control px-3 min-h-[48px] text-sm transition-colors duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-sidebar-foreground/85 hover:bg-surface-3",
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <it.icon className="h-[18px] w-[18px] text-current" />

                        {it.label}
                      </NavLink>
                    );
                  })}
                </nav>
                <div className="border-t border-sidebar-border p-3 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  {session && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/25">
                      <div className="h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">
                        {session.login.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="text-sm font-medium truncate">{session.login}</div>
                        <div className="text-xs text-muted-foreground">{ROLE_LABEL[session.role]}</div>
                      </div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    onClick={doLogout}
                    className="w-full justify-start gap-2 min-h-[44px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {currentTitle && (
              <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold text-white leading-none">
                {currentTitle}
              </h1>
            )}

            <Link to={homeTo} className="ml-auto shrink-0 flex items-center" aria-label="Início">
              <Crown className="h-6 w-6 text-primary" />
            </Link>
          </div>

          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
