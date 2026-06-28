import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { loadStore, resetStore, useLoaded } from "@/lib/dataStore";
import { Loader2 } from "lucide-react";

/**
 * Boots the in-memory store + realtime channels after the user is authenticated.
 * Tears them down on sign-out.
 */
export function StoreBoot({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [booting, setBooting] = useState(false);
  const loaded = useLoaded();

  useEffect(() => {
    if (session) {
      setBooting(true);
      loadStore().finally(() => setBooting(false));
    } else {
      resetStore();
    }
  }, [session?.user?.id]);

  if (loading) return null;
  if (session && !loaded && booting) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Carregando sistema...
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
