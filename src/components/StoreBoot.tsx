import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { loadStore, resetStore, useLoaded } from "@/lib/dataStore";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

let seedAttempted = false;

/**
 * Boots the in-memory store + realtime channels after the user is authenticated.
 * Tears them down on sign-out. Also ensures the 3 fixed accounts are seeded once.
 */
export function StoreBoot({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [booting, setBooting] = useState(false);
  const loaded = useLoaded();

  // Seed the 3 fixed accounts on first app boot (idempotent on the server).
  useEffect(() => {
    if (seedAttempted) return;
    seedAttempted = true;
    supabase.functions.invoke("seed-accounts").catch(() => {
      // silent — endpoint is idempotent and not critical to render
    });
  }, []);

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

