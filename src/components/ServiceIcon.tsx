import {
  Sparkles, Droplets, Gem, Crown, Shield, Star, Car, Wrench, LucideIcon,
} from "lucide-react";
import { ServiceIconKey, ServiceKey } from "@/lib/domain";

// eslint-disable-next-line react-refresh/only-export-components -- shared icon catalog
export const SERVICE_ICON_OPTIONS: { key: ServiceIconKey; label: string; Icon: LucideIcon }[] = [
  { key: "droplets", label: "Gota", Icon: Droplets },
  { key: "sparkles", label: "Brilho", Icon: Sparkles },
  { key: "shield", label: "Escudo", Icon: Shield },
  { key: "crown", label: "Coroa", Icon: Crown },
  { key: "gem", label: "Diamante", Icon: Gem },
  { key: "star", label: "Estrela", Icon: Star },
  { key: "car", label: "Carro", Icon: Car },
  { key: "wrench", label: "Ferramenta", Icon: Wrench },
];

const ICONS: Record<ServiceIconKey, LucideIcon> = Object.fromEntries(
  SERVICE_ICON_OPTIONS.map((o) => [o.key, o.Icon])
) as Record<ServiceIconKey, LucideIcon>;

const DEFAULT_BY_SERVICE: Record<ServiceKey, ServiceIconKey> = {
  Essencial: "droplets",
  Premium: "sparkles",
  Golden: "shield",
  Platinum: "crown",
};

export function ServiceIcon({
  serviceKey, iconKey, className,
}: { serviceKey?: ServiceKey; iconKey?: ServiceIconKey; className?: string }) {
  const key = iconKey ?? (serviceKey ? DEFAULT_BY_SERVICE[serviceKey] : "sparkles");
  const Icon = ICONS[key] ?? Sparkles;
  return <Icon className={className} />;
}
