import { Navigate, useLocation } from "react-router-dom";
import { AppRole, primaryRoute, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: AppRole[];
}) {
  const { session, roles, loading } = useAuth();
  const loc = useLocation();

  // loading=true → aguarda sessão+roles estarem prontos (garantido pelo AuthContext)
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Sem sessão → vai para login
  if (!session) {
    return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  }

  // Verifica permissão de role (roles já estão carregados quando chegamos aqui)
  if (allow && allow.length > 0 && !roles.some((r) => allow.includes(r))) {
    const dest = primaryRoute(roles);
    // Proteção extra: evita loop se o destino for a própria rota atual
    if (dest === loc.pathname || dest === "/auth") {
      return <Navigate to="/auth" replace />;
    }
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
