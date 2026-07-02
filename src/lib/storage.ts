// Apenas helpers de formatação. Nada de localStorage para dados de negócio.
// Toda persistência passa por src/services/data.ts + Supabase.

export function toTitleCase(v: string): string {
  return (v || "").toLocaleLowerCase("pt-BR").replace(
    /(^|\s|['\-])(\p{L})/gu,
    (_, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"),
  );
}
export function toUpperCase(v: string): string {
  return (v || "").toLocaleUpperCase("pt-BR");
}

export function normalizeCpf(cpf: string): string {
  return (cpf || "").replace(/\D/g, "");
}
export function formatCpf(cpf: string): string {
  const v = normalizeCpf(cpf).slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function normalizePlate(p: string): string {
  return (p || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}
export function formatPlate(p: string): string {
  const v = normalizePlate(p).slice(0, 7);
  if (v.length <= 3) return v;
  return v.slice(0, 3) + "-" + v.slice(3);
}
export function formatPhone(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function brl(n: number): string {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatDuration(min: number): string {
  if (!min || min < 1) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
