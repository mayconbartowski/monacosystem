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
export function normalizeWhatsapp(v: string): string {
  return (v || "").replace(/\D/g, "").slice(0, 11);
}
export function formatWhatsapp(v: string): string {
  const d = normalizeWhatsapp(v);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function isValidWhatsapp(v: string): boolean {
  const d = normalizeWhatsapp(v);
  return d.length === 10 || d.length === 11;
}
export function brl(n: number): string {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatDuration(min: number): string {
  if (!min || min < 1) return "0min";
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
