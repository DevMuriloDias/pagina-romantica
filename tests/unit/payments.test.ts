import { describe, expect, it } from "vitest";
import { signMercadoPagoWebhook, verifyMercadoPagoSignature } from "@/lib/payments/signature";
import { friendlyStatusMessage, mapStatus } from "@/lib/payments/status";

describe("assinatura do webhook do Mercado Pago", () => {
  const secret = "segredo-de-teste";
  it("aceita assinatura válida", () => {
    const sig = signMercadoPagoWebhook("123456", "req-1", secret, 1704908010);
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "123456", secret })).toBe(true);
  });
  it("data.id alfanumérico é comparado em minúsculas", () => {
    const sig = signMercadoPagoWebhook("ABC123", "req-1", secret, 1);
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "ABC123", secret })).toBe(true);
  });
  it("rejeita adulteração", () => {
    const sig = signMercadoPagoWebhook("123456", "req-1", secret, 1704908010);
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "999999", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-2", dataId: "123456", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: sig, xRequestId: "req-1", dataId: "123456", secret: "outro" })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: "lixo", xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
  });
});

describe("status de pagamento", () => {
  it("mapeia estados do provedor", () => {
    expect(mapStatus("approved", "accredited", "pix")).toBe("APPROVED");
    expect(mapStatus("pending", null, "pix")).toBe("PENDING");
    expect(mapStatus("in_process", "pending_contingency", "card")).toBe("PENDING");
    expect(mapStatus("rejected", "cc_rejected_other_reason", "card")).toBe("REJECTED");
    expect(mapStatus("cancelled", "expired", "pix")).toBe("EXPIRED");
    expect(mapStatus("cancelled", "by_collector", "card")).toBe("CANCELLED");
    expect(mapStatus("refunded", null, "card")).toBe("REFUNDED");
    expect(mapStatus("charged_back", null, "card")).toBe("CHARGED_BACK");
  });
  it("mensagens de recusa amigáveis em português", () => {
    expect(friendlyStatusMessage("cc_rejected_insufficient_amount")).toMatch(/Limite insuficiente/);
    expect(friendlyStatusMessage("codigo_desconhecido")).toMatch(/Pix/);
  });
});
