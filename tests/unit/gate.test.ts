import { describe, expect, it } from "vitest";
import { normalizeAnswer, normalizePassword } from "@/lib/gate";

describe("normalização das respostas da tela de entrada", () => {
  it("ignora maiúsculas, acentos, pontuação e espaços extras", () => {
    expect(normalizeAnswer("  PRAIA   do Fórte!! ")).toBe("praia do forte");
    expect(normalizeAnswer("Café-da-manhã")).toBe("cafedamanha");
    expect(normalizeAnswer("Ação")).toBe(normalizeAnswer("acao"));
  });
  it("senhas de data aceitam separadores", () => {
    expect(normalizePassword("12/06/2021")).toBe("12062021");
    expect(normalizePassword("12 06 2021")).toBe("12062021");
    expect(normalizePassword("12.06.2021")).toBe(normalizePassword("12062021"));
  });
  it("resposta vazia continua vazia", () => {
    expect(normalizeAnswer("   !!! ")).toBe("");
  });
});
