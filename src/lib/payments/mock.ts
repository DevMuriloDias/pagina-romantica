import "server-only";
import type { MockPayment } from "@prisma/client";
import { db } from "../db";
import { randomToken } from "../crypto";
import type { CreateCardInput, CreatePixInput, PaymentProvider, ProviderPayment } from "./types";

/**
 * Provedor simulado para desenvolvimento, demonstração e testes E2E (PAYMENTS_PROVIDER=mock).
 * Cartões de teste: titular "APRO" aprova; "OTHE" recusa; "FUND" sem limite; "CONT" fica pendente
 * (mesma convenção do sandbox do Mercado Pago).
 * Pix: fica pendente até POST /api/dev/mock-payments/{id} com {"status":"approved"}.
 * O estado fica no banco (tabela MockPayment) para funcionar com várias instâncias do servidor.
 */
function toPayment(p: MockPayment): ProviderPayment {
  return {
    id: p.id,
    status: p.status as ProviderPayment["status"],
    statusDetail: p.statusDetail,
    externalReference: p.externalReference,
    amountCents: p.amountCents,
    method: p.method === "pix" ? "pix" : "card",
    qrCode: p.qrCode,
    qrBase64: null,
    expiresAt: p.expiresAt,
  };
}

const newId = () => `mock${randomToken(9).replace(/[^a-zA-Z0-9]/g, "x")}`;

export async function setMockPaymentStatus(id: string, status: ProviderPayment["status"], statusDetail: string | null = null): Promise<ProviderPayment | null> {
  const existing = await db.mockPayment.findUnique({ where: { id } });
  if (!existing) return null;
  const updated = await db.mockPayment.update({
    where: { id },
    data: { status, statusDetail: statusDetail ?? (status === "approved" ? "accredited" : status) },
  });
  return toPayment(updated);
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createPix(input: CreatePixInput) {
    const existing = await db.mockPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return toPayment(existing);
    const id = newId();
    const qrCode = `00020126580014br.gov.bcb.pix0136mock-${id}5204000053039865406${(input.amountCents / 100).toFixed(2)}5802BR5907AVELOVE6009SAO PAULO62070503***6304ABCD`;
    const created = await db.mockPayment.create({
      data: {
        id,
        idempotencyKey: input.idempotencyKey,
        status: "pending",
        statusDetail: "pending_waiting_transfer",
        externalReference: input.externalReference,
        amountCents: input.amountCents,
        method: "pix",
        qrCode,
        expiresAt: input.expiresAt,
      },
    });
    return toPayment(created);
  },
  async createCard(input: CreateCardInput) {
    const existing = await db.mockPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return toPayment(existing);
    const holder = input.token.toUpperCase();
    const [status, detail]: [ProviderPayment["status"], string] = holder.includes("OTHE")
      ? ["rejected", "cc_rejected_other_reason"]
      : holder.includes("FUND")
        ? ["rejected", "cc_rejected_insufficient_amount"]
        : holder.includes("CONT")
          ? ["in_process", "pending_contingency"]
          : ["approved", "accredited"];
    const created = await db.mockPayment.create({
      data: { id: newId(), idempotencyKey: input.idempotencyKey, status, statusDetail: detail, externalReference: input.externalReference, amountCents: input.amountCents, method: "card" },
    });
    return toPayment(created);
  },
  async getPayment(id: string) {
    const p = await db.mockPayment.findUnique({ where: { id } });
    if (!p) throw new Error(`Pagamento simulado não encontrado: ${id}`);
    if (p.method === "pix" && p.status === "pending" && p.expiresAt && p.expiresAt < new Date()) {
      return (await setMockPaymentStatus(id, "cancelled", "expired"))!;
    }
    return toPayment(p);
  },
  async refund(id: string) {
    await setMockPaymentStatus(id, "refunded", "refunded");
  },
};
