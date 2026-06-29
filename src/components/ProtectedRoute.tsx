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

  // Enquanto loading=true, sessão E roles ainda não estão prontos — aguarda
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  }

  // Só verifica roles após loading=false (garante que roles já foram buscados)
  if (allow && allow.length > 0 && !roles.some((r) => allow.includes(r))) {
    const dest = primaryRoute(roles);
    // Evita loop: se o destino calculado for a rota atual, vai para /auth
    if (dest === loc.pathname) {
      return <Navigate to="/auth" replace />;
    }
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
