import { describe, expect, it } from "vitest";
import { findRegistrationConflict } from "./registrationConflicts";

const customers = [
  { id: "customer-a", cpf: "11111111111", whatsapp: "5511999999999" },
  { id: "customer-b", cpf: "22222222222", whatsapp: "5511888888888" },
];
const vehicles = [
  { id: "vehicle-a", customer_id: "customer-a", plate: "ABC1D23" },
];

describe("registration preflight", () => {
  it("rejects a plate owned by another customer", () => {
    expect(findRegistrationConflict({
      cpf: customers[1].cpf, whatsapp: customers[1].whatsapp, plate: "ABC1D23",
      customers, vehicles, ignoreCustomerId: "customer-b", expectedCustomerId: "customer-b",
    })).toBe("plate");
  });

  it("allows the selected customer and vehicle to edit themselves", () => {
    expect(findRegistrationConflict({
      cpf: customers[0].cpf, whatsapp: customers[0].whatsapp, plate: "ABC1D23",
      customers, vehicles, ignoreCustomerId: "customer-a", ignoreVehicleId: "vehicle-a",
      expectedCustomerId: "customer-a",
    })).toBeNull();
  });

  it("allows a distinct second vehicle for the same customer", () => {
    expect(findRegistrationConflict({
      cpf: customers[0].cpf, whatsapp: customers[0].whatsapp, plate: "XYZ9Z99",
      customers, vehicles, ignoreCustomerId: "customer-a", expectedCustomerId: "customer-a",
    })).toBeNull();
  });

  it("does not allow a duplicate plate to masquerade as a new vehicle", () => {
    expect(findRegistrationConflict({
      cpf: customers[0].cpf, whatsapp: customers[0].whatsapp, plate: "ABC1D23",
      customers, vehicles, ignoreCustomerId: "customer-a", expectedCustomerId: "customer-a",
    })).toBe("plate");
  });
});