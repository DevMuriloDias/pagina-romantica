import "server-only";
import type { CreateCardInput, CreatePixInput, PaymentProvider, ProviderPayment } from "./types";

/**
 * Provedor simulado para desenvolvimento e testes E2E (PAYMENTS_PROVIDER=mock).
 * Cartões de teste: titular "APRO" aprova; "OTHE" recusa; "CONT" fica pendente (mesma convenção do sandbox do MP).
 * Pix: fica pendente até POST /api/dev/mock-payments/{id} com {"status":"approved"}.
 */
const g = globalThis as unknown as { __mockPayments?: Map<string, ProviderPayment>; __mockIdem?: Map<string, string> };
const store = (g.__mockPayments ??= new Map<string, ProviderPayment>());
const byIdempotency = (g.__mockIdem ??= new Map<string, string>());

let seq = Date.now() % 1_000_000;
const nextId = () => `mock${++seq}`;

export function setMockPaymentStatus(id: string, status: ProviderPayment["status"], statusDetail: string | null = null) {
  const p = store.get(id);
  if (!p) return null;
  const updated = { ...p, status, statusDetail: statusDetail ?? (status === "approved" ? "accredited" : status) };
  store.set(id, updated);
  return updated;
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createPix(input: CreatePixInput) {
    const existing = byIdempotency.get(input.idempotencyKey);
    if (existing && store.get(existing)) return store.get(existing)!;
    const id = nextId();
    const qrCode = `00020126580014br.gov.bcb.pix0136mock-${id}5204000053039865406${(input.amountCents / 100).toFixed(2)}5802BR5913AMOR EM PAGINA6009SAO PAULO62070503***6304ABCD`;
    const payment: ProviderPayment = {
      id,
      status: "pending",
      statusDetail: "pending_waiting_transfer",
      externalReference: input.externalReference,
      amountCents: input.amountCents,
      method: "pix",
      qrCode,
      qrBase64: null,
      expiresAt: input.expiresAt,
    };
    store.set(id, payment);
    byIdempotency.set(input.idempotencyKey, id);
    return payment;
  },
  async createCard(input: CreateCardInput) {
    const existing = byIdempotency.get(input.idempotencyKey);
    if (existing && store.get(existing)) return store.get(existing)!;
    const holder = input.token.toUpperCase();
    const [status, detail]: [ProviderPayment["status"], string] = holder.includes("OTHE")
      ? ["rejected", "cc_rejected_other_reason"]
      : holder.includes("FUND")
        ? ["rejected", "cc_rejected_insufficient_amount"]
        : holder.includes("CONT")
          ? ["in_process", "pending_contingency"]
          : ["approved", "accredited"];
    const id = nextId();
    const payment: ProviderPayment = { id, status, statusDetail: detail, externalReference: input.externalReference, amountCents: input.amountCents, method: "card" };
    store.set(id, payment);
    byIdempotency.set(input.idempotencyKey, id);
    return payment;
  },
  async getPayment(id: string) {
    const p = store.get(id);
    if (!p) throw new Error(`Pagamento simulado não encontrado: ${id}`);
    if (p.method === "pix" && p.status === "pending" && p.expiresAt && p.expiresAt < new Date()) {
      return setMockPaymentStatus(id, "cancelled", "expired")!;
    }
    return p;
  },
  async refund(id: string) {
    setMockPaymentStatus(id, "refunded", "refunded");
  },
};
