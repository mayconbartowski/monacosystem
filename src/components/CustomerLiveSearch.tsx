import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, User, Car, IdCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { db, formatCpf, formatPlate } from "@/lib/storage";
import { Customer, Vehicle } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface Match {
  customer: Customer;
  vehicles: Vehicle[];
  matchedBy: "name" | "cpf" | "plate";
  matchedPlate?: string;
}

interface Props {
  onSelect: (m: Match) => void;
  placeholder?: string;
  className?: string;
}

export function CustomerLiveSearch({ onSelect, placeholder = "Buscar por nome, CPF ou placa…", className }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo<Match[]>(() => {
    if (!q.trim()) return [];
    return db.searchCustomers(q, 8);
  }, [q]);

  useEffect(() => { setHi(0); }, [q]);

  const pick = (m: Match) => {
    onSelect(m);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(0, i - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(results[hi]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        placeholder={placeholder}
        className="pl-9 pr-9 h-10"
      />
      {q && (
        <button
          type="button"
          onClick={() => { setQ(""); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && q.trim() && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-border bg-popover shadow-elegant overflow-hidden animate-fade-in">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {results.map((m, i) => {
                const firstPlate = m.matchedPlate ?? m.vehicles[0]?.plate;
                return (
                  <li key={m.customer.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHi(i)}
                      onClick={() => pick(m)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors",
                        i === hi ? "bg-primary/10" : "hover:bg-muted/40"
                      )}
                    >
                      <div className="h-8 w-8 grid place-items-center rounded-md bg-primary/15 text-primary shrink-0">
                        {m.matchedBy === "plate" ? <Car className="h-4 w-4" /> :
                         m.matchedBy === "cpf" ? <IdCard className="h-4 w-4" /> :
                         <User className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{m.customer.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
                          <span className="font-mono">{formatCpf(m.customer.cpf)}</span>
                          {firstPlate && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{formatPlate(firstPlate)}</span>
                            </>
                          )}
                          {m.vehicles.length > 1 && (
                            <span className="text-muted-foreground/70">+{m.vehicles.length - 1}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
