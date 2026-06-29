import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { Role } from "@/lib/domain";

interface Props {
  allow: Role[];
  children: React.ReactNode;
}

export function RequireRole({ allow, children }: Props) {
  const { session, ready, role } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (role && !allow.includes(role)) {
    if (role === "lavajato") return <Navigate to="/fila" replace />;
    if (role === "atendimento") return <Navigate to="/" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
