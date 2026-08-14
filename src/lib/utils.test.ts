import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/utils";

describe("errorMessage", () => {
  it("usa a mensagem de uma instância de Error", () => {
    expect(errorMessage(new Error("Falha conhecida"), "Fallback")).toBe("Falha conhecida");
  });

  it("aceita objetos de erro retornados por APIs", () => {
    expect(errorMessage({ message: "Erro da API" }, "Fallback")).toBe("Erro da API");
  });

  it("usa o fallback para valores sem mensagem", () => {
    expect(errorMessage(null, "Falha padrão")).toBe("Falha padrão");
  });
});
