import { Link, NavLink } from "react-router-dom";
import { Car, LayoutDashboard, Users, ClipboardList, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "PDV / Vendas", icon: Car },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/historico", label: "Histórico", icon: ClipboardList },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar">
        <Link to="/" className="px-6 py-6 flex items-center gap-3 border-b border-sidebar-border">
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
        <div className="p-4 text-[11px] text-muted-foreground/70 border-t border-sidebar-border">
          v1.0 · Premium Auto Care
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
