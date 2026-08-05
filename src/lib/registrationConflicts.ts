export type RegistrationConflictField = "cpf" | "whatsapp" | "plate";

type CustomerIdentity = { id: string; cpf: string; whatsapp: string };
type VehicleIdentity = { id: string; customer_id: string; plate: string };

export function findRegistrationConflict(input: {
  cpf: string;
  whatsapp: string;
  plate: string;
  customers: CustomerIdentity[];
  vehicles: VehicleIdentity[];
  ignoreCustomerId?: string;
  ignoreVehicleId?: string;
  expectedCustomerId?: string;
}): RegistrationConflictField | null {
  const customerClashes = input.customers.filter((row) => row.id !== input.ignoreCustomerId);
  if (customerClashes.some((row) => row.cpf === input.cpf)) return "cpf";
  if (customerClashes.some((row) => row.whatsapp === input.whatsapp)) return "whatsapp";

  const plateMatch = input.vehicles.find(
    (row) => row.plate === input.plate && row.id !== input.ignoreVehicleId,
  );
  if (!plateMatch) return null;

  // A placa só é reutilizável quando é o próprio veículo selecionado para edição.
  // Mesmo outro veículo do mesmo cliente continua sendo conflito de unicidade.
  return "plate";
}